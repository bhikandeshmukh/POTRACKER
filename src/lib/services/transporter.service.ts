import { Transporter } from '../types';
import { BaseService } from './base.service';
import { auditService } from './audit.service';

export class TransporterService extends BaseService<Transporter> {
  constructor() {
    super('transporters');
  }

  private transporterNameToDocId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async createTransporter(
    transporterData: Omit<Transporter, 'id' | 'createdAt' | 'updatedAt'>,
    createdBy: { uid: string; name: string; role: string }
  ) {
    try {
      const docId = this.transporterNameToDocId(transporterData.name);
      
      const result = await this.create(transporterData, docId);

      if (result.success) {
        // Log audit event
        await auditService.logEvent(
          createdBy.uid,
          createdBy.name,
          createdBy.role,
          'create',
          'transporter',
          docId,
          transporterData.name,
          `Created transporter ${transporterData.name}`,
          undefined,
          {
            contactPerson: transporterData.contactPerson,
            phone: transporterData.phone,
            vehicleNumber: transporterData.vehicleNumber,
            vehicleType: transporterData.vehicleType
          }
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'create transporter').message
      };
    }
  }

  async updateTransporter(
    id: string,
    updateData: Partial<Transporter>,
    updatedBy: { uid: string; name: string; role: string }
  ) {
    try {
      // Get current transporter to track changes
      const currentResult = await this.findById(id);
      if (!currentResult.success || !currentResult.data) {
        return {
          success: false,
          error: 'Transporter not found'
        };
      }

      const currentTransporter = currentResult.data;
      const result = await this.update(id, updateData);

      if (result.success) {
        // Track changes for audit
        const changes: Record<string, { old: any; new: any }> = {};
        Object.keys(updateData).forEach(key => {
          const oldValue = (currentTransporter as any)[key];
          const newValue = (updateData as any)[key];
          if (oldValue !== newValue) {
            changes[key] = { old: oldValue, new: newValue };
          }
        });

        // Log audit event
        await auditService.logEvent(
          updatedBy.uid,
          updatedBy.name,
          updatedBy.role,
          'update',
          'transporter',
          id,
          updateData.name || currentTransporter.name,
          `Updated transporter ${updateData.name || currentTransporter.name}`,
          changes
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'update transporter').message
      };
    }
  }

  async deleteTransporter(
    id: string,
    deletedBy: { uid: string; name: string; role: string }
  ) {
    try {
      // Get transporter name before deletion
      const currentResult = await this.findById(id);
      const transporterName = currentResult.data?.name || 'Unknown Transporter';

      const result = await this.delete(id);

      if (result.success) {
        // Log audit event
        await auditService.logEvent(
          deletedBy.uid,
          deletedBy.name,
          deletedBy.role,
          'delete',
          'transporter',
          id,
          transporterName,
          `Deleted transporter ${transporterName}`
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'delete transporter').message
      };
    }
  }

  async getActiveTransporters() {
    return this.findMany({
      where: [{ field: 'active', operator: '==', value: true }],
      orderBy: 'name',
      orderDirection: 'asc'
    });
  }

  async searchTransporters(searchTerm: string) {
    const result = await this.findMany();
    
    if (result.success && result.data) {
      const filteredTransporters = result.data.data.filter(transporter => 
        transporter.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transporter.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (transporter.vehicleNumber && transporter.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (transporter.driverName && transporter.driverName.toLowerCase().includes(searchTerm.toLowerCase()))
      );

      return {
        success: true,
        data: {
          ...result.data,
          data: filteredTransporters,
          total: filteredTransporters.length
        }
      };
    }

    return result;
  }
}

export const transporterService = new TransporterService();