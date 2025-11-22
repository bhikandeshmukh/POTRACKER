import { Shipment, ShipmentLineItem } from '../types';
import { BaseService } from './base.service';
import { auditService } from './audit.service';
import { getUserInfo, cleanMetadata } from '../utils/userUtils';
import { Timestamp, serverTimestamp } from 'firebase/firestore';

export class ShipmentService extends BaseService<Shipment> {
  constructor() {
    super('shipments');
  }

  /**
  * Creates a shipment record and logs an audit event when creation succeeds.
  * @example
  * createShipment({poNumber: 'PO123', lineItems: [], totalAmount: 0, status: 'pending'}, {uid: 'u1', name: 'Alice', role: 'admin'})
  * {success: true, data: {...}}
  * @param {{Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>}} shipmentData - Shipment payload without auto-generated identifiers or timestamps.
  * @param {{uid: string; name: string; role: string}} createdBy - Metadata for the user creating the shipment for auditing purposes.
  * @returns {{Promise<{success: boolean; data?: Shipment; error?: string}>>}} Promise resolving with the creation result including any error message.
  **/
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

  /*********************************************************************************
  * Updates the shipment status, tracks related changes, and logs the audit event.
  * @example
  * updateShipmentStatus('shipmentId', 'IN_TRANSIT', { uid: '123', name: 'Alex', role: 'driver' }, 'TRACK123', new Date())
  * { success: true, data: { ... } }
  * @param {{string}} id - Shipment unique identifier to update.
  * @param {{Shipment['status']}} status - New shipment status to set.
  * @param {{{ uid: string; name: string; role: string }}} updatedBy - Metadata about the user performing the update.
  * @param {{string}} [trackingNumber] - Optional tracking number to attach to the shipment.
  * @param {{Date}} [actualDeliveryDate] - Optional actual delivery date for the shipment.
  * @returns {{Promise<{success: boolean; error?: string; data?: Shipment}>}} Result of the update operation.
  *********************************************************************************/
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
        // Update linked appointment status
        await this.syncAppointmentStatus(id, status, updatedBy);

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
          cleanMetadata({
            poNumber: currentShipment.poNumber,
            trackingNumber,
            actualDeliveryDate: actualDeliveryDate?.toISOString()
          })
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

