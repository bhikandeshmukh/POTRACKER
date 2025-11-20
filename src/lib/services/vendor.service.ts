import { Vendor, CreateVendorForm } from '../types';
import { BaseService } from './base.service';
import { auditService } from './audit.service';

export class VendorService extends BaseService<Vendor> {
  constructor() {
    super('vendors');
  }

  private vendorNameToDocId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async createVendor(
    formData: CreateVendorForm,
    createdBy: { uid: string; name: string; role: string }
  ) {
    try {
      const docId = this.vendorNameToDocId(formData.name);
      
      const result = await this.create(formData, docId);

      if (result.success) {
        // Log audit event
        await auditService.logEvent(
          createdBy.uid,
          createdBy.name,
          createdBy.role,
          'create',
          'vendor',
          docId,
          formData.name,
          `Created vendor ${formData.name}`,
          undefined,
          {
            contactPerson: formData.contactPerson,
            phone: formData.phone,
            email: formData.email,
            gst: formData.gst
          }
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'create vendor').message
      };
    }
  }

  async updateVendor(
    id: string,
    updateData: Partial<Vendor>,
    updatedBy: { uid: string; name: string; role: string }
  ) {
    try {
      // Get current vendor to track changes
      const currentResult = await this.findById(id);
      if (!currentResult.success || !currentResult.data) {
        return {
          success: false,
          error: 'Vendor not found'
        };
      }

      const currentVendor = currentResult.data;
      const result = await this.update(id, updateData);

      if (result.success) {
        // Track changes for audit
        const changes: Record<string, { old: any; new: any }> = {};
        Object.keys(updateData).forEach(key => {
          const oldValue = (currentVendor as any)[key];
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
          'vendor',
          id,
          updateData.name || currentVendor.name,
          `Updated vendor ${updateData.name || currentVendor.name}`,
          changes
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'update vendor').message
      };
    }
  }

  async deleteVendor(
    id: string,
    deletedBy: { uid: string; name: string; role: string }
  ) {
    try {
      // Get vendor name before deletion
      const currentResult = await this.findById(id);
      const vendorName = currentResult.data?.name || 'Unknown Vendor';

      const result = await this.delete(id);

      if (result.success) {
        // Log audit event
        await auditService.logEvent(
          deletedBy.uid,
          deletedBy.name,
          deletedBy.role,
          'delete',
          'vendor',
          id,
          vendorName,
          `Deleted vendor ${vendorName}`
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'delete vendor').message
      };
    }
  }

  async searchVendors(searchTerm: string) {
    const result = await this.findMany();
    
    if (result.success && result.data) {
      const filteredVendors = result.data.data.filter(vendor => 
        vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (vendor.gst && vendor.gst.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (vendor.email && vendor.email.toLowerCase().includes(searchTerm.toLowerCase()))
      );

      return {
        success: true,
        data: {
          ...result.data,
          data: filteredVendors,
          total: filteredVendors.length
        }
      };
    }

    return result;
  }
}

export const vendorService = new VendorService();