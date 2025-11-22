import { ReturnOrder, ReturnOrderItem } from '../types';
import { BaseService } from './base.service';
import { auditService } from './audit.service';
import { Timestamp } from 'firebase/firestore';

export class ReturnOrderService extends BaseService<ReturnOrder> {
  constructor() {
    super('returnOrders');
  }

  private async generateRONumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.count();
    return `RO-${year}-${String(count + 1).padStart(3, '0')}`;
  }

  private roNumberToDocId(roNumber: string): string {
    return roNumber.replace(/[^a-zA-Z0-9]/g, '-');
  }

  /**
  * Creates a return order record, logs an audit event, and returns the persistence result.
  * @example
  * createReturnOrder({ poNumber: 'PO123', poId: '123', vendorId: 'V1', vendorName: 'Vendor', returnDate: new Date(), lineItems: [] }, { uid: 'u1', name: 'Alice', role: 'buyer' }, 'RO-0001')
  * { success: true, id: 'RO-0001' }
  * @param {{object}} roData - Return order payload including PO info, vendor info, return date, and line items.
  * @param {{uid: string; name: string; role: string}} createdBy - Metadata for the user creating the return order for audit logging.
  * @param {{string}} customRONumber - Optional custom return order identifier to override generated number.
  * @returns {{Promise<{success: boolean; error?: string}>>}} Result of the return order creation with success flag and optional error message.
  **/
  async createReturnOrder(
    roData: {
      poNumber: string;
      poId: string;
      vendorId: string;
      vendorName: string;
      returnDate: Date;
      lineItems: ReturnOrderItem[];
      notes?: string;
    },
    createdBy: { uid: string; name: string; role: string },
    customRONumber?: string
  ) {
    try {
      const roNumber = customRONumber || await this.generateRONumber();
      const docId = this.roNumberToDocId(roNumber);

      // Calculate total amount
      const totalAmount = roData.lineItems.reduce((sum, item) => sum + item.total, 0);

      const returnOrderData: Omit<ReturnOrder, 'id' | 'createdAt' | 'updatedAt'> = {
        roNumber,
        poNumber: roData.poNumber,
        poId: roData.poId,
        vendorId: roData.vendorId,
        vendorName: roData.vendorName,
        returnDate: Timestamp.fromDate(roData.returnDate),
        totalAmount,
        status: 'Pending',
        createdBy_uid: createdBy.uid,
        createdBy_name: createdBy.name,
        lineItems: roData.lineItems,
        notes: roData.notes
      };

      const result = await this.create(returnOrderData, docId);

      if (result.success) {
        // Log audit event
        await auditService.logEvent(
          createdBy.uid,
          createdBy.name,
          createdBy.role,
          'create',
          'ro',
          docId,
          roNumber,
          `Created return order ${roNumber} for PO ${roData.poNumber} with total amount ₹${totalAmount.toLocaleString()}`,
          undefined,
          {
            poNumber: roData.poNumber,
            vendorName: roData.vendorName,
            totalAmount,
            itemCount: roData.lineItems.length,
            userRole: createdBy.role
          }
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'create return order').message
      };
    }
  }

  /**
   * Updates the status of a return order and logs the change.
   * @example
   * updateReturnOrderStatus('ro123', 'Approved', { uid: 'u1', name: 'Alice', role: 'manager' }, 'Stock inspected')
   * { success: true, data: { ... } }
   * @param {{string}} {{id}} - Return order identifier.
   * @param {{ReturnOrder['status']}} {{status}} - New status for the return order.
   * @param {{{uid: string; name: string; role: string}}} {{updatedBy}} - User performing the update.
   * @param {{string}} {{reason}} - Optional reason for the status change.
   * @returns {{Promise<any>}} Result of the update operation.
   **/
  async updateReturnOrderStatus(
    id: string,
    status: ReturnOrder['status'],
    updatedBy: { uid: string; name: string; role: string },
    reason?: string
  ) {
    try {
      // Get current RO to track changes
      const currentResult = await this.findById(id);
      if (!currentResult.success || !currentResult.data) {
        return {
          success: false,
          error: 'Return order not found'
        };
      }

      const currentRO = currentResult.data;
      const oldStatus = currentRO.status;

      const updateData: Partial<ReturnOrder> = {
        status,
        ...(status === 'Approved' && { approvedBy_uid: updatedBy.uid, approvedBy_name: updatedBy.name })
      };

      const result = await this.update(id, updateData);

      if (result.success) {
        // Log status change
        await auditService.logEvent(
          updatedBy.uid,
          updatedBy.name,
          updatedBy.role,
          status === 'Approved' ? 'approve' : status === 'Rejected' ? 'reject' : 'update',
          'ro',
          id,
          currentRO.roNumber,
          `Return order status changed from ${oldStatus} to ${status}${reason ? ` - ${reason}` : ''}`,
          { status: { old: oldStatus, new: status } },
          { reason, userRole: updatedBy.role }
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'update return order status').message
      };
    }
  }

  async getReturnOrdersByPO(poNumber: string) {
    return this.findMany({
      where: [{ field: 'poNumber', operator: '==', value: poNumber }],
      orderBy: 'returnDate',
      orderDirection: 'desc'
    });
  }

  async getReturnOrdersByVendor(vendorId: string) {
    return this.findMany({
      where: [{ field: 'vendorId', operator: '==', value: vendorId }],
      orderBy: 'returnDate',
      orderDirection: 'desc'
    });
  }

  async getReturnOrdersByStatus(status: ReturnOrder['status']) {
    return this.findMany({
      where: [{ field: 'status', operator: '==', value: status }],
      orderBy: 'returnDate',
      orderDirection: 'desc'
    });
  }

  /**
  * Retrieves return orders for a specific user, optionally limited in count.
  * @example
  * getReturnOrdersForUser('user123', 'Employee', 10)
  * [{ id: 'return1', returnDate: '2025-11-21', createdBy_uid: 'user123' }]
  * @param {string} userId - Identifier of the user whose return orders are requested.
  * @param {string} role - Role of the user requesting the return orders.
  * @param {number} limitCount - Maximum number of return orders to retrieve.
  * @returns {any[]} Array of return order records matching the provided criteria.
  **/
  async getReturnOrdersForUser(userId: string, role: string, limitCount: number = 50) {
    if (role === 'Employee') {
      return this.findMany({
        where: [{ field: 'createdBy_uid', operator: '==', value: userId }],
        orderBy: 'returnDate',
        orderDirection: 'desc',
        limit: limitCount
      });
    } else {
      return this.findMany({
        orderBy: 'returnDate',
        orderDirection: 'desc',
        limit: limitCount
      });
    }
  }

  /**
  * Filters return orders for a user based on a search term and returns the matching collection.
  * @example
  * searchReturnOrders('widget', 'user123', 'Admin')
  * { success: true, data: { data: [/* filtered orders */
  async searchReturnOrders(searchTerm: string, userId?: string, role?: string) {
    const result = await this.getReturnOrdersForUser(userId || '', role || 'Admin');
    
    if (result.success && result.data) {
      const filteredROs = result.data.data.filter(ro => 
        ro.roNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ro.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ro.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
      );

      return {
        success: true,
        data: {
          ...result.data,
          data: filteredROs,
          total: filteredROs.length
        }
      };
    }

    return result;
  }

  /****
  * Deletes an existing return order by id while logging the deletion event.
  * @example
  * deleteReturnOrder("ro123", { uid: "u1", name: "Alice", role: "admin" })
  * { success: true }
  * @param {{string}} {{id}} - Return order identifier to delete.
  * @param {{{ uid: string; name: string; role: string }}} {{deletedBy}} - Metadata of the user performing the deletion.
  * @returns {{Promise<{ success: boolean; error?: string }}}} Result of the deletion operation.
  ****/
  async deleteReturnOrder(
    id: string,
    deletedBy: { uid: string; name: string; role: string }
  ) {
    try {
      // Get RO details before deletion
      const currentResult = await this.findById(id);
      const roNumber = currentResult.data?.roNumber || 'Unknown RO';

      const result = await this.delete(id);

      if (result.success) {
        // Log audit event
        await auditService.logEvent(
          deletedBy.uid,
          deletedBy.name,
          deletedBy.role,
          'delete',
          'ro',
          id,
          roNumber,
          `Deleted return order ${roNumber}`
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'delete return order').message
      };
    }
  }
}

export const returnOrderService = new ReturnOrderService();