  /**
  * Syncs the appointment status for a shipment and records related comments and audit events.
  * @example
  * syncAppointmentStatus("abc123", "Shipped", { uid: "u1", name: "Alice", role: "dispatcher" })
  * undefined
  * @param {{string}} shipmentId - Identifier of the shipment whose linked appointment should be synchronized.
  * @param {{Shipment['status']}} shipmentStatus - Current status of the shipment driving the appointment update.
  * @param {{{uid: string; name: string; role: string}}} updatedBy - Identity of the person or system performing the synchronization.
  * @returns {{Promise<void>}} Resolves when the appointment synchronization (including comments/audit logging) completes.
  **/
  private async syncAppointmentStatus(
    shipmentId: string,
    shipmentStatus: Shipment['status'],
    updatedBy: { uid: string; name: string; role: string }
  ) {
    try {
      const { collection, query, where, getDocs, doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const { commentService } = await import('./comment.service');

      // Find appointment linked to this shipment
      const appointmentsRef = collection(db, 'appointments');
      const q = query(appointmentsRef, where('shipmentId', '==', shipmentId));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const appointmentDoc = snapshot.docs[0];
        const appointmentData = appointmentDoc.data();

        // Map shipment status to appointment status
        const appointmentStatusMap: Record<string, string> = {
          'Prepared': 'prepared',
          'Shipped': 'shipped',
          'In Transit': 'in-transit',
          'Delivered': 'delivered',
          'Cancelled': 'cancelled'
        };

        const appointmentStatus = appointmentStatusMap[shipmentStatus];
        if (appointmentStatus) {
          // Update appointment status
          const appointmentRef = doc(db, 'appointments', appointmentDoc.id);
          await updateDoc(appointmentRef, {
            status: appointmentStatus,
            updatedAt: serverTimestamp(),
            updatedBy: updatedBy.name
          });

          // Add comment to PO about synchronized status change
          if (appointmentData.poId) {
            try {
              await commentService.addComment(
                appointmentData.poId,
                {
                  uid: updatedBy.uid,
                  name: updatedBy.name,
                  role: updatedBy.role
                },
                `🔄 Shipment status updated: ${shipmentStatus} → Appointment synced: ${appointmentStatus.toUpperCase()} (${appointmentData.appointmentId})`
              );
            } catch (commentError) {
              console.error('Failed to add sync comment:', commentError);
            }
          }

          // Log sync audit event
          await auditService.logEvent(
            updatedBy.uid,
            updatedBy.name,
            updatedBy.role,
            'update',
            'system',
            shipmentId,
            `Shipment ${shipmentId}`,
            `Synchronized appointment status from shipment: ${shipmentStatus} → ${appointmentStatus}`,
            undefined,
            {
              shipmentId,
              appointmentId: appointmentData.appointmentId,
              shipmentStatus,
              appointmentStatus,
              syncDirection: 'shipment_to_appointment'
            }
          );
        }
      }
    } catch (error) {
      console.error('Failed to sync appointment status:', error);
      // Don't throw error as this is a secondary operation
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

  /**
  * Filters shipment results by matching the provided search term against key shipment identifiers.
  * @example
  * searchShipments("po12345")
  * { success: true, data: { data: [/* filtered shipments */
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
  /**
  * Deletes a shipment and its appointment, auditing the deletion when successful.
  * @example
  * deleteShipmentWithAppointment("shipment-id", { uid: "user1", name: "Jane Doe", role: "admin" })
  * { success: true }
  * @param {{string}} id - Unique identifier of the shipment to remove.
  * @param {{ uid: string; name: string; role: string }} deletedBy - Metadata for the user performing the deletion.
  * @returns {{Promise<{ success: boolean; error?: string }}}} Result of the deletion operation.
  **/
  async deleteShipmentWithAppointment(
    id: string,
    deletedBy: { uid: string; name: string; role: string }
  ) {
    try {
      // Get current shipment
      const currentResult = await this.findById(id);
      if (!currentResult.success || !currentResult.data) {
        return {
          success: false,
          error: 'Shipment not found'
        };
      }

      const currentShipment = currentResult.data;

      // Delete linked appointment first
      await this.deleteLinkedAppointment(id, deletedBy);

      // Delete the shipment
      const result = await this.delete(id);

      if (result.success) {
        // Log deletion
        await auditService.logEvent(
          deletedBy.uid,
          deletedBy.name,
          deletedBy.role,
          'delete',
          'shipment',
          id,
          `Shipment for PO ${currentShipment.poNumber}`,
          `Deleted shipment and linked appointment`,
          undefined,
          {
            poNumber: currentShipment.poNumber,
            deletionType: 'shipment_with_appointment'
          }
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'delete shipment with appointment').message
      };
    }
  }

  /**
  * Removes the appointment linked to a shipment, logs audit details, and optionally comments on the PO.
  * @example
  * deleteLinkedAppointment('shipment123', {uid: 'user123', name: 'Sam', role: 'admin'})
  * undefined
  * @param {{string}} shipmentId - Identifier for the shipment whose linked appointment is deleted.
  * @param {{{uid: string; name: string; role: string}}} deletedBy - Details of the user performing the deletion for audit/commenting.
  * @returns {{Promise<void>}} Promise that resolves once the deletion attempt and related logging complete.
  **/
  private async deleteLinkedAppointment(
    shipmentId: string,
    deletedBy: { uid: string; name: string; role: string }
  ) {
    try {
      const { collection, query, where, getDocs, doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const { commentService } = await import('./comment.service');

      // Find appointment linked to this shipment
      const appointmentsRef = collection(db, 'appointments');
      const q = query(appointmentsRef, where('shipmentId', '==', shipmentId));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const appointmentDoc = snapshot.docs[0];
        const appointmentData = appointmentDoc.data();

        // Delete the appointment
        await deleteDoc(appointmentDoc.ref);

        // Add comment to PO about deletion
        if (appointmentData.poId) {
          try {
            await commentService.addComment(
              appointmentData.poId,
              {
                uid: deletedBy.uid,
                name: deletedBy.name,
                role: deletedBy.role
              },
              `🗑️ Shipment deleted: ${shipmentId} → Appointment removed: ${appointmentData.appointmentId}`
            );
          } catch (commentError) {
            console.error('Failed to add deletion comment:', commentError);
          }
        }

        // Log deletion audit event
        await auditService.logEvent(
          deletedBy.uid,
          deletedBy.name,
          deletedBy.role,
          'delete',
          'system',
          appointmentDoc.id,
          `Appointment ${appointmentData.appointmentId}`,
          `Deleted appointment due to shipment deletion: ${shipmentId}`,
          undefined,
          {
            shipmentId,
            appointmentId: appointmentData.appointmentId,
            deletionType: 'appointment_from_shipment'
          }
        );
      }
    } catch (error) {
      console.error('Failed to delete linked appointment:', error);
      // Don't throw error as this is a secondary operation
    }
  }

  /**
  * Fetches aggregate statistics for shipments.
  * @example
  * getShipmentStats()
  * { success: true, data: { total: 5, prepared: 1, shipped: 2, inTransit: 1, delivered: 1, cancelled: 0, totalValue: 1234.56 } }
  * @returns {{Promise<{success: boolean, data?: {total: number, prepared: number, shipped: number, inTransit: number, delivered: number, cancelled: number, totalValue: number}, error?: string}>}} Promise resolving with shipment statistics or an error.
  **/
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