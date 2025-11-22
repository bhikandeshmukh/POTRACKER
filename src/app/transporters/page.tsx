'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { getTransporters, addTransporter, updateTransporter, deleteTransporter, Transporter, Warehouse } from '@/lib/firestore';
import { Truck, Plus, Edit, Trash2, Phone, Mail, User, MapPin, FileText, X, Save, Search, ChevronDown, ChevronRight, Warehouse as WarehouseIcon, Download } from 'lucide-react';
import { getThemeClasses } from '@/styles/theme';
import { useToast } from '@/components/ToastContainer';
import LoadingSpinner from '@/components/LoadingSpinner';
import DataImportExport from '@/components/DataImportExport';

export default function TransportersPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTransporter, setEditingTransporter] = useState<string | null>(null);
  const [showImportExport, setShowImportExport] = useState(false);
  const [expandedTransporters, setExpandedTransporters] = useState<Set<string>>(new Set());
  const [showWarehouseForm, setShowWarehouseForm] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState<Transporter>({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    vehicleNumber: '',
    vehicleType: '',
    driverName: '',
    driverPhone: '',
    address: '',
    gst: '',
    panNumber: '',
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

  // Filter transporters based on search term
  const filteredTransporters = transporters.filter(transporter =>
    transporter.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transporter.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transporter.phone.includes(searchTerm) ||
    (transporter.email && transporter.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (transporter.vehicleNumber && transporter.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const loadTransporters = useCallback(async () => {
    try {
      const data = await getTransporters();
      setTransporters(data);
    } catch (error) {
      console.error('Error loading transporters:', error);
      showError('Error', 'Failed to load transporters');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadTransporters();
    }
  }, [user, loadTransporters]);

  /****
  * Handles the submission of the transporter form by validating input, creating a transporter, and refreshing the list.
  * @example
  * sync(event)
  * undefined
  * @param {{React.FormEvent}} {{e}} - The form event triggered by submission.
  * @returns {{Promise<void>}} Void promise resolved after processing the form submission.
  ****/
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.contactPerson || !formData.phone) {
      showError('Validation Error', 'Please fill in all required fields');
      return;
    }

    try {
      await addTransporter(formData, user?.uid || undefined, user?.email || undefined);
      showSuccess('Transporter Added', `${formData.name} has been added successfully`);
      resetForm();
      setShowForm(false);
      loadTransporters();
    } catch (error: any) {
      console.error('Error adding transporter:', error);
      showError('Failed to Add Transporter', error.message);
    }
  };

  const handleEdit = (transporter: Transporter) => {
    setEditingTransporter(transporter.id!);
    setFormData(transporter);
  };

  /**
  * Synchronizes transporter data by updating the transporter form and refreshing the list.
  * @example
  * sync('transporterId123')
  * undefined
  * @param {{string}} {{transporterId}} - Identifier of the transporter to synchronize.
  * @returns {{Promise<void>}} Promise resolving when the transporter update process completes.
  **/
  const handleUpdate = async (transporterId: string) => {
    try {
      await updateTransporter(transporterId, formData, user?.uid || undefined, user?.email || undefined);
      showSuccess('Transporter Updated', `${formData.name} has been updated successfully`);
      setEditingTransporter(null);
      resetForm();
      loadTransporters();
    } catch (error: any) {
      console.error('Error updating transporter:', error);
      showError('Failed to Update Transporter', error.message);
    }
  };

  /**
  * Prompts for confirmation before deleting the specified transporter and refreshes the transporter list on success.
  * @example
  * sync('transporter123', 'Acme Transport')
  * undefined
  * @param {{string}} {{transporterId}} - The ID of the transporter to delete.
  * @param {{string}} {{transporterName}} - The name of the transporter to display in the confirmation dialog and messages.
  * @returns {{Promise<void>}} Completes after attempting to delete the transporter, showing success or error feedback.
  **/
  const handleDelete = async (transporterId: string, transporterName: string) => {
    if (confirm(`Are you sure you want to delete "${transporterName}"?`)) {
      try {
        await deleteTransporter(transporterId, user?.uid || undefined, user?.email || undefined, transporterName);
        showSuccess('Transporter Deleted', `${transporterName} has been deleted successfully`);
        loadTransporters();
      } catch (error: any) {
        console.error('Error deleting transporter:', error);
        showError('Failed to Delete Transporter', error.message);
      }
    }
  };

  /**
  * Resets transporter form state to default empty values.
  * @example
  * resetTransporterForm()
  * undefined
  * @returns {void} Undefined since the function only updates form state.
  **/
  const resetForm = () => {
    setFormData({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      vehicleNumber: '',
      vehicleType: '',
      driverName: '',
      driverPhone: '',
      address: '',
      gst: '',
      panNumber: '',
      warehouses: []
    });
  };

  const toggleTransporterExpansion = (transporterId: string) => {
    const newExpanded = new Set(expandedTransporters);
    if (newExpanded.has(transporterId)) {
      newExpanded.delete(transporterId);
    } else {
      newExpanded.add(transporterId);
    }
    setExpandedTransporters(newExpanded);
  };

  /**
  * Initializes the warehouse form state for the given transporter identifier.
  * @example
  * openWarehouseForm('transporter-123')
  * undefined
  * @param {{string}} transporterId - Identifier of the transporter to associate the new warehouse with.
  * @returns {{void}} Indicates that no value is returned.
  **/
  const handleAddWarehouse = (transporterId: string) => {
    setShowWarehouseForm(transporterId);
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

  /**
  * Adds a new warehouse to the selected transporter and refreshes the transporter list.
  * @example
  * sync('transporter123')
  * undefined
  * @param {{string}} transporterId - Unique identifier of the transporter to update.
  * @returns {{Promise<void>}} Promise that resolves once the warehouse has been added and related updates run.
  **/
  const handleWarehouseSubmit = async (transporterId: string) => {
    try {
      const transporter = transporters.find(t => t.id === transporterId);
      if (!transporter) return;

      const newWarehouse: Warehouse = {
        ...warehouseFormData,
        id: `WH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };

      const updatedTransporter = {
        ...transporter,
        warehouses: [...(transporter.warehouses || []), newWarehouse]
      };

      await updateTransporter(transporterId, updatedTransporter, user?.uid || undefined, user?.email || undefined);
      showSuccess('Warehouse Added', `${newWarehouse.name} has been added successfully`);
      setShowWarehouseForm(null);
      loadTransporters();
    } catch (error: any) {
      console.error('Error adding warehouse:', error);
      showError('Failed to Add Warehouse', error.message);
    }
  };

  /**
  * Prompts for confirmation and deletes the specified warehouse from the transporter if confirmed.
  * @example
  * sync('transporter123', 'warehouse456')
  * undefined
  * @param {{string}} transporterId - Transporter identifier whose warehouse should be removed.
  * @param {{string}} warehouseId - Identifier of the warehouse to delete.
  * @returns {{Promise<void>}} Resolves when the deletion process and related updates complete.
  **/
  const handleDeleteWarehouse = async (transporterId: string, warehouseId: string) => {
    if (confirm('Are you sure you want to delete this warehouse?')) {
      try {
        const transporter = transporters.find(t => t.id === transporterId);
        if (!transporter) return;

        const updatedTransporter = {
          ...transporter,
          warehouses: (transporter.warehouses || []).filter(w => w.id !== warehouseId)
        };

        await updateTransporter(transporterId, updatedTransporter, user?.uid || undefined, user?.email || undefined);
        showSuccess('Warehouse Deleted', 'Warehouse has been deleted successfully');
        loadTransporters();
      } catch (error: any) {
        console.error('Error deleting warehouse:', error);
        showError('Failed to Delete Warehouse', error.message);
      }
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading transporters..." />
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
              <h1 className={getThemeClasses.pageTitle()}>Transporters ({filteredTransporters.length})</h1>
              <p className={getThemeClasses.description()}>Manage your transportation network and warehouses</p>
            </div>
            <div className="flex items-center space-x-3">
              {/* Import/Export Button */}
              {userData?.role === 'Admin' && (
                <button
                  onClick={() => setShowImportExport(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  <Download className="size-5" />
                  <span>Import/Export</span>
                </button>
              )}

              {/* Add Transporter Button */}
              {userData?.role === 'Admin' && (
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <Plus className="size-5" />
                  <span>Add Transporter</span>
                </button>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-5" />
              <input
                type="text"
                placeholder="Search transporters by name, contact person, phone, email, or vehicle number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Add/Edit Transporter Form */}
          {showForm && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {editingTransporter ? 'Edit Transporter' : 'Add New Transporter'}
              </h2>
              <form onSubmit={editingTransporter ? () => handleUpdate(editingTransporter) : handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Company Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="ABC Transport Ltd"
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
                      placeholder="transport@company.com"
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Number</label>
                    <input
                      type="text"
                      value={formData.vehicleNumber || ''}
                      onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="MH12AB1234"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Type</label>
                    <select
                      value={formData.vehicleType || ''}
                      onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Type</option>
                      <option value="truck">Truck</option>
                      <option value="trailer">Trailer</option>
                      <option value="van">Van</option>
                      <option value="container">Container</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">PAN Number</label>
                    <input
                      type="text"
                      value={formData.panNumber || ''}
                      onChange={(e) => setFormData({ ...formData, panNumber: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="ABCDE1234F"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Driver Name</label>
                    <input
                      type="text"
                      value={formData.driverName || ''}
                      onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Driver Name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Driver Phone</label>
                    <input
                      type="tel"
                      value={formData.driverPhone || ''}
                      onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="9876543210"
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
                      setEditingTransporter(null);
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
                    {editingTransporter ? 'Update' : 'Add'} Transporter
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Transporters List */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {filteredTransporters.length === 0 ? (
              <div className="text-center py-12">
                <Truck className="size-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Transporters Found</h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm ? 'No transporters match your search criteria' : 'Add your first transporter to get started'}
                </p>
                {userData?.role === 'Admin' && !searchTerm && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    <Plus className="size-5" />
                    <span>Add Transporter</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredTransporters.map((transporter) => (
                  <div key={transporter.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg">
                          <Truck className="size-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{transporter.name}</h3>
                            <button
                              onClick={() => toggleTransporterExpansion(transporter.id!)}
                              className="p-1 text-gray-400 hover:text-gray-600 rounded"
                            >
                              {expandedTransporters.has(transporter.id!) ? (
                                <ChevronDown className="size-5" />
                              ) : (
                                <ChevronRight className="size-5" />
                              )}
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                            <div className="flex items-center space-x-2">
                              <User className="size-4 text-gray-400" />
                              <span>{transporter.contactPerson}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Phone className="size-4 text-gray-400" />
                              <span>{transporter.phone}</span>
                            </div>
                            {transporter.email && (
                              <div className="flex items-center space-x-2">
                                <Mail className="size-4 text-gray-400" />
                                <span>{transporter.email}</span>
                              </div>
                            )}
                          </div>

                          {/* Vehicle Information */}
                          {(transporter.vehicleNumber || transporter.vehicleType) && (
                            <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                              {transporter.vehicleNumber && (
                                <div className="flex items-center space-x-2">
                                  <FileText className="size-4 text-gray-400" />
                                  <span>{transporter.vehicleNumber}</span>
                                </div>
                              )}
                              {transporter.vehicleType && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full capitalize">
                                  {transporter.vehicleType}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Driver Information */}
                          {transporter.driverName && (
                            <div className="mt-2 text-sm text-gray-600">
                              <span className="font-medium">Driver:</span> {transporter.driverName}
                              {transporter.driverPhone && <span> • {transporter.driverPhone}</span>}
                            </div>
                          )}

                          {transporter.address && (
                            <div className="mt-2 text-sm text-gray-600">
                              <div className="flex items-start space-x-2">
                                <MapPin className="size-4 text-gray-400 mt-0.5" />
                                <span>{transporter.address}</span>
                              </div>
                            </div>
                          )}

                          {/* Warehouses Summary */}
                          {transporter.warehouses && transporter.warehouses.length > 0 && (
                            <div className="mt-3 flex items-center space-x-2 text-sm">
                              <WarehouseIcon className="size-4 text-blue-500" />
                              <span className="text-blue-600 font-medium">
                                {transporter.warehouses.length} Warehouse{transporter.warehouses.length > 1 ? 's' : ''}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      {userData?.role === 'Admin' && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleAddWarehouse(transporter.id!)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                            title="Add Warehouse"
                          >
                            <WarehouseIcon className="size-5" />
                          </button>
                          <button
                            onClick={() => handleEdit(transporter)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                            title="Edit Transporter"
                          >
                            <Edit className="size-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(transporter.id!, transporter.name)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition"
                            title="Delete Transporter"
                          >
                            <Trash2 className="size-5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Expanded Warehouses Section */}
                    {expandedTransporters.has(transporter.id!) && (
                      <div className="mt-6 pl-16">
                        <div className="border-t border-gray-200 pt-4">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-md font-medium text-gray-900">Warehouses</h4>
                            {userData?.role === 'Admin' && (
                              <button
                                onClick={() => handleAddWarehouse(transporter.id!)}
                                className="flex items-center space-x-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                              >
                                <Plus className="size-4" />
                                <span>Add Warehouse</span>
                              </button>
                            )}
                          </div>

                          {transporter.warehouses && transporter.warehouses.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {transporter.warehouses.map((warehouse) => (
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
                                          <MapPin className="size-4 text-gray-400 mt-0.5" />
                                          <span>{warehouse.address}</span>
                                        </div>
                                        {warehouse.contactPerson && (
                                          <div className="flex items-center space-x-2">
                                            <User className="size-4 text-gray-400" />
                                            <span>{warehouse.contactPerson}</span>
                                          </div>
                                        )}
                                        {warehouse.phone && (
                                          <div className="flex items-center space-x-2">
                                            <Phone className="size-4 text-gray-400" />
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
                                        onClick={() => handleDeleteWarehouse(transporter.id!, warehouse.id)}
                                        className="p-1 text-red-600 hover:bg-red-100 rounded transition"
                                        title="Delete Warehouse"
                                      >
                                        <Trash2 className="size-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              <WarehouseIcon className="size-12 text-gray-300 mx-auto mb-2" />
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
                    <X className="size-5" />
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
                        className="size-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
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
          onImportComplete={loadTransporters}
        />
      </div>
    </div>
  );
}