'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { getTransporters, addTransporter, updateTransporter, deleteTransporter, Transporter } from '@/lib/firestore';
import { Truck, Plus, Edit, Trash2, Phone, Mail, User, MapPin, FileText, X, Save, Search } from 'lucide-react';
import { getThemeClasses } from '@/styles/theme';
import { useToast } from '@/components/ToastContainer';

export default function TransportersPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTransporter, setEditingTransporter] = useState<Transporter | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
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
    active: true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadTransporters();
    }
  }, [user]);

  const loadTransporters = async () => {
    try {
      const data = await getTransporters();
      setTransporters(data);
    } catch (error) {
      console.error('Error loading transporters:', error);
      showError('Error', 'Failed to load transporters');
    } finally {
      setLoadingData(false);
    }
  };

  const handleOpenModal = (transporter?: Transporter) => {
    if (transporter) {
      setEditingTransporter(transporter);
      setFormData({
        name: transporter.name || '',
        contactPerson: transporter.contactPerson || '',
        phone: transporter.phone || '',
        email: transporter.email || '',
        vehicleNumber: transporter.vehicleNumber || '',
        vehicleType: transporter.vehicleType || '',
        driverName: transporter.driverName || '',
        driverPhone: transporter.driverPhone || '',
        address: transporter.address || '',
        gst: transporter.gst || '',
        panNumber: transporter.panNumber || '',
        active: transporter.active !== false
      });
    } else {
      setEditingTransporter(null);
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
        active: true
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTransporter(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.contactPerson || !formData.phone) {
      showError('Validation Error', 'Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      if (editingTransporter) {
        await updateTransporter(editingTransporter.id!, formData, user?.uid, user?.email || '');
        showSuccess('Success', 'Transporter updated successfully');
      } else {
        await addTransporter(formData, user?.uid, user?.email || '');
        showSuccess('Success', 'Transporter added successfully');
      }
      
      await loadTransporters();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving transporter:', error);
      showError('Error', 'Failed to save transporter');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (transporter: Transporter) => {
    if (!confirm(`Are you sure you want to delete ${transporter.name}?`)) {
      return;
    }

    try {
      await deleteTransporter(transporter.id!, user?.uid, user?.email || '', transporter.name);
      showSuccess('Success', 'Transporter deleted successfully');
      await loadTransporters();
    } catch (error) {
      console.error('Error deleting transporter:', error);
      showError('Error', 'Failed to delete transporter');
    }
  };

  const filteredTransporters = transporters.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.phone.includes(searchQuery) ||
    t.vehicleNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.driverName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Sidebar />
      
      <div className="pt-16">
        <main className={`w-full ${getThemeClasses.pagePadding()}`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className={getThemeClasses.pageTitle()}>Transporters</h1>
              <p className="text-sm text-gray-600 mt-1">
                {filteredTransporters.length} transporter{filteredTransporters.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search transporters..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                />
              </div>

              <button
                onClick={() => handleOpenModal()}
                className={`flex items-center space-x-2 ${getThemeClasses.buttonPadding()} ${getThemeClasses.button('primary')}`}
              >
                <Plus className={getThemeClasses.icon('small')} />
                <span>Add Transporter</span>
              </button>
            </div>
          </div>

          {/* Transporters Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTransporters.map((transporter) => (
              <div
                key={transporter.id}
                className={`${getThemeClasses.card()} ${getThemeClasses.cardPadding()} hover:shadow-lg transition-shadow`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-3 ${getThemeClasses.color('blue')} rounded-lg`}>
                      <Truck className={getThemeClasses.icon('medium')} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{transporter.name}</h3>
                      {transporter.active !== false ? (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Active</span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">Inactive</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleOpenModal(transporter)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(transporter)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2 text-gray-600">
                    <User className="w-4 h-4 flex-shrink-0" />
                    <span>{transporter.contactPerson}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Phone className="w-4 h-4 flex-shrink-0" />
                    <span>{transporter.phone}</span>
                  </div>
                  
                  {transporter.email && (
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Mail className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{transporter.email}</span>
                    </div>
                  )}
                  
                  {transporter.vehicleNumber && (
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Truck className="w-4 h-4 flex-shrink-0" />
                      <span className="font-mono">{transporter.vehicleNumber}</span>
                      {transporter.vehicleType && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">
                          {transporter.vehicleType}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {transporter.driverName && (
                    <div className="flex items-center space-x-2 text-gray-600">
                      <User className="w-4 h-4 flex-shrink-0" />
                      <span>Driver: {transporter.driverName}</span>
                      {transporter.driverPhone && (
                        <span className="text-xs">({transporter.driverPhone})</span>
                      )}
                    </div>
                  )}
                  
                  {transporter.address && (
                    <div className="flex items-start space-x-2 text-gray-600">
                      <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{transporter.address}</span>
                    </div>
                  )}
                  
                  {(transporter.gst || transporter.panNumber) && (
                    <div className="pt-2 border-t border-gray-200 space-y-1">
                      {transporter.gst && (
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <FileText className="w-3 h-3" />
                          <span>GST: {transporter.gst}</span>
                        </div>
                      )}
                      {transporter.panNumber && (
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <FileText className="w-3 h-3" />
                          <span>PAN: {transporter.panNumber}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {filteredTransporters.length === 0 && (
            <div className={`${getThemeClasses.card()} ${getThemeClasses.cardPadding()} text-center py-12`}>
              <Truck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchQuery ? 'No transporters found' : 'No transporters yet'}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchQuery 
                  ? 'Try adjusting your search query' 
                  : 'Get started by adding your first transporter'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => handleOpenModal()}
                  className={`${getThemeClasses.buttonPadding()} ${getThemeClasses.button('primary')}`}
                >
                  <Plus className="w-4 h-4 inline mr-2" />
                  Add Transporter
                </button>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={handleCloseModal} />
          
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingTransporter ? 'Edit Transporter' : 'Add New Transporter'}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Basic Information */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Transporter Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter transporter name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contact Person <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.contactPerson}
                        onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter contact person"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter phone number"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter email"
                      />
                    </div>
                  </div>
                </div>

                {/* Vehicle Information */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Vehicle Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Vehicle Number
                      </label>
                      <input
                        type="text"
                        value={formData.vehicleNumber}
                        onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        placeholder="MH12AB1234"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Vehicle Type
                      </label>
                      <select
                        value={formData.vehicleType}
                        onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select type</option>
                        <option value="Truck">Truck</option>
                        <option value="Tempo">Tempo</option>
                        <option value="Van">Van</option>
                        <option value="Container">Container</option>
                        <option value="Mini Truck">Mini Truck</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Driver Information */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Driver Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Driver Name
                      </label>
                      <input
                        type="text"
                        value={formData.driverName}
                        onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter driver name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Driver Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.driverPhone}
                        onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter driver phone"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Information */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Additional Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Address
                      </label>
                      <textarea
                        rows={3}
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter complete address"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          GST Number
                        </label>
                        <input
                          type="text"
                          value={formData.gst}
                          onChange={(e) => setFormData({ ...formData, gst: e.target.value.toUpperCase() })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                          placeholder="22AAAAA0000A1Z5"
                          maxLength={15}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          PAN Number
                        </label>
                        <input
                          type="text"
                          value={formData.panNumber}
                          onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                          placeholder="ABCDE1234F"
                          maxLength={10}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.active}
                          onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Active Transporter</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className={`${getThemeClasses.buttonPadding()} ${getThemeClasses.button('secondary')}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className={`flex items-center space-x-2 ${getThemeClasses.buttonPadding()} ${getThemeClasses.button('primary')} disabled:opacity-50`}
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>{editingTransporter ? 'Update' : 'Add'} Transporter</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
