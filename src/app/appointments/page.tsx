'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { Calendar, Clock, MapPin, User, FileText, Plus, Edit, Trash2, CheckCircle, XCircle, Mail, Upload, Package } from 'lucide-react';
import { getThemeClasses } from '@/styles/theme';
import { Timestamp, collection, query, orderBy, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getPOs, getTransporters } from '@/lib/firestore';
import DataImportExport from '@/components/DataImportExport';
import { getUserInfo } from '@/lib/utils/userUtils';

interface AppointmentLineItem {
  itemName: string;
  barcode?: string;
  sku?: string;
  size?: string;
  warehouse?: string;
  appointmentQty: number;
  unitPrice: number;
  total: number;
}

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
  invoiceNumber?: string;
  purpose: 'delivery' | 'inspection' | 'meeting' | 'pickup';
  status: 'scheduled' | 'confirmed' | 'prepared' | 'shipped' | 'in-transit' | 'delivered' | 'cancelled';
  notes?: string;
  createdBy?: string;
  createdAt?: Date;
  emailSent?: boolean;
  lineItems?: AppointmentLineItem[];
  totalAmount?: number;
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
  const [showImportModal, setShowImportModal] = useState(false);
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
    invoiceNumber: '',
    purpose: 'delivery',
    status: 'scheduled',
    notes: '',
    lineItems: [],
    totalAmount: 0
  });
  
  const [selectedPO, setSelectedPO] = useState<any>(null);

  const loadAppointments = useCallback(async () => {
    setLoadingData(true);
    try {
      // Fetch appointments from Firestore
      const appointmentsRef = collection(db, 'appointments');
      const q = query(appointmentsRef, orderBy('appointmentDate', 'desc'));
      const snapshot = await getDocs(q);
      
      const appointmentsList = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Loading appointment:', doc.id, data); // Debug log
        return {
          id: doc.id,
          ...data,
          appointmentDate: data.appointmentDate?.toDate() || new Date()
        } as Appointment;
      });
      
      console.log('Total appointments loaded:', appointmentsList.length); // Debug log
      
      // Check for specific appointment
      const targetAppointment = appointmentsList.find(apt => apt.appointmentId === 'APT-2024-001');
      if (targetAppointment) {
        console.log('Found APT-2024-001:', targetAppointment);
      } else {
        console.log('APT-2024-001 not found in appointments list');
        console.log('Available appointment IDs:', appointmentsList.map(apt => apt.appointmentId));
      }
      
      setAppointments(appointmentsList);
    } catch (error) {
      console.error('Error loading appointments:', error);
      setAppointments([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  const loadPOs = useCallback(async () => {
    try {
      const posList = await getPOs(user?.uid, userData?.role);
      setPOs(posList);
    } catch (error) {
      console.error('Error loading POs:', error);
      setPOs([]);
    }
  }, [user, userData]);

  const loadTransporters = useCallback(async () => {
    try {
      const transportersList = await getTransporters();
      setTransporters(transportersList);
    } catch (error) {
      console.error('Error loading transporters:', error);
      setTransporters([]);
    }
  }, []);

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
  }, [user, loadAppointments, loadPOs, loadTransporters]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validate line items if PO is selected and creating new appointment
      const itemsToSchedule = formData.lineItems?.filter(item => item.appointmentQty > 0) || [];
      if (!editingId && formData.poNumber && selectedPO && itemsToSchedule.length === 0) {
        alert('Please select at least one item with quantity for the appointment');
        return;
      }

      const appointmentData: any = {
        appointmentId: formData.appointmentId,
        poNumber: formData.poNumber,
        vendorName: formData.vendorName,
        appointmentDate: Timestamp.fromDate(new Date(formData.appointmentDate!)),
        appointmentTime: formData.appointmentTime,
        location: formData.location || '',
        purpose: formData.purpose,
        status: formData.status,
        lineItems: itemsToSchedule,
        totalAmount: formData.totalAmount || 0,
        createdBy: user?.displayName || user?.email || 'Unknown',
        updatedAt: serverTimestamp()
      };

      // Only add optional fields if they have values
      if (formData.poId) appointmentData.poId = formData.poId;
      if (formData.transporterId) appointmentData.transporterId = formData.transporterId;
      if (formData.transporterName) appointmentData.transporterName = formData.transporterName;
      if (formData.transporterEmail) appointmentData.transporterEmail = formData.transporterEmail;
      if (formData.transporterPhone) appointmentData.transporterPhone = formData.transporterPhone;
      if (formData.docketNumber) appointmentData.docketNumber = formData.docketNumber;
      if (formData.invoiceNumber) appointmentData.invoiceNumber = formData.invoiceNumber;
      if (formData.notes) appointmentData.notes = formData.notes;

      if (editingId) {
        // Update existing appointment
        const appointmentRef = doc(db, 'appointments', editingId);
        await updateDoc(appointmentRef, appointmentData);
      } else {
        // Create new appointment
        const appointmentId = `APT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const appointmentRef = doc(db, 'appointments', appointmentId);
        await setDoc(appointmentRef, {
          ...appointmentData,
          id: appointmentId,
          createdAt: serverTimestamp()
        });
      }

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
    if (confirm('Are you sure you want to delete this appointment? This will also remove the associated shipment if linked.')) {
      try {
        // Find the appointment to get shipment info
        const appointment = appointments.find(apt => apt.id === id);
        
        // Delete the appointment
        const appointmentRef = doc(db, 'appointments', id);
        await deleteDoc(appointmentRef);

        // If appointment has linked shipment, delete shipment too
        if (appointment && (appointment as any).shipmentId) {
          const shipmentId = (appointment as any).shipmentId;
          const shipmentRef = doc(db, 'shipments', shipmentId);
          await deleteDoc(shipmentRef);

          // Add comment to PO about deletion
          if (appointment.poId) {
            try {
              const { commentService } = await import('@/lib/services');
              await commentService.addComment(
                appointment.poId,
                getUserInfo(user, userData),
                `🗑️ Appointment & Shipment deleted: ${appointment.appointmentId} (Shipment: ${shipmentId})`
              );
            } catch (commentError) {
              console.error('Failed to add deletion comment:', commentError);
            }
          }

          // Log audit event
          try {
            const { auditService } = await import('@/lib/services');
            await auditService.logEvent(
              user?.uid || '',
              user?.displayName || user?.email || 'Unknown',
              userData?.role || 'User',
              'delete',
              'system',
              id,
              `Appointment ${appointment.appointmentId}`,
              `Deleted appointment and linked shipment: ${shipmentId}`,
              undefined,
              {
                appointmentId: appointment.appointmentId,
                shipmentId: shipmentId,
                deletionType: 'appointment_with_shipment'
              }
            );
          } catch (auditError) {
            console.error('Failed to log audit event:', auditError);
          }
        }

        loadAppointments();
      } catch (error) {
        console.error('Error deleting appointment:', error);
      }
    }
  };

  const handleStatusChange = async (id: string, status: Appointment['status']) => {
    try {
      // Find the appointment to get shipment info
      const appointment = appointments.find(apt => apt.id === id);
      
      // Update appointment status
      const appointmentRef = doc(db, 'appointments', id);
      await updateDoc(appointmentRef, {
        status: status,
        updatedAt: serverTimestamp(),
        updatedBy: user?.displayName || user?.email || 'Unknown'
      });

      // If appointment has linked shipment, update shipment status too
      if (appointment && (appointment as any).shipmentId) {
        const shipmentId = (appointment as any).shipmentId;
        
        // Map appointment status to shipment status
        const shipmentStatusMap: Record<string, string> = {
          'scheduled': 'Prepared',
          'confirmed': 'Prepared', 
          'prepared': 'Prepared',
          'shipped': 'Shipped',
          'in-transit': 'In Transit',
          'delivered': 'Delivered',
          'cancelled': 'Cancelled'
        };
        
        const shipmentStatus = shipmentStatusMap[status];
        if (shipmentStatus) {
          const shipmentRef = doc(db, 'shipments', shipmentId);
          await updateDoc(shipmentRef, {
            status: shipmentStatus,
            updatedAt: serverTimestamp(),
            updatedBy_uid: user?.uid,
            updatedBy_name: user?.displayName || user?.email || 'Unknown'
          });

          // Add comment to PO about status change
          if (appointment.poId) {
            try {
              const { commentService } = await import('@/lib/services');
              await commentService.addComment(
                appointment.poId,
                getUserInfo(user, userData),
                `📋 Appointment & Shipment status updated: ${status.toUpperCase()} (${appointment.appointmentId})`
              );
            } catch (commentError) {
              console.error('Failed to add status update comment:', commentError);
            }
          }

          // Log audit event
          try {
            const { auditService } = await import('@/lib/services');
            await auditService.logEvent(
              user?.uid || '',
              user?.displayName || user?.email || 'Unknown',
              userData?.role || 'User',
              'update',
              'system',
              id,
              `Appointment ${appointment.appointmentId}`,
              `Status updated from appointment to ${status} (shipment: ${shipmentStatus})`,
              undefined,
              {
                appointmentId: appointment.appointmentId,
                shipmentId: shipmentId,
                oldStatus: appointment.status,
                newStatus: status,
                shipmentStatus: shipmentStatus
              }
            );
          } catch (auditError) {
            console.error('Failed to log audit event:', auditError);
          }
        }
      }

      loadAppointments();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const updateLineItemQty = (index: number, qty: number) => {
    if (!formData.lineItems) return;
    
    const updatedItems = [...formData.lineItems];
    
    // Allow any quantity in edit mode, only restrict in create mode
    if (selectedPO?.lineItems?.[index]) {
      const poItem = selectedPO.lineItems[index];
      const maxQty = poItem?.pendingQty || poItem?.quantity || 999999;
      updatedItems[index].appointmentQty = editingId ? qty : Math.min(qty, maxQty);
    } else {
      // In edit mode without selectedPO, allow any quantity
      updatedItems[index].appointmentQty = qty;
    }
    
    updatedItems[index].total = updatedItems[index].appointmentQty * updatedItems[index].unitPrice;
    
    const totalAmount = updatedItems.reduce((sum, item) => sum + item.total, 0);
    
    setFormData({
      ...formData,
      lineItems: updatedItems,
      totalAmount
    });
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
      invoiceNumber: '',
      purpose: 'delivery',
      status: 'scheduled',
      notes: '',
      lineItems: [],
      totalAmount: 0
    });
    setSelectedPO(null);
    setPOInputMode('dropdown');
  };

  const handlePOSelect = (poNumber: string) => {
    const selectedPOData = pos.find(po => po.poNumber === poNumber);
    if (selectedPOData) {
      setSelectedPO(selectedPOData);
      
      // Initialize line items with pending quantities
      const appointmentLineItems: AppointmentLineItem[] = selectedPOData.lineItems
        ?.filter((item: any) => (item.pendingQty || item.quantity) > 0)
        .map((item: any) => ({
          itemName: item.itemName,
          barcode: item.barcode,
          sku: item.sku,
          size: item.size,
          warehouse: item.warehouse || 'Main Warehouse',
          appointmentQty: 0, // User will set this
          unitPrice: item.unitPrice,
          total: 0
        })) || [];
      
      setFormData({
        ...formData,
        poNumber: selectedPOData.poNumber,
        vendorName: selectedPOData.vendorName,
        poId: selectedPOData.id,
        lineItems: appointmentLineItems,
        totalAmount: 0
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
      case 'prepared': return 'bg-yellow-100 text-yellow-800';
      case 'shipped': return 'bg-purple-100 text-purple-800';
      case 'in-transit': return 'bg-orange-100 text-orange-800';
      case 'delivered': return 'bg-gray-100 text-gray-800';
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
            <div className="flex space-x-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                <Upload className="w-5 h-5" />
                <span>Import CSV</span>
              </button>
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                    <select
                      required
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="scheduled">📅 Scheduled</option>
                      <option value="confirmed">✅ Confirmed</option>
                      <option value="prepared">📦 Prepared</option>
                      <option value="shipped">🚚 Shipped</option>
                      <option value="in-transit">🛣️ In Transit</option>
                      <option value="delivered">📍 Delivered</option>
                      <option value="cancelled">❌ Cancelled</option>
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Number</label>
                    <input
                      type="text"
                      value={formData.invoiceNumber}
                      onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="INV-2024-001"
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

                {/* Line Items Section */}
                {selectedPO && formData.lineItems && formData.lineItems.length > 0 && (
                  <div className="col-span-2">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Items for Appointment</h3>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="min-w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Warehouse</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Available</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Appointment Qty</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {formData.lineItems.map((item, index) => {
                            const poItem = selectedPO?.lineItems?.[index];
                            const availableQty = poItem?.pendingQty || poItem?.quantity || 999999;
                            
                            return (
                              <tr key={index}>
                                <td className="px-4 py-3 text-sm text-gray-900">{item.itemName}</td>
                                <td className="px-4 py-3 text-sm text-gray-900 font-mono">{item.sku || '-'}</td>
                                <td className="px-4 py-3 text-sm text-gray-900">{item.warehouse}</td>
                                <td className="px-4 py-3 text-sm text-gray-900">{poItem ? (poItem.pendingQty || poItem.quantity || 0) : '-'}</td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    min="0"
                                    value={item.appointmentQty}
                                    onChange={(e) => {
                                      const newQty = parseInt(e.target.value) || 0;
                                      updateLineItemQty(index, newQty);
                                    }}
                                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">₹{item.unitPrice.toLocaleString()}</td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                  ₹{item.total.toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan={6} className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                              Total Amount:
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-gray-900">
                              ₹{(formData.totalAmount || 0).toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

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
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Appointment ID</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Transporter</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Docket ID</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {appointments.map((appointment) => (
                      <tr key={appointment.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="font-medium text-blue-600 text-xs">{appointment.appointmentId}</span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="font-medium text-gray-900">{appointment.poNumber}</span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-gray-700">{appointment.vendorName}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-gray-700">
                          <div className="flex flex-col">
                            <span className="font-medium">{new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            <span className="text-xs text-gray-500">{appointment.appointmentTime}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-gray-700">
                          {appointment.lineItems ? (
                            <span>{appointment.lineItems.reduce((sum, item) => sum + item.appointmentQty, 0)} qty</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-gray-700">
                          {appointment.transporterName || '-'}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-gray-700">
                          {appointment.docketNumber || '-'}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex space-x-1">
                            <button
                              onClick={() => handleEdit(appointment)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(appointment.id!)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
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

      {/* Import Modal */}
      <DataImportExport
        type="appointments"
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => {
          setShowImportModal(false);
          loadAppointments();
        }}
      />
    </div>
  );
}
