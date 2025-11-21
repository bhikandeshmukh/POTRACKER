'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getShipments, Shipment, PurchaseOrder, ShipmentLineItem } from '@/lib/firestore';
import { shipmentService } from '@/lib/services';
import { useToast } from '@/components/ToastContainer';
import { Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { Plus, Truck, Package, CheckCircle, XCircle, Eye, Edit, Download } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import DataImportExport from '@/components/DataImportExport';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { auditService, commentService } from '@/lib/services';
import { getUserInfo, getUserDisplayName } from '@/lib/utils/userUtils';

// Custom StatusBadge for Shipments
function ShipmentStatusBadge({ status }: { status: Shipment['status'] }) {
  const getStatusColor = (status: Shipment['status']) => {
    switch (status) {
      case 'Prepared': return 'bg-yellow-100 text-yellow-800';
      case 'Shipped': return 'bg-blue-100 text-blue-800';
      case 'In Transit': return 'bg-purple-100 text-purple-800';
      case 'Delivered': return 'bg-green-100 text-green-800';
      case 'Cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {status}
    </span>
  );
}

interface ShipmentManagementProps {
  po: PurchaseOrder;
  onUpdate: () => void;
}

export default function ShipmentManagement({ po, onUpdate }: ShipmentManagementProps) {
  const { user, userData } = useAuth();
  const { showSuccess, showError } = useToast();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadShipments();
  }, [po.poNumber]);

  const loadShipments = async () => {
    try {
      const shipmentList = await getShipments(po.poNumber);
      setShipments(shipmentList);
    } catch (error) {
      console.error('Error loading shipments:', error);
    }
  };

  const canCreateShipment = userData?.role === 'Manager' || userData?.role === 'Admin';
  const canUpdateShipment = userData?.role === 'Manager' || userData?.role === 'Admin';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Shipments</h3>
        {canCreateShipment && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Shipment</span>
          </button>
        )}
      </div>

      {/* Shipments List */}
      {shipments.length > 0 ? (
        <div className="space-y-3">
          {shipments.map((shipment) => (
            <div key={shipment.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <h4 className="font-medium text-gray-900">
                    Appointment: {shipment.appointmentId}
                  </h4>
                  <ShipmentStatusBadge status={shipment.status} />
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setSelectedShipment(shipment);
                      setShowDetailModal(true);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {canUpdateShipment && (
                    <button
                      onClick={() => {
                        setSelectedShipment(shipment);
                        // Add edit functionality
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Invoice:</span>
                  <span className="ml-1 font-mono">{shipment.invoiceNumber}</span>
                </div>
                <div>
                  <span className="text-gray-600">Ship Date:</span>
                  <span className="ml-1">{format(shipment.shipmentDate.toDate(), 'MMM dd, yyyy')}</span>
                </div>
                <div>
                  <span className="text-gray-600">Items:</span>
                  <span className="ml-1">{shipment.lineItems.length}</span>
                </div>
                <div>
                  <span className="text-gray-600">Amount:</span>
                  <span className="ml-1 font-medium">₹{shipment.totalAmount.toLocaleString()}</span>
                </div>
              </div>
              
              {shipment.trackingNumber && (
                <div className="mt-2 text-sm">
                  <span className="text-gray-600">Tracking:</span>
                  <span className="ml-1 font-mono">{shipment.trackingNumber}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-500 py-8">No shipments created yet</p>
      )}

      {/* Create Shipment Modal */}
      {showCreateModal && (
        <CreateShipmentModal
          po={po}
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            loadShipments();
            onUpdate();
            setShowCreateModal(false);
          }}
        />
      )}

      {/* Shipment Detail Modal */}
      {showDetailModal && selectedShipment && (
        <ShipmentDetailModal
          shipment={selectedShipment}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedShipment(null);
          }}
          onStatusUpdate={async (status) => {
            if (selectedShipment && user && userData) {
              try {
                const oldStatus = selectedShipment.status;
                
                // Update shipment status (this will also sync appointment status)
                await shipmentService.updateShipmentStatus(
                  selectedShipment.id!,
                  status,
                  {
                    uid: user.uid,
                    name: user.displayName || user.email || 'Unknown',
                    role: userData?.role || 'User'
                  }
                );
                
                // Log audit event for status change
                const userInfo = getUserInfo(user, userData);
                await auditService.logEvent(
                  userInfo.uid,
                  userInfo.name,
                  userInfo.role,
                  'update',
                  'shipment',
                  selectedShipment.id!,
                  `Shipment ${selectedShipment.id}`,
                  `Shipment status changed from ${oldStatus} to ${status}`,
                  { status: { old: oldStatus, new: status } },
                  {
                    poNumber: selectedShipment.poNumber,
                    invoiceNumber: selectedShipment.invoiceNumber
                  }
                );

                // Add automatic comment to PO
                const statusMessages: Record<string, string> = {
                  'Prepared': '📋 Shipment prepared',
                  'Shipped': '🚚 Shipment shipped',
                  'In Transit': '🛣️ Shipment in transit',
                  'Delivered': '📦 Shipment delivered',
                  'Cancelled': '❌ Shipment cancelled'
                };

                const commentContent = `${statusMessages[status] || `Shipment status: ${status}`} (${selectedShipment.id})`;
                
                try {
                  await commentService.addComment(
                    po.id!,
                    getUserInfo(user, userData),
                    commentContent
                  );
                } catch (commentError) {
                  console.error('Failed to add shipment status comment:', commentError);
                }

                loadShipments();
                onUpdate();
                showSuccess('Success', `Shipment status updated to ${status}`);
              } catch (error) {
                console.error('Error updating shipment status:', error);
                showError('Error', 'Failed to update shipment status');
              }
            }
          }}
          canUpdate={canUpdateShipment}
        />
      )}
    </div>
  );
}

// Create Shipment Modal Component
function CreateShipmentModal({ po, isOpen, onClose, onSuccess }: {
  po: PurchaseOrder;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user, userData } = useAuth();
  const { showSuccess, showError } = useToast();
  const [showImportModal, setShowImportModal] = useState(false);
  const [formData, setFormData] = useState({
    appointmentId: '',
    invoiceNumber: '',
    shipmentDate: format(new Date(), 'yyyy-MM-dd'),
    expectedDeliveryDate: '',
    carrier: '',
    trackingNumber: '',
    notes: ''
  });
  const [lineItems, setLineItems] = useState<ShipmentLineItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Initialize line items with pending quantities
    const initialItems = po.lineItems
      .filter(item => (item.pendingQty || item.quantity) > 0)
      .map(item => ({
        itemName: item.itemName,
        barcode: item.barcode,
        sku: item.sku,
        size: item.size,
        shippedQty: 0,
        unitPrice: item.unitPrice,
        total: 0
      }));
    setLineItems(initialItems);
  }, [po]);

  const updateLineItemQty = (index: number, qty: number) => {
    const updatedItems = [...lineItems];
    const maxQty = po.lineItems[index].pendingQty || po.lineItems[index].quantity;
    updatedItems[index].shippedQty = Math.min(qty, maxQty);
    updatedItems[index].total = updatedItems[index].shippedQty * updatedItems[index].unitPrice;
    setLineItems(updatedItems);
  };

  const totalAmount = lineItems.reduce((sum, item) => sum + item.total, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const itemsToShip = lineItems.filter(item => item.shippedQty > 0);
    if (itemsToShip.length === 0) {
      showError('Validation Error', 'Please select at least one item to ship');
      return;
    }

    setLoading(true);
    try {
      const shipmentData: any = {
        poNumber: po.poNumber,
        appointmentId: formData.appointmentId,
        invoiceNumber: formData.invoiceNumber,
        shipmentDate: Timestamp.fromDate(new Date(formData.shipmentDate)),
        status: 'Prepared',
        createdBy_uid: user.uid,
        createdBy_name: getUserDisplayName(user, userData),
        lineItems: itemsToShip,
        totalAmount
      };

      // Only add optional fields if they have values
      if (formData.expectedDeliveryDate) {
        shipmentData.expectedDeliveryDate = Timestamp.fromDate(new Date(formData.expectedDeliveryDate));
      }
      if (formData.carrier) {
        shipmentData.carrier = formData.carrier;
      }
      if (formData.trackingNumber) {
        shipmentData.trackingNumber = formData.trackingNumber;
      }
      if (formData.notes) {
        shipmentData.notes = formData.notes;
      }

      // Generate shipment ID and create directly
      const shipmentId = `SHP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const shipmentRef = doc(db, 'shipments', shipmentId);
      const shipmentWithId = {
        ...shipmentData,
        id: shipmentId,
        poNumber: po.poNumber,
        createdAt: serverTimestamp() as Timestamp,
      };
      
      await setDoc(shipmentRef, shipmentWithId);

      // Create appointment for this shipment
      const appointmentId = `APT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const appointmentRef = doc(db, 'appointments', appointmentId);
      const appointmentData = {
        id: appointmentId,
        appointmentId: formData.appointmentId || appointmentId,
        poNumber: po.poNumber,
        poId: po.id,
        vendorName: po.vendorName,
        appointmentDate: shipmentData.shipmentDate,
        appointmentTime: '10:00', // Default time
        location: 'Warehouse', // Default location
        contactPerson: formData.carrier || 'TBD',
        notes: `Shipment appointment for ${shipmentId}`,
        status: 'scheduled',
        purpose: 'delivery',
        transporterId: '',
        transporterName: formData.carrier || '',
        transporterEmail: '',
        docketNumber: formData.trackingNumber || '',
        createdBy: getUserDisplayName(user, userData),
        createdAt: serverTimestamp(),
        shipmentId: shipmentId // Link to shipment
      };
      
      await setDoc(appointmentRef, appointmentData);

      // Log audit event for shipment creation
      const userInfo = getUserInfo(user, userData);
      await auditService.logEvent(
        userInfo.uid,
        userInfo.name,
        userInfo.role,
        'create',
        'shipment',
        shipmentId,
        `Shipment ${shipmentId}`,
        `Created shipment for PO ${po.poNumber} with ${itemsToShip.length} items`,
        undefined,
        {
          poNumber: po.poNumber,
          appointmentId: formData.appointmentId,
          invoiceNumber: formData.invoiceNumber,
          totalAmount: totalAmount,
          itemCount: itemsToShip.length
        }
      );

      // Add automatic comment to PO
      try {
        await commentService.addComment(
          po.id!,
          getUserInfo(user, userData),
          `📦 Shipment created: ${shipmentId} (Invoice: ${formData.invoiceNumber})`
        );
      } catch (commentError) {
        console.error('Failed to add shipment comment:', commentError);
      }

      showSuccess('Success', 'Shipment created successfully');
      onSuccess();
    } catch (error) {
      console.error('Error creating shipment:', error);
      showError('Error', 'Failed to create shipment');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Create Shipment</h2>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm"
              >
                <Download className="w-4 h-4" />
                <span>Import</span>
              </button>
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Appointment ID *
                </label>
                <input
                  type="text"
                  required
                  value={formData.appointmentId}
                  onChange={(e) => setFormData(prev => ({ ...prev, appointmentId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="APT-2024-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice Number *
                </label>
                <input
                  type="text"
                  required
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="INV-2024-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shipment Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.shipmentDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, shipmentDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expected Delivery Date
                </label>
                <input
                  type="date"
                  value={formData.expectedDeliveryDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, expectedDeliveryDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Carrier
                </label>
                <input
                  type="text"
                  value={formData.carrier}
                  onChange={(e) => setFormData(prev => ({ ...prev, carrier: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="FedEx, DHL, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tracking Number
                </label>
                <input
                  type="text"
                  value={formData.trackingNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, trackingNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="1234567890"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Additional notes..."
              />
            </div>

            {/* Line Items */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Items to Ship</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pending</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ship Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {po.lineItems.map((poItem, index) => {
                      const pendingQty = poItem.pendingQty || poItem.quantity;
                      if (pendingQty <= 0) return null;
                      
                      return (
                        <tr key={index}>
                          <td className="px-4 py-3 text-sm text-gray-900">{poItem.itemName}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{pendingQty}</td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              max={pendingQty}
                              value={lineItems[index]?.shippedQty || 0}
                              onChange={(e) => updateLineItemQty(index, parseInt(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">₹{poItem.unitPrice.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            ₹{(lineItems[index]?.total || 0).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                        Total Amount:
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">
                        ₹{totalAmount.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || totalAmount === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Shipment'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <DataImportExport
          type="shipments"
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportComplete={() => {
            setShowImportModal(false);
            onSuccess();
          }}
        />
      )}
    </div>
  );
}

// Shipment Detail Modal Component
function ShipmentDetailModal({ shipment, isOpen, onClose, onStatusUpdate, canUpdate }: {
  shipment: Shipment;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdate: (status: Shipment['status']) => void;
  canUpdate: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Shipment Details</h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Shipment Info */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="font-medium text-gray-900 mb-4">Shipment Information</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-600">Appointment ID:</span>
                    <span className="ml-2 font-mono">{shipment.appointmentId}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Invoice Number:</span>
                    <span className="ml-2 font-mono">{shipment.invoiceNumber}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <span className="ml-2"><ShipmentStatusBadge status={shipment.status} /></span>
                  </div>
                  <div>
                    <span className="text-gray-600">Ship Date:</span>
                    <span className="ml-2">{format(shipment.shipmentDate.toDate(), 'MMM dd, yyyy')}</span>
                  </div>
                  {shipment.expectedDeliveryDate && (
                    <div>
                      <span className="text-gray-600">Expected Delivery:</span>
                      <span className="ml-2">{format(shipment.expectedDeliveryDate.toDate(), 'MMM dd, yyyy')}</span>
                    </div>
                  )}
                  {shipment.actualDeliveryDate && (
                    <div>
                      <span className="text-gray-600">Actual Delivery:</span>
                      <span className="ml-2">{format(shipment.actualDeliveryDate.toDate(), 'MMM dd, yyyy')}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-4">Logistics</h3>
                <div className="space-y-3 text-sm">
                  {shipment.carrier && (
                    <div>
                      <span className="text-gray-600">Carrier:</span>
                      <span className="ml-2">{shipment.carrier}</span>
                    </div>
                  )}
                  {shipment.trackingNumber && (
                    <div>
                      <span className="text-gray-600">Tracking:</span>
                      <span className="ml-2 font-mono">{shipment.trackingNumber}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-600">Created By:</span>
                    <span className="ml-2">{shipment.createdBy_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="ml-2 font-medium">₹{shipment.totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="mb-6">
              <h3 className="font-medium text-gray-900 mb-4">Shipped Items</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {shipment.lineItems.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.itemName}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-mono">{item.sku || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.shippedQty}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">₹{item.unitPrice.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">₹{item.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Status Update Actions */}
            {canUpdate && (
              <div className="border-t border-gray-200 pt-6">
                <h3 className="font-medium text-gray-900 mb-4">Update Status</h3>
                <div className="flex flex-wrap gap-3">
                  {shipment.status === 'Prepared' && (
                    <button
                      onClick={() => onStatusUpdate('Shipped')}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Truck className="w-4 h-4" />
                      <span>Mark as Shipped</span>
                    </button>
                  )}
                  {(shipment.status === 'Shipped' || shipment.status === 'In Transit') && (
                    <>
                      <button
                        onClick={() => onStatusUpdate('In Transit')}
                        className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                      >
                        <Truck className="w-4 h-4" />
                        <span>In Transit</span>
                      </button>
                      <button
                        onClick={() => onStatusUpdate('Delivered')}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        <Package className="w-4 h-4" />
                        <span>Mark as Delivered</span>
                      </button>
                    </>
                  )}
                  {shipment.status !== 'Cancelled' && shipment.status !== 'Delivered' && (
                    <button
                      onClick={() => onStatusUpdate('Cancelled')}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Cancel</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {shipment.notes && (
              <div className="border-t border-gray-200 pt-6 mt-6">
                <h3 className="font-medium text-gray-900 mb-2">Notes</h3>
                <p className="text-sm text-gray-600">{shipment.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}