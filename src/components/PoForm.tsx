'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createPO, getVendors, Vendor, LineItem } from '@/lib/firestore';
import { logAuditEvent } from '@/lib/auditLogs';
import { Timestamp } from 'firebase/firestore';
import { Plus, Trash2 } from 'lucide-react';

export default function PoForm() {
  const router = useRouter();
  const { user, userData } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    vendorId: '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { itemName: '', quantity: 1, unitPrice: 0, total: 0 }
  ]);

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    const vendorList = await getVendors();
    setVendors(vendorList);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { itemName: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'quantity' || field === 'unitPrice') {
      updated[index].total = updated[index].quantity * updated[index].unitPrice;
    }
    
    setLineItems(updated);
  };

  const totalAmount = lineItems.reduce((sum, item) => sum + item.total, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData) return;

    setLoading(true);
    try {
      const selectedVendor = vendors.find(v => v.id === formData.vendorId);
      
      const result = await createPO({
        vendorId: formData.vendorId,
        vendorName: selectedVendor?.name || '',
        orderDate: Timestamp.fromDate(new Date(formData.orderDate)),
        expectedDeliveryDate: Timestamp.fromDate(new Date(formData.expectedDeliveryDate)),
        totalAmount,
        status: 'Pending',
        createdBy_uid: user.uid,
        createdBy_name: userData.name,
        lineItems,
      });

      // Log audit event
      await logAuditEvent(
        user.uid,
        userData.name,
        'create',
        'po',
        result.id,
        result.poNumber,
        `Created PO ${result.poNumber} for vendor ${selectedVendor?.name} with total amount ₹${totalAmount.toLocaleString()}`,
        undefined,
        {
          vendorName: selectedVendor?.name,
          totalAmount,
          itemCount: lineItems.length,
          userRole: userData.role
        }
      );

      router.push('/pos');
    } catch (error) {
      console.error('Error creating PO:', error);
      alert('Failed to create PO');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">PO Details</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vendor *
            </label>
            <select
              required
              value={formData.vendorId}
              onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Select a vendor</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Order Date *
            </label>
            <input
              type="date"
              required
              value={formData.orderDate}
              onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expected Delivery Date *
            </label>
            <input
              type="date"
              required
              value={formData.expectedDeliveryDate}
              onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
          <button
            type="button"
            onClick={addLineItem}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item</span>
          </button>
        </div>

        <div className="space-y-4">
          {lineItems.map((item, index) => (
            <div key={index} className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item Name
                </label>
                <input
                  type="text"
                  required
                  value={item.itemName}
                  onChange={(e) => updateLineItem(index, 'itemName', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div className="w-24">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div className="w-32">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unit Price (₹)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div className="w-32">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total (₹)
                </label>
                <input
                  type="text"
                  disabled
                  value={item.total.toFixed(2)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                />
              </div>

              {lineItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLineItem(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex justify-end">
            <div className="text-right">
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900">₹{totalAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:bg-gray-400"
        >
          {loading ? 'Creating...' : 'Create PO'}
        </button>
      </div>
    </form>
  );
}
