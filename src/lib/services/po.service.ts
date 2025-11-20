import { PurchaseOrder, CreatePOForm } from '../types';
import { BaseService } from './base.service';
import { auditService } from './audit.service';
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
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'update PO status').message
      };
    }
  }

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