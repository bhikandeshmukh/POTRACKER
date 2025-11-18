'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { getVendors, addVendor, updateVendor, deleteVendor, Vendor } from '@/lib/firestore';
import { Plus, Building2, Edit, Trash2, Save, X, Archive, Mail, Download, Search } from 'lucide-react';
import { getThemeClasses } from '@/styles/theme';
import { useToast } from '@/components/ToastContainer';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useFormValidation, ValidationSchema } from '@/hooks/useFormValidation';
import FileUpload, { UploadedFile } from '@/components/FileUpload';
import { useBulkActions, BulkAction } from '@/hooks/useBulkActions';
import BulkActionsToolbar from '@/components/BulkActionsToolbar';
import Pagination, { usePagination } from '@/components/Pagination';
import AdvancedSearch from '@/components/AdvancedSearch';
import DataImportExport from '@/components/DataImportExport';

export default function VendorsPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);

  // Pagination
  const {
    currentPage,
    totalPages,
    itemsPerPage,
    paginatedItems: paginatedVendors,
    totalItems,
    setCurrentPage,
    setItemsPerPage
  } = usePagination(vendors, 12);

  // Bulk actions configuration
  const bulkActions: BulkAction[] = [
    {
      id: 'delete',
      label: 'Delete Selected',
      icon: Trash2,
      color: 'red',
      confirmMessage: 'Are you sure you want to delete {count} vendor(s)? This action cannot be undone.',
      action: async (selectedIds: string[]) => {
        for (const id of selectedIds) {
          const vendor = vendors.find(v => v.id === id);
          await deleteVendor(id, user?.uid || undefined, user?.email || undefined, vendor?.name);
        }
        loadVendors();
      }
    },
    {
      id: 'archive',
      label: 'Archive Selected',
      icon: Archive,
      color: 'yellow',
      confirmMessage: 'Archive {count} vendor(s)?',
      action: async (selectedIds: string[]) => {
        // Archive functionality would be implemented here
        console.log('Archiving vendors:', selectedIds);
      }
    },
    {
      id: 'export',
      label: 'Export Selected',
      icon: Download,
      color: 'blue',
      action: async (selectedIds: string[]) => {
        const selectedVendors = vendors.filter(v => selectedIds.includes(v.id!));
        const csvContent = [
          'Name,Contact Person,Phone,Email,GST,Address',
          ...selectedVendors.map(v => 
            `"${v.name}","${v.contactPerson}","${v.phone}","${v.email || ''}","${v.gst || ''}","${v.address || ''}"`
          )
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vendors-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    },
    {
      id: 'email',
      label: 'Send Email',
      icon: Mail,
      color: 'green',
      action: async (selectedIds: string[]) => {
        const selectedVendors = vendors.filter(v => selectedIds.includes(v.id!) && v.email);
        if (selectedVendors.length === 0) {
          throw new Error('No vendors with email addresses selected');
        }
        // Email functionality would be implemented here
        console.log('Sending emails to:', selectedVendors.map(v => v.email));
      }
    }
  ];

  const {
    selectedIds,
    selectedCount,
    isProcessing,
    toggleSelection,
    toggleSelectAll,
    clearSelection,
    executeBulkAction,
    isSelected,
    isAllSelected,
    isIndeterminate
  } = useBulkActions(vendors, bulkActions);

  // Form validation schema
  const validationSchema: ValidationSchema = {
    name: { required: true, minLength: 2, maxLength: 100 },
    contactPerson: { required: true, minLength: 2, maxLength: 50 },
    phone: { required: true, phone: true },
    email: { email: true },
    gst: { gst: true },
    address: { maxLength: 200 }
  };

  const {
    values: formData,
    errors: formErrors,
    touched,
    handleChange,
    handleBlur,
    validateForm,
    resetForm
  } = useFormValidation({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    gst: '',
    address: '',
  }, validationSchema);

  const [editFormData, setEditFormData] = useState<Vendor>({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    gst: '',
    address: '',
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadVendors();
    }
  }, [user]);

  const loadVendors = async () => {
    try {
      console.log('Loading vendors...');
      const vendorList = await getVendors();
      console.log('Vendors loaded:', vendorList);
      setVendors(vendorList);
    } catch (error) {
      console.error('Error loading vendors:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      showError('Validation Error', 'Please fix the errors in the form');
      return;
    }

    try {
      await addVendor(formData, user?.uid || undefined, user?.email || undefined);
      showSuccess('Vendor Added', `${formData.name} has been added successfully`);
      resetForm();
      setUploadedFiles([]);
      setShowForm(false);
      loadVendors();
    } catch (error: any) {
      console.error('Error adding vendor:', error);
      showError('Failed to Add Vendor', error.message);
    }
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor.id!);
    setEditFormData(vendor);
  };

  const handleUpdate = async (vendorId: string) => {
    try {
      await updateVendor(vendorId, editFormData, user?.uid || undefined, user?.email || undefined);
      showSuccess('Vendor Updated', `${editFormData.name} has been updated successfully`);
      setEditingVendor(null);
      loadVendors();
    } catch (error: any) {
      console.error('Error updating vendor:', error);
      showError('Failed to Update Vendor', error.message);
    }
  };

  const handleDelete = async (vendorId: string, vendorName: string) => {
    if (confirm(`Are you sure you want to delete "${vendorName}"?`)) {
      try {
        await deleteVendor(vendorId, user?.uid || undefined, user?.email || undefined, vendorName);
        showSuccess('Vendor Deleted', `${vendorName} has been deleted successfully`);
        loadVendors();
      } catch (error: any) {
        console.error('Error deleting vendor:', error);
        showError('Failed to Delete Vendor', error.message);
      }
    }
  };

  const cancelEdit = () => {
    setEditingVendor(null);
    setEditFormData({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      gst: '',
      address: '',
    });
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading vendors..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <Sidebar />
      
      <div className="pt-16">
        <main className="w-full p-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className={getThemeClasses.pageTitle()}>Vendors ({vendors.length})</h1>
            <div className="flex items-center space-x-3">
              {/* Search Button */}
              <button
                onClick={() => setShowAdvancedSearch(true)}
                className={`flex items-center space-x-2 ${getThemeClasses.buttonPadding()} ${getThemeClasses.button('secondary')}`}
              >
                <Search className={getThemeClasses.icon('small')} />
                <span>Search</span>
              </button>

              {/* Import/Export Button */}
              {userData?.role === 'Admin' && (
                <button
                  onClick={() => setShowImportExport(true)}
                  className={`flex items-center space-x-2 ${getThemeClasses.buttonPadding()} ${getThemeClasses.button('secondary')}`}
                >
                  <Download className={getThemeClasses.icon('small')} />
                  <span>Import/Export</span>
                </button>
              )}

              {/* Add Vendor Button */}
              {userData?.role === 'Admin' && (
                <button
                  onClick={() => setShowForm(!showForm)}
                  className={`flex items-center space-x-2 ${getThemeClasses.buttonPadding()} ${getThemeClasses.button('primary')}`}
                >
                  <Plus className={getThemeClasses.icon('medium')} />
                  <span>Add Vendor</span>
                </button>
              )}
            </div>
          </div>

          {showForm && (
            <div className={`${getThemeClasses.card()} ${getThemeClasses.sectionPadding()} mb-6`}>
              <h2 className={getThemeClasses.sectionHeading()}>Add New Vendor</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Row 1: Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={`block ${getThemeClasses.description()} mb-2 font-medium`}>
                      Vendor Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      onBlur={() => handleBlur('name')}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        formErrors.name && touched.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="ABC Company Ltd"
                    />
                    {formErrors.name && touched.name && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                    )}
                  </div>
                  <div>
                    <label className={`block ${getThemeClasses.description()} mb-2 font-medium`}>
                      Contact Person *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.contactPerson}
                      onChange={(e) => handleChange('contactPerson', e.target.value)}
                      onBlur={() => handleBlur('contactPerson')}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        formErrors.contactPerson && touched.contactPerson ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="John Doe"
                    />
                    {formErrors.contactPerson && touched.contactPerson && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.contactPerson}</p>
                    )}
                  </div>
                  <div>
                    <label className={`block ${getThemeClasses.description()} mb-2 font-medium`}>
                      Phone *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      onBlur={() => handleBlur('phone')}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        formErrors.phone && touched.phone ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="9876543210"
                    />
                    {formErrors.phone && touched.phone && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.phone}</p>
                    )}
                  </div>
                </div>

                {/* Row 2: Contact Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block ${getThemeClasses.description()} mb-2 font-medium`}>
                      Email ID
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      onBlur={() => handleBlur('email')}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        formErrors.email && touched.email ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="vendor@company.com"
                    />
                    {formErrors.email && touched.email && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                    )}
                  </div>
                  <div>
                    <label className={`block ${getThemeClasses.description()} mb-2 font-medium`}>
                      GST Number
                    </label>
                    <input
                      type="text"
                      value={formData.gst}
                      onChange={(e) => handleChange('gst', e.target.value)}
                      onBlur={() => handleBlur('gst')}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        formErrors.gst && touched.gst ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="22AAAAA0000A1Z5"
                    />
                    {formErrors.gst && touched.gst && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.gst}</p>
                    )}
                  </div>
                </div>

                {/* Row 3: Address */}
                <div>
                  <label className={`block ${getThemeClasses.description()} mb-2 font-medium`}>
                    Address
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    onBlur={() => handleBlur('address')}
                    rows={3}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      formErrors.address && touched.address ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Complete address with city, state, pincode"
                  />
                  {formErrors.address && touched.address && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.address}</p>
                  )}
                </div>

                {/* File Upload */}
                <div>
                  <label className={`block ${getThemeClasses.description()} mb-2 font-medium`}>
                    Documents (Optional)
                  </label>
                  <FileUpload
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    maxSize={5}
                    maxFiles={3}
                    onFilesChange={setUploadedFiles}
                  />
                </div>
                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className={`${getThemeClasses.buttonPadding()} ${getThemeClasses.button('secondary')}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`${getThemeClasses.buttonPadding()} ${getThemeClasses.button('primary')}`}
                  >
                    Add Vendor
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedVendors.map((vendor) => (
              <div key={vendor.id} className={`bg-white rounded-lg shadow-sm border p-6 transition-all ${
                isSelected(vendor.id!) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}>
                {editingVendor === vendor.id ? (
                  // Edit Mode
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name</label>
                      <input
                        type="text"
                        value={editFormData.name}
                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                      <input
                        type="text"
                        value={editFormData.contactPerson}
                        onChange={(e) => setEditFormData({ ...editFormData, contactPerson: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={editFormData.phone}
                        onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={editFormData.email || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">GST</label>
                      <input
                        type="text"
                        value={editFormData.gst || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, gst: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <textarea
                        value={editFormData.address || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={cancelEdit}
                        className={`flex items-center space-x-1 ${getThemeClasses.smallButtonPadding()} ${getThemeClasses.button('secondary')}`}
                      >
                        <X className={getThemeClasses.icon('small')} />
                        <span>Cancel</span>
                      </button>
                      <button
                        onClick={() => handleUpdate(vendor.id!)}
                        className={`flex items-center space-x-1 ${getThemeClasses.smallButtonPadding()} ${getThemeClasses.button('primary')}`}
                      >
                        <Save className={getThemeClasses.icon('small')} />
                        <span>Save</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start space-x-4">
                        {userData?.role === 'Admin' && (
                          <input
                            type="checkbox"
                            checked={isSelected(vendor.id!)}
                            onChange={() => toggleSelection(vendor.id!)}
                            className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        )}
                        <div className={`p-3 ${getThemeClasses.color('blue')} rounded-lg`}>
                          <Building2 className={getThemeClasses.icon('large')} />
                        </div>
                        <div className="flex-1">
                          <h3 className={`${getThemeClasses.cardTitle()} mb-2`}>{vendor.name}</h3>
                        </div>
                      </div>
                      {userData?.role === 'Admin' && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(vendor)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                            title="Edit Vendor"
                          >
                            <Edit className={getThemeClasses.icon('small')} />
                          </button>
                          <button
                            onClick={() => handleDelete(vendor.id!, vendor.name)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded"
                            title="Delete Vendor"
                          >
                            <Trash2 className={getThemeClasses.icon('small')} />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className={`${getThemeClasses.description()} space-y-1`}>
                      <p><span className="font-medium">Contact:</span> {vendor.contactPerson}</p>
                      <p><span className="font-medium">Phone:</span> {vendor.phone}</p>
                      {vendor.email && (
                        <p><span className="font-medium">Email:</span> {vendor.email}</p>
                      )}
                      {vendor.gst && (
                        <p><span className="font-medium">GST:</span> {vendor.gst}</p>
                      )}
                      {vendor.address && (
                        <p><span className="font-medium">Address:</span> {vendor.address}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {vendors.length === 0 && (
            <div className="text-center py-12">
              <Building2 className={`${getThemeClasses.icon('extraLarge')} text-gray-400 mx-auto mb-4`} />
              <p className={getThemeClasses.description()}>No vendors yet. Add your first vendor!</p>
            </div>
          )}

          {/* Pagination */}
          {vendors.length > 0 && (
            <div className="mt-8">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
              />
            </div>
          )}
        </main>

        {/* Bulk Actions Toolbar */}
        {userData?.role === 'Admin' && (
          <BulkActionsToolbar
            selectedCount={selectedCount}
            totalCount={vendors.length}
            isAllSelected={isAllSelected()}
            isIndeterminate={isIndeterminate()}
            isProcessing={isProcessing}
            actions={bulkActions}
            onToggleSelectAll={toggleSelectAll}
            onClearSelection={clearSelection}
            onExecuteAction={executeBulkAction}
          />
        )}

        {/* Advanced Search Modal */}
        <AdvancedSearch
          isOpen={showAdvancedSearch}
          onClose={() => setShowAdvancedSearch(false)}
        />

        {/* Import/Export Modal */}
        <DataImportExport
          type="vendors"
          isOpen={showImportExport}
          onClose={() => setShowImportExport(false)}
          onImportComplete={loadVendors}
        />
      </div>
    </div>
  );
}
