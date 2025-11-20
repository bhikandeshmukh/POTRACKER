import { Shipment, ShipmentLineItem } from '../types';
import { BaseService } from './base.service';
import { auditService } from './audit.service';
import { Timestamp, serverTimestamp } from 'firebase/firestore';

export class ShipmentService extends BaseService<Shipment> {
  constructor() {
    super('shipments');
  }

  async createShipment(
    shipmentData: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>,
    createdBy: { uid: string; name: string; role: string }
  ) {
    try {
      const result = await this.create({
        ...shipmentData,
        createdBy_uid: createdBy.uid,
        createdBy_name: createdBy.name
      });

      if (result.success) {
        // Log audit event
        await auditService.logEvent(
          createdBy.uid,
          createdBy.name,
          createdBy.role,
          'create',
          'shipment',
          result.data!.id!,
          `Shipment for PO ${shipmentData.poNumber}`,
          `Created shipment for PO ${shipmentData.poNumber} with ${shipmentData.lineItems.length} items`,
          undefined,
          {
            poNumber: shipmentData.poNumber,
            totalAmount: shipmentData.totalAmount,
            itemCount: shipmentData.lineItems.length,
            status: shipmentData.status
          }
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'create shipment').message
      };
    }
  }

  async updateShipmentStatus(
    id: string,
    status: Shipment['status'],
    updatedBy: { uid: string; name: string; role: string },
    trackingNumber?: string,
    actualDeliveryDate?: Date
  ) {
    try {
      // Get current shipment to track changes
      const currentResult = await this.findById(id);
      if (!currentResult.success || !currentResult.data) {
        return {
          success: false,
          error: 'Shipment not found'
        };
      }

      const currentShipment = currentResult.data;
      const oldStatus = currentShipment.status;

      const updateData: Partial<Shipment> = {
        status,
        ...(trackingNumber && { trackingNumber }),
        ...(actualDeliveryDate && { actualDeliveryDate: Timestamp.fromDate(actualDeliveryDate) })
      };

      const result = await this.update(id, updateData);

      if (result.success) {
        // Log status change
        await auditService.logEvent(
          updatedBy.uid,
          updatedBy.name,
          updatedBy.role,
          'update',
          'shipment',
          id,
          `Shipment for PO ${currentShipment.poNumber}`,
          `Shipment status changed from ${oldStatus} to ${status}`,
          { status: { old: oldStatus, new: status } },
          {
            poNumber: currentShipment.poNumber,
            trackingNumber,
            actualDeliveryDate: actualDeliveryDate?.toISOString()
          }
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'update shipment status').message
      };
    }
  }

  async getShipmentsByPO(poNumber: string) {
    return this.findMany({
      where: [{ field: 'poNumber', operator: '==', value: poNumber }],
      orderBy: 'shipmentDate',
      orderDirection: 'desc'
    });
  }

  async getShipmentsByStatus(status: Shipment['status']) {
    return this.findMany({
      where: [{ field: 'status', operator: '==', value: status }],
      orderBy: 'shipmentDate',
      orderDirection: 'desc'
    });
  }

  async getShipmentsByDateRange(startDate: Date, endDate: Date) {
    return this.findMany({
      where: [
        { field: 'shipmentDate', operator: '>=', value: Timestamp.fromDate(startDate) },
        { field: 'shipmentDate', operator: '<=', value: Timestamp.fromDate(endDate) }
      ],
      orderBy: 'shipmentDate',
      orderDirection: 'desc'
    });
  }

  async searchShipments(searchTerm: string) {
    const result = await this.findMany();
    
    if (result.success && result.data) {
      const filteredShipments = result.data.data.filter(shipment => 
        shipment.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (shipment.trackingNumber && shipment.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (shipment.carrier && shipment.carrier.toLowerCase().includes(searchTerm.toLowerCase()))
      );

      return {
        success: true,
        data: {
          ...result.data,
          data: filteredShipments,
          total: filteredShipments.length
        }
      };
    }

    return result;
  }

  // Dashboard analytics methods
  async getShipmentStats() {
    try {
      const result = await this.findMany();
      
      if (!result.success || !result.data) {
        return {
          success: false,
          error: 'Failed to fetch shipments'
        };
      }

      const shipments = result.data.data;
      const stats = {
        total: shipments.length,
        prepared: shipments.filter(s => s.status === 'Prepared').length,
        shipped: shipments.filter(s => s.status === 'Shipped').length,
        inTransit: shipments.filter(s => s.status === 'In Transit').length,
        delivered: shipments.filter(s => s.status === 'Delivered').length,
        cancelled: shipments.filter(s => s.status === 'Cancelled').length,
        totalValue: shipments.reduce((sum, s) => sum + s.totalAmount, 0)
      };

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'get shipment stats').message
      };
    }
  }
}

export const shipmentService = new ShipmentService();