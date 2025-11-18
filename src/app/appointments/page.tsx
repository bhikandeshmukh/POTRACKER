'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { Calendar, Clock, MapPin, User, FileText, Plus, Edit, Trash2, CheckCircle, XCircle, Mail } from 'lucide-react';
import { getThemeClasses } from '@/styles/theme';
import { Timestamp } from 'firebase/firestore';

interface Appointment {
  id?: string;
  appointmentId: string; // Auto-generated: APT-2024-001
  poNumber: string;
  poId?: string;
  vendorName: string;
  transporterId?: string;
  transporterName?: string;
  transporterEmail?: string;
  transporterPhone?: string;
  appointmentDate: Date;
  appointmentTime: string;
  location: string;
  docketNumber?: string;
  purpose: 'delivery' | 'inspection' | 'meeting' | 'pickup';
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  createdBy?: string;
  createdAt?: Date;
  emailSent?: boolean;
}

export default function AppointmentsPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pos, setPOs] = useState<any[]>([]);
  const [transporters, setTransporters] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [poInputMode, setPOInputMode] = useState<'dropdown' | 'manual'>('dropdown');
  const [formData, setFormData] = useState<Partial<Appointment>>({
    appointmentId: '',
    poNumber: '',
    vendorName: '',
    appointmentDate: new Date(),
    appointmentTime: '',
    location: '',
    transporterId: '',
    transporterName: '',
    transporterEmail: '',
    docketNumber: '',
    purpose: 'delivery',
    status: 'scheduled',
    notes: ''
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadAppointments();
      loadPOs();
      loadTransporters();
    }
  }, [user]);

  const loadAppointments = async () => {
    setLoadingData(true);
    try {
      // TODO: Fetch from Firestore
      setAppointments([]);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const loadPOs = async () => {
    try {
      // TODO: Fetch POs from Firestore
      setPOs([]);
    } catch (error) {
      console.error('Error loading POs:', error);
    }
  };

  const loadTransporters = async () => {
    try {
      // TODO: Fetch transporters from Firestore
      setTransporters([]);
    } catch (error) {
      console.error('Error loading transporters:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // TODO: Save to Firestore
      setShowForm(false);
      setEditingId(null);
      resetForm();
      loadAppointments();
    } catch (error) {
      console.error('Error saving appointment:', error);
    }
  };

  const handleEdit = (appointment: Appointment) => {
    setFormData(appointment);
    setEditingId(appointment.id || null);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this appointment?')) {
      try {
        // TODO: Delete from Firestore
        loadAppointments();
      } catch (error) {
        console.error('Error deleting appointment:', error);
      }
    }
  };

  const handleStatusChange = async (id: string, status: Appointment['status']) => {
    try {
      // TODO: Update status in Firestore
      loadAppointments();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      appointmentId: '',
      poNumber: '',
      vendorName: '',
      appointmentDate: new Date(),
      appointmentTime: '',
      location: '',
      transporterId: '',
      transporterName: '',
      transporterEmail: '',
      docketNumber: '',
      purpose: 'delivery',
      status: 'scheduled',
      notes: ''
    });
    setPOInputMode('dropdown');
  };

  const handlePOSelect = (poNumber: string) => {
    const selectedPO = pos.find(po => po.poNumber === poNumber);
    if (selectedPO) {
      setFormData({
        ...formData,
        poNumber: selectedPO.poNumber,
        vendorName: selectedPO.vendorName,
        poId: selectedPO.id
      });
    }
  };

  const handleTransporterSelect = (transporterId: string) => {
    const selectedTransporter = transporters.find(t => t.id === transporterId);
    if (selectedTransporter) {
      setFormData({
        ...formData,
        transporterId: selectedTransporter.id,
        transporterName: selectedTransporter.name,
        transporterEmail: selectedTransporter.email
      });
    }
  };

  const sendEmailToTransporter = async (appointment: Appointment) => {
    if (!appointment.transporterEmail) {
      alert('No transporter email available');
      return;
    }
    
    // TODO: Implement email sending
    alert(`Email will be sent to: ${appointment.transporterEmail}\n\nAppointment Details:\nID: ${appointment.appointmentId}\nPO: ${appointment.poNumber}\nDate: ${new Date(appointment.appointmentDate).toLocaleDateString()}\nTime: ${appointment.appointmentTime}\nLocation: ${appointment.location}\nDocket: ${appointment.docketNumber || 'N/A'}`);
  };

  const getPurposeIcon = (purpose: string) => {
    switch (purpose) {
      case 'delivery': return <MapPin className="w-4 h-4" />;
      case 'inspection': return <CheckCircle className="w-4 h-4" />;
      case 'meeting': return <User className="w-4 h-4" />;
      case 'pickup': return <MapPin className="w-4 h-4" />;
      default: return <Calendar className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

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
        <main className="w-full p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className={getThemeClasses.pageTitle()}>PO Appointments</h1>
              <p className={getThemeClasses.description()}>Schedule and manage purchase order appointments</p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-5 h-5" />
              <span>New Appointment</span>
            </button>
          </div>

          {/* Add/Edit Form */}
          {showForm && (
            <div className={`${getThemeClasses.card()} ${getThemeClasses.cardPadding()} mb-6`}>
              <h2 className={`${getThemeClasses.sectionHeading()} mb-4`}>
                {editingId ? 'Edit Appointment' : 'New Appointment'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Appointment ID (from Warehouse) *</label>
                    <input
                      type="text"
                      required
                      value={formData.appointmentId}
                      onChange={(e) => setFormData({ ...formData, appointmentId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="APP-WH-001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">PO Number *</label>
                    <div className="flex space-x-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setPOInputMode('dropdown')}
                        className={`px-3 py-1 text-sm rounded ${poInputMode === 'dropdown' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                      >
                        Select PO
                      </button>
                      <button
                        type="button"
                        onClick={() => setPOInputMode('manual')}
                        className={`px-3 py-1 text-sm rounded ${poInputMode === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                      >
                        Manual Entry
                      </button>
                    </div>
                    {poInputMode === 'dropdown' ? (
                      <select
                        required
                        value={formData.poNumber}
                        onChange={(e) => handlePOSelect(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select PO</option>
                        {pos.map((po) => (
                          <option key={po.id} value={po.poNumber}>
                            {po.poNumber} - {po.vendorName}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        value={formData.poNumber}
                        onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="PO-2024-001"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vendor Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.vendorName}
                      onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="ABC Technologies"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.appointmentDate ? new Date(formData.appointmentDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => setFormData({ ...formData, appointmentDate: new Date(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Time *</label>
                    <input
                      type="time"
                      required
                      value={formData.appointmentTime}
                      onChange={(e) => setFormData({ ...formData, appointmentTime: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
                    <input
                      type="text"
                      required
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Warehouse A, Gate 2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Purpose *</label>
                    <select
                      required
                      value={formData.purpose}
                      onChange={(e) => setFormData({ ...formData, purpose: e.target.value as any })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="delivery">Delivery</option>
                      <option value="inspection">Inspection</option>
                      <option value="meeting">Meeting</option>
                      <option value="pickup">Pickup</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Transporter</label>
                    <select
                      value={formData.transporterId}
                      onChange={(e) => handleTransporterSelect(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Transporter</option>
                      {transporters.map((transporter) => (
                        <option key={transporter.id} value={transporter.id}>
                          {transporter.name} {transporter.email ? `(${transporter.email})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Docket Number</label>
                    <input
                      type="text"
                      value={formData.docketNumber}
                      onChange={(e) => setFormData({ ...formData, docketNumber: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="DOC-2024-001"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Additional notes..."
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    {editingId ? 'Update' : 'Create'} Appointment
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                      resetForm();
                    }}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Appointments List */}
          <div className={getThemeClasses.card()}>
            {appointments.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Appointments</h3>
                <p className="text-gray-500 mb-4">Create your first PO appointment to get started</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <Plus className="w-5 h-5" />
                  <span>New Appointment</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Appointment ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transporter</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Docket</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {appointments.map((appointment) => (
                      <tr key={appointment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-medium text-blue-600">{appointment.appointmentId}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-gray-900">{appointment.poNumber}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">{appointment.vendorName}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2 text-gray-700">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span>{new Date(appointment.appointmentDate).toLocaleDateString()}</span>
                            <Clock className="w-4 h-4 text-gray-400 ml-2" />
                            <span>{appointment.appointmentTime}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {appointment.transporterName ? (
                            <div className="flex items-center space-x-2">
                              <span className="text-gray-700">{appointment.transporterName}</span>
                              {appointment.transporterEmail && (
                                <button
                                  onClick={() => sendEmailToTransporter(appointment)}
                                  className="text-blue-600 hover:text-blue-900"
                                  title="Send email to transporter"
                                >
                                  <Mail className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                          {appointment.docketNumber || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={appointment.status}
                            onChange={(e) => handleStatusChange(appointment.id!, e.target.value as any)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(appointment.status)}`}
                          >
                            <option value="scheduled">Scheduled</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEdit(appointment)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(appointment.id!)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
