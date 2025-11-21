'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { getVendors, addVendor, updateVendor, deleteVendor, Vendor, Warehouse } from '@/lib/firestore';
import { Plus, Building2, Edit, Trash2, Save, X, Archive, Mail, Download, Search, MapPin, Phone, User, Building, ChevronDown, ChevronRight, Warehouse as WarehouseIcon } from 'lucide-react';
import { getThemeClasses } from '@/styles/theme';
import { useToast } from '@/components/ToastContainer';
import LoadingSpinner from '@/components/LoadingSpinner';
import DataImportExport from '@/components/DataImportExport';

export default function VendorsPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState<string | null>(null);
  const [showImportExport, setShowImportExport] = useState(false);
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());
  const [showWarehouseForm, setShowWarehouseForm] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState<Vendor>({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    gst: '',
    address: '',
    warehouses: []
  });

  const [warehouseFormData, setWarehouseFormData] = useState<Warehouse>({
    id: '',
    name: '',
    address: '',
    contactPerson: '',
    phone: '',
    email: '',
    capacity: 0,
    type: 'main',
    isActive: true
  });

  // Filter vendors based on search term
  const filteredVendors = vendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.phone.includes(searchTerm) ||
    (vendor.email && vendor.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
    
    if (!formData.name || !formData.contactPerson || !formData.phone) {
      showError('Validation Error', 'Please fill in all required fields');
      return;
    }

    try {
      await addVendor(formData, user?.uid || undefined, user?.email || undefined);
      showSuccess('Vendor Added', `${formData.name} has been added successfully`);
      resetForm();
      setShowForm(false);
      loadVendors();
    } catch (error: any) {
      console.error('Error adding vendor:', error);
      showError('Failed to Add Vendor', error.message);
    }
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor.id!);
    setFormData(vendor);
  };

  const handleUpdate = async (vendorId: string) => {
    try {
      await updateVendor(vendorId, formData, user?.uid || undefined, user?.email || undefined);
      showSuccess('Vendor Updated', `${formData.name} has been updated successfully`);
      setEditingVendor(null);
      resetForm();
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

  const resetForm = () => {
    setFormData({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      gst: '',
      address: '',
      warehouses: []
    });
  };

  const toggleVendorExpansion = (vendorId: string) => {
    const newExpanded = new Set(expandedVendors);
    if (newExpanded.has(vendorId)) {
      newExpanded.delete(vendorId);
    } else {
      newExpanded.add(vendorId);
    }
    setExpandedVendors(newExpanded);
  };

  const handleAddWarehouse = (vendorId: string) => {
    setShowWarehouseForm(vendorId);
    setWarehouseFormData({
      id: '',
      name: '',
      address: '',
      contactPerson: '',
      phone: '',
      email: '',
      capacity: 0,
      type: 'main',
      isActive: true
    });
  };

  const handleWarehouseSubmit = async (vendorId: string) => {
    try {
      const vendor = vendors.find(v => v.id === vendorId);
      if (!vendor) return;

      const newWarehouse: Warehouse = {
        ...warehouseFormData,
        id: `WH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };

      const updatedVendor = {
        ...vendor,
        warehouses: [...(vendor.warehouses || []), newWarehouse]
      };

      await updateVendor(vendorId, updatedVendor, user?.uid || undefined, user?.email || undefined);
      showSuccess('Warehouse Added', `${newWarehouse.name} has been added successfully`);
      setShowWarehouseForm(null);
      loadVendors();
    } catch (error: any) {
      console.error('Error adding warehouse:', error);
      showError('Failed to Add Warehouse', error.message);
    }
  };

  const handleDeleteWarehouse = async (vendorId: string, warehouseId: string) => {
    if (confirm('Are you sure you want to delete this warehouse?')) {
      try {
        const vendor = vendors.find(v => v.id === vendorId);
        if (!vendor) return;

        const updatedVendor = {
          ...vendor,
          warehouses: (vendor.warehouses || []).filter(w => w.id !== warehouseId)
        };

        await updateVendor(vendorId, updatedVendor, user?.uid || undefined, user?.email || undefined);
        showSuccess('Warehouse Deleted', 'Warehouse has been deleted successfully');
        loadVendors();
      } catch (error: any) {
        console.error('Error deleting warehouse:', error);
        showError('Failed to Delete Warehouse', error.message);
      }
    }
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
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className={getThemeClasses.pageTitle()}>Vendors ({filteredVendors.length})</h1>
              <p className={getThemeClasses.description()}>Manage your vendor network and warehouses</p>
            </div>
            <div className="flex items-center space-x-3">
              {/* Import/Export Button */}
              {userData?.role === 'Admin' && (
                <button
                  onClick={() => setShowImportExport(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  <Download className="w-5 h-5" />
                  <span>Import/Export</span>
                </button>
              )}

              {/* Add Vendor Button */}
              {userData?.role === 'Admin' && (
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <Plus className="w-5 h-5" />
                  <span>Add Vendor</span>
                </button>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search vendors by name, contact person, phone, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Add/Edit Vendor Form */}
          {showForm && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
              </h2>
              <form onSubmit={editingVendor ? () => handleUpdate(editingVendor) : handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vendor Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="ABC Company Ltd"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Contact Person *</label>
                    <input
                      type="text"
                      required
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="9876543210"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="vendor@company.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">GST Number</label>
                    <input
                      type="text"
                      value={formData.gst || ''}
                      onChange={(e) => setFormData({ ...formData, gst: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="22AAAAA0000A1Z5"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                  <textarea
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Complete address with city, state, pincode"
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingVendor(null);
                      resetForm();
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    {editingVendor ? 'Update' : 'Add'} Vendor
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Vendors List */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {filteredVendors.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Vendors Found</h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm ? 'No vendors match your search criteria' : 'Add your first vendor to get started'}
                </p>
                {userData?.role === 'Admin' && !searchTerm && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Vendor</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredVendors.map((vendor) => (
                  <div key={vendor.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{vendor.name}</h3>
                            <button
                              onClick={() => toggleVendorExpansion(vendor.id!)}
                              className="p-1 text-gray-400 hover:text-gray-600 rounded"
                            >
                              {expandedVendors.has(vendor.id!) ? (
                                <ChevronDown className="w-5 h-5" />
                              ) : (
                                <ChevronRight className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                            <div className="flex items-center space-x-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <span>{vendor.contactPerson}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Phone className="w-4 h-4 text-gray-400" />
                              <span>{vendor.phone}</span>
                            </div>
                            {vendor.email && (
                              <div className="flex items-center space-x-2">
                                <Mail className="w-4 h-4 text-gray-400" />
                                <span>{vendor.email}</span>
                              </div>
                            )}
                          </div>

                          {vendor.gst && (
                            <div className="mt-2 text-sm text-gray-600">
                              <span className="font-medium">GST:</span> {vendor.gst}
                            </div>
                          )}

                          {vendor.address && (
                            <div className="mt-2 text-sm text-gray-600">
                              <div className="flex items-start space-x-2">
                                <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                                <span>{vendor.address}</span>
                              </div>
                            </div>
                          )}

                          {/* Warehouses Summary */}
                          {vendor.warehouses && vendor.warehouses.length > 0 && (
                            <div className="mt-3 flex items-center space-x-2 text-sm">
                              <WarehouseIcon className="w-4 h-4 text-blue-500" />
                              <span className="text-blue-600 font-medium">
                                {vendor.warehouses.length} Warehouse{vendor.warehouses.length > 1 ? 's' : ''}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      {userData?.role === 'Admin' && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleAddWarehouse(vendor.id!)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                            title="Add Warehouse"
                          >
                            <WarehouseIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleEdit(vendor)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                            title="Edit Vendor"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(vendor.id!, vendor.name)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition"
                            title="Delete Vendor"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Expanded Warehouses Section */}
                    {expandedVendors.has(vendor.id!) && (
                      <div className="mt-6 pl-16">
                        <div className="border-t border-gray-200 pt-4">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-md font-medium text-gray-900">Warehouses</h4>
                            {userData?.role === 'Admin' && (
                              <button
                                onClick={() => handleAddWarehouse(vendor.id!)}
                                className="flex items-center space-x-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                              >
                                <Plus className="w-4 h-4" />
                                <span>Add Warehouse</span>
                              </button>
                            )}
                          </div>

                          {vendor.warehouses && vendor.warehouses.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {vendor.warehouses.map((warehouse) => (
                                <div key={warehouse.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2 mb-2">
                                        <h5 className="font-medium text-gray-900">{warehouse.name}</h5>
                                        <span className={`px-2 py-1 text-xs rounded-full ${
                                          warehouse.isActive 
                                            ? 'bg-green-100 text-green-800' 
                                            : 'bg-red-100 text-red-800'
                                        }`}>
                                          {warehouse.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full capitalize">
                                          {warehouse.type}
                                        </span>
                                      </div>
                                      <div className="text-sm text-gray-600 space-y-1">
                                        <div className="flex items-start space-x-2">
                                          <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                                          <span>{warehouse.address}</span>
                                        </div>
                                        {warehouse.contactPerson && (
                                          <div className="flex items-center space-x-2">
                                            <User className="w-4 h-4 text-gray-400" />
                                            <span>{warehouse.contactPerson}</span>
                                          </div>
                                        )}
                                        {warehouse.phone && (
                                          <div className="flex items-center space-x-2">
                                            <Phone className="w-4 h-4 text-gray-400" />
                                            <span>{warehouse.phone}</span>
                                          </div>
                                        )}
                                        {warehouse.capacity && (
                                          <div className="text-xs text-gray-500">
                                            Capacity: {warehouse.capacity} units
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    {userData?.role === 'Admin' && (
                                      <button
                                        onClick={() => handleDeleteWarehouse(vendor.id!, warehouse.id)}
                                        className="p-1 text-red-600 hover:bg-red-100 rounded transition"
                                        title="Delete Warehouse"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              <WarehouseIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                              <p>No warehouses added yet</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </main>

        {/* Warehouse Form Modal */}
        {showWarehouseForm && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowWarehouseForm(null)} />
            <div className="relative min-h-screen flex items-center justify-center p-4">
              <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Add New Warehouse</h3>
                  <button
                    onClick={() => setShowWarehouseForm(null)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="p-6">
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    handleWarehouseSubmit(showWarehouseForm);
                  }} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Warehouse Name *</label>
                        <input
                          type="text"
                          required
                          value={warehouseFormData.name}
                          onChange={(e) => setWarehouseFormData({ ...warehouseFormData, name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Main Warehouse"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                        <select
                          value={warehouseFormData.type}
                          onChange={(e) => setWarehouseFormData({ ...warehouseFormData, type: e.target.value as any })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="main">Main</option>
                          <option value="secondary">Secondary</option>
                          <option value="distribution">Distribution</option>
                          <option value="storage">Storage</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Address *</label>
                      <textarea
                        required
                        value={warehouseFormData.address}
                        onChange={(e) => setWarehouseFormData({ ...warehouseFormData, address: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Complete warehouse address"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Contact Person</label>
                        <input
                          type="text"
                          value={warehouseFormData.contactPerson || ''}
                          onChange={(e) => setWarehouseFormData({ ...warehouseFormData, contactPerson: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Warehouse Manager"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                        <input
                          type="tel"
                          value={warehouseFormData.phone || ''}
                          onChange={(e) => setWarehouseFormData({ ...warehouseFormData, phone: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="9876543210"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                        <input
                          type="email"
                          value={warehouseFormData.email || ''}
                          onChange={(e) => setWarehouseFormData({ ...warehouseFormData, email: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="warehouse@company.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Capacity (units)</label>
                        <input
                          type="number"
                          value={warehouseFormData.capacity || ''}
                          onChange={(e) => setWarehouseFormData({ ...warehouseFormData, capacity: parseInt(e.target.value) || 0 })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="1000"
                        />
                      </div>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="isActive"
                        checked={warehouseFormData.isActive}
                        onChange={(e) => setWarehouseFormData({ ...warehouseFormData, isActive: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                        Active warehouse
                      </label>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowWarehouseForm(null)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                      >
                        Add Warehouse
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

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
