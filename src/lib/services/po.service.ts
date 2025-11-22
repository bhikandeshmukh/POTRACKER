import { PurchaseOrder, CreatePOForm } from '../types';
import { BaseService } from './base.service';
import { auditService } from './audit.service';
import { commentService } from './comment.service';
import { Timestamp } from 'firebase/firestore';

export class POService extends BaseService<PurchaseOrder> {
  constructor() {
    super('purchaseOrders');
  }

  private async generatePONumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.count();
    return `PO-${year}-${String(count + 1).padStart(3, '0')}`;
  }

  private poNumberToDocId(poNumber: string): string {
    return poNumber.replace(/[^a-zA-Z0-9]/g, '-');
  }

  /**
  * Creates a purchase order, logs an audit event for successful creation, and handles errors centrally.
  * @example
  * createPO(formData, { uid: 'u1', name: 'Alice', role: 'manager' }, 'Acme Supplies', 'PO-2025-001')
  * { success: true }
  * @param {{CreatePOForm}} {{formData}} - Form data used to construct the purchase order.
  * @param {{{ uid: string; name: string; role: string }}} {{createdBy}} - User metadata performing the creation.
  * @param {{string}} {{vendorName}} - Name of the vendor associated with the purchase order.
  * @param {{string}} {{customPONumber}} - Optional custom purchase order number.
  * @returns {{Promise<{success: boolean; error?: string}>}} Promise resolving with the creation result.
  **/
  async createPO(
    formData: CreatePOForm,
    createdBy: { uid: string; name: string; role: string },
    vendorName: string,
    customPONumber?: string
  ) {
    try {
      const poNumber = customPONumber || await this.generatePONumber();
      const docId = this.poNumberToDocId(poNumber);

      // Calculate line item totals
      const lineItems = formData.lineItems.map(item => ({
        ...item,
        total: item.quantity * item.unitPrice,
        sentQty: 0,
        pendingQty: item.quantity,
        receivedQty: 0
      }));

      const totalAmount = lineItems.reduce((sum, item) => sum + item.total, 0);

      const poData: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'> = {
        poNumber,
        vendorId: formData.vendorId,
        vendorName,
        orderDate: Timestamp.fromDate(new Date(formData.orderDate)),
        expectedDeliveryDate: Timestamp.fromDate(new Date(formData.expectedDeliveryDate)),
        totalAmount,
        status: 'Pending',
        createdBy_uid: createdBy.uid,
        createdBy_name: createdBy.name,
        lineItems,
        shipments: [],
        totalShippedAmount: 0,
        totalReceivedAmount: 0
      };

      const result = await this.create(poData, docId);

      if (result.success) {
        // Log audit event
        await auditService.logEvent(
          createdBy.uid,
          createdBy.name,
          createdBy.role,
          'create',
          'po',
          docId,
          poNumber,
          `Created PO ${poNumber} for vendor ${vendorName} with total amount ₹${totalAmount.toLocaleString()}`,
          undefined,
          {
            vendorName,
            totalAmount,
            itemCount: lineItems.length,
            userRole: createdBy.role
          }
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'create PO').message
      };
    }
  }

  /*****
  * Updates the status of a purchase order, logs the change, and optionally comments on significant transitions.
  * @example
  * updateStatus('PO123', 'Approved', { uid: 'u1', name: 'Alex', role: 'approver' }, 'Reviewed and approved')
  * { success: true, data: {...} }
  * @param {{string}} id - Identifier of the purchase order to update.
  * @param {{PurchaseOrder['status']}} status - Target status to set on the purchase order.
  * @param {{{ uid: string; name: string; role: string }}} updatedBy - User information for who is performing the update.
  * @param {{string}} reason - Optional reason describing why the status is being changed.
  * @returns {{Promise<{ success: boolean; data?: PurchaseOrder; error?: string; }}} Result of the update operation, including success flag and any data or error details.
  ******/
  async updateStatus(
    id: string,
    status: PurchaseOrder['status'],
    updatedBy: { uid: string; name: string; role: string },
    reason?: string
  ) {
    try {
      // Get current PO to track changes
      const currentResult = await this.findById(id);
      if (!currentResult.success || !currentResult.data) {
        return {
          success: false,
          error: 'PO not found'
        };
      }

      const currentPO = currentResult.data;
      const oldStatus = currentPO.status;

      const updateData: Partial<PurchaseOrder> = {
        status,
        ...(status === 'Approved' && { approvedBy_uid: updatedBy.uid })
      };

      const result = await this.update(id, updateData);

      if (result.success) {
        // Log status change
        await auditService.logPOStatusChange(
          id,
          currentPO.poNumber,
          oldStatus,
          status,
          updatedBy.uid,
          updatedBy.name,
          updatedBy.role,
          reason
        );

        // Add automatic comment for status change (only for significant status changes)
        if (oldStatus !== status && ['Approved', 'Rejected', 'Shipped', 'Received'].includes(status)) {
          const statusMessages: Record<string, string> = {
            'Approved': `✅ PO has been approved by ${updatedBy.name}`,
            'Rejected': `❌ PO has been rejected by ${updatedBy.name}${reason ? ` - Reason: ${reason}` : ''}`,
            'Shipped': `🚚 PO has been marked as shipped by ${updatedBy.name}`,
            'Received': `📦 PO has been marked as received by ${updatedBy.name}`
          };

          const commentContent = statusMessages[status];
          
          if (commentContent) {
            try {
              // Check if similar comment already exists to prevent duplicates
              const existingComments = await commentService.getCommentsForPO(id);
              const isDuplicate = existingComments.success && 
                existingComments.data?.data.some(comment => 
                  comment.content === commentContent && 
                  comment.userId === updatedBy.uid &&
                  Math.abs(new Date().getTime() - comment.timestamp.toDate().getTime()) < 60000 // Within 1 minute
                );

              if (!isDuplicate) {
                await commentService.addComment(
                  id,
                  updatedBy,
                  commentContent
                );
              }
            } catch (commentError) {
              console.error('Failed to add status change comment:', commentError);
              // Don't fail the main operation if comment fails
            }
          }
        }
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'update PO status').message
      };
    }
  }

  /**
  * Retrieves purchase orders for a user, optionally filtered by creator when the user is an employee.
  * @example
  * getPOsForUser('user123', 'Employee', 20)
  * [{ orderId: 'PO1', ... }]
  * @param {{string}} {{userId}} - The unique identifier of the user requesting purchase orders.
  * @param {{string}} {{role}} - The role of the user, influencing whether the results are filtered by creator.
  * @param {{number}} {{limitCount}} - Maximum number of purchase orders to return; defaults to 50.
  * @returns {{Array}} Array of purchase orders matching the query criteria.
  **/
  async getPOsForUser(userId: string, role: string, limitCount: number = 50) {
    if (role === 'Employee') {
      return this.findMany({
        where: [{ field: 'createdBy_uid', operator: '==', value: userId }],
        orderBy: 'orderDate',
        orderDirection: 'desc',
        limit: limitCount
      });
    } else {
      return this.findMany({
        orderBy: 'orderDate',
        orderDirection: 'desc',
        limit: limitCount
      });
    }
  }

  /**
   * Searches a user’s purchase orders by PO number or vendor name.
   * @example
   * searchPOs('widget', 'user123', 'Admin')
   * {success: true, data: {...}}
   * @param {{string}} {{searchTerm}} - Term to match against PO numbers and vendor names.
   * @param {{string}} {{userId}} - Optional user identifier to scope the search.
   * @param {{string}} {{role}} - Optional role to determine access; defaults to Admin when not provided.
   * @returns {{object}} Search result containing filtered POs and metadata.
   **/
  async searchPOs(searchTerm: string, userId?: string, role?: string) {
    // Note: Firestore doesn't support full-text search natively
    // This is a simplified implementation - consider using Algolia or similar for production
    const result = await this.getPOsForUser(userId || '', role || 'Admin');
    
    if (result.success && result.data) {
      const filteredPOs = result.data.data.filter(po => 
        po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
      );

      return {
        success: true,
        data: {
          ...result.data,
          data: filteredPOs,
          total: filteredPOs.length
        }
      };
    }

    return result;
  }
}

export const poService = new POService();