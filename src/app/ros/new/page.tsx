'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { getThemeClasses } from '@/styles/theme';
import { getPOs, createReturnOrder, ReturnOrderItem } from '@/lib/firestore';
import Link from 'next/link';

export default function NewReturnOrderPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const [pos, setPOs] = useState<any[]>([]);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<ReturnOrderItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const loadPOs = useCallback(async () => {
    try {
      const poList = await getPOs(user?.uid, userData?.role);
      // Only show approved/shipped/received POs
      const eligiblePOs = poList.filter(po => 
        ['Approved', 'Shipped', 'Received'].includes(po.status)
      );
      setPOs(eligiblePOs);
    } catch (error) {
      console.error('Error loading POs:', error);
    }
  }, [user, userData]);

  useEffect(() => {
    if (user) {
      loadPOs();
    }
  }, [user, loadPOs]);

  const handlePOSelect = (poId: string) => {
    const po = pos.find(p => p.id === poId);
    if (po) {
      setSelectedPO(po);
      // Initialize line items from PO
      const items: ReturnOrderItem[] = po.lineItems.map((item: any) => ({
        itemName: item.itemName,
        barcode: item.barcode || '',
        sku: item.sku || '',
        size: item.size || '',
        returnQty: 0,
        unitPrice: item.unitPrice,
        total: 0,
        reason: '',
        condition: 'Damaged' as const
      }));
      setLineItems(items);
    }
  };

  const updateLineItem = (index: number, field: keyof ReturnOrderItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Recalculate total
    if (field === 'returnQty' || field === 'unitPrice') {
      updated[index].total = updated[index].returnQty * updated[index].unitPrice;
    }
    
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const addLineItem = () => {
    setLineItems([...lineItems, {
      itemName: '',
      barcode: '',
      sku: '',
      size: '',
      returnQty: 0,
      unitPrice: 0,
      total: 0,
      reason: '',
      condition: 'Damaged'
    }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPO) {
      alert('Please select a PO');
      return;
    }

    const itemsToReturn = lineItems.filter(item => item.returnQty > 0);
    if (itemsToReturn.length === 0) {
      alert('Please add at least one item to return');
      return;
    }

    setSubmitting(true);
    try {
      const totalAmount = itemsToReturn.reduce((sum, item) => sum + item.total, 0);
      
      await createReturnOrder({
        poNumber: selectedPO.poNumber,
        poId: selectedPO.id,
        vendorId: selectedPO.vendorId,
        vendorName: selectedPO.vendorName,
        returnDate: new Date(returnDate) as any,
        totalAmount,
        status: 'Pending',
        createdBy_uid: user!.uid,
        createdBy_name: userData!.name,
        lineItems: itemsToReturn,
        notes
      });

      alert('Return Order created successfully!');
      router.push('/ros');
    } catch (error) {
      console.error('Error creating return order:', error);
      alert('Failed to create return order');
    } finally {
      setSubmitting(false);
    }
  };

  const totalAmount = lineItems.reduce((sum, item) => sum + item.total, 0);

  if (loading) {
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
          <div className="flex items-center space-x-4 mb-6">
            <Link href="/ros" className="text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className={getThemeClasses.pageTitle()}>New Return Order</h1>
              <p className={getThemeClasses.description()}>Create a new product return request</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* PO Selection */}
            <div className={`${getThemeClasses.card()} ${getThemeClasses.cardPadding()}`}>
              <h2 className={`${getThemeClasses.sectionHeading()} mb-4`}>Select Purchase Order</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">PO Number *</label>
                  <select
                    required
                    value={selectedPO?.id || ''}
                    onChange={(e) => handlePOSelect(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select PO</option>
                    {pos.map((po) => (
                      <option key={po.id} value={po.id}>
                        {po.poNumber} - {po.vendorName} (₹{po.totalAmount?.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Return Date *</label>
                  <input
                    type="date"
                    required
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {selectedPO && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Vendor:</strong> {selectedPO.vendorName} | 
                    <strong className="ml-2">PO Date:</strong> {selectedPO.orderDate?.toDate().toLocaleDateString()} | 
                    <strong className="ml-2">Status:</strong> {selectedPO.status}
                  </p>
                </div>
              )}
            </div>

            {/* Line Items */}
            {selectedPO && (
              <div className={`${getThemeClasses.card()} ${getThemeClasses.cardPadding()}`}>
                <div className="flex justify-between items-center mb-4">
                  <h2 className={getThemeClasses.sectionHeading()}>Return Items</h2>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="flex items-center space-x-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Item Name</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">SKU/Barcode</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Return Qty</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Unit Price</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Total</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Reason</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Condition</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {lineItems.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={item.itemName}
                              onChange={(e) => updateLineItem(index, 'itemName', e.target.value)}
                              className="w-full px-2 py-1 border rounded"
                              placeholder="Item name"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={item.sku || item.barcode}
                              onChange={(e) => updateLineItem(index, 'sku', e.target.value)}
                              className="w-full px-2 py-1 border rounded"
                              placeholder="SKU"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              min="0"
                              value={item.returnQty}
                              onChange={(e) => updateLineItem(index, 'returnQty', parseInt(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border rounded"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1 border rounded"
                            />
                          </td>
                          <td className="px-4 py-2 font-medium">
                            ₹{item.total.toLocaleString()}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={item.reason}
                              onChange={(e) => updateLineItem(index, 'reason', e.target.value)}
                              className="w-full px-2 py-1 border rounded"
                              placeholder="Reason"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={item.condition}
                              onChange={(e) => updateLineItem(index, 'condition', e.target.value)}
                              className="w-full px-2 py-1 border rounded text-sm"
                            >
                              <option value="Damaged">Damaged</option>
                              <option value="Defective">Defective</option>
                              <option value="Wrong Item">Wrong Item</option>
                              <option value="Excess">Excess</option>
                              <option value="Other">Other</option>
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              onClick={() => removeLineItem(index)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-end">
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Total Return Amount</p>
                    <p className="text-2xl font-bold text-gray-900">₹{totalAmount.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {selectedPO && (
              <div className={`${getThemeClasses.card()} ${getThemeClasses.cardPadding()}`}>
                <h2 className={`${getThemeClasses.sectionHeading()} mb-4`}>Additional Notes</h2>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Add any additional notes about this return..."
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={submitting || !selectedPO}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                {submitting ? 'Creating...' : 'Create Return Order'}
              </button>
              <Link
                href="/ros"
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </Link>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
