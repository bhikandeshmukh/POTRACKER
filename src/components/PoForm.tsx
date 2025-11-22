'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ToastContainer';
import { poService, vendorService } from '@/lib/services';
import { Vendor, LineItem } from '@/lib/types';
import { Plus, Trash2 } from 'lucide-react';

export default function PoForm() {
  const router = useRouter();
  const { user, userData } = useAuth();
  const { showSuccess, showError } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    vendorId: '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { 
      itemName: '', 
      barcode: '', 
      sku: '', 
      size: '', 
      warehouse: 'Main Warehouse',
      quantity: 1, 
      unitPrice: 0, 
      total: 0,
      sentQty: 0,
      pendingQty: 1
    }
  ]);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    loadVendors();
  }, []);

  /**
  * Loads vendors from the service and updates state, logging errors on failure.
  * @example
  * sync()
  * Promise<void>
  * @returns {{Promise<void>}} Resolves after vendor state is updated or errors are logged.
  **/
  const loadVendors = async () => {
    try {
      const result = await vendorService.findMany();
      if (result.success && result.data) {
        setVendors(result.data.data);
      } else {
        console.error('Failed to load vendors:', result.error);
      }
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  /**
  * Adds a default empty line item placeholder to the current line items list.
  * @example
  * addLineItem()
  * undefined
  * @param {{void}} _ - No parameters are required.
  * @returns {{void}} No return value.
  **/
  const addLineItem = () => {
    setLineItems([...lineItems, { 
      itemName: '', 
      barcode: '', 
      sku: '', 
      size: '', 
      warehouse: 'Main Warehouse',
      quantity: 1, 
      unitPrice: 0, 
      total: 0,
      sentQty: 0,
      pendingQty: 1
    }]);
  };

  /**
  * Parses a CSV file selected through an input, validates and imports line items, and updates the form state with parsed data.
  * @example
  * handleCsvImport(event)
  * void
  * @param {{React.ChangeEvent<HTMLInputElement>}} {{event}} - Change event from file input containing the selected CSV file.
  * @returns {{void}} Updates line items, form data, and UI state based on the imported CSV contents.
  **/
  const handleCSVImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string;
        const lines = csv.split('\n').filter(line => line.trim()); // Remove empty lines
        
        if (lines.length < 2) {
          showError('Invalid CSV', 'CSV file must have at least a header and one data row');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim());
        console.log('CSV Headers:', headers);
        
        // Expected headers: PO Number, Vendor Name, Order Date, Delivery Date, Barcode, SKU, Size, Order Qty, Item Price, Sent Qty, Pending Qty, Line Total
        const importedItems: LineItem[] = [];
        
        for (let i = 1; i < lines.length; i+=1) {
          const values = lines[i].split(',').map(v => v.trim());
          console.log(`Row ${i}:`, values);
          
          if (values.length >= 12 && values[0]) { // Ensure we have all required fields
            const orderQty = parseInt(values[7], 10) || 1;
            const itemPrice = parseFloat(values[8]) || 0;
            const sentQty = parseInt(values[9], 10) || 0;
            const pendingQty = parseInt(values[10], 10) || 0;
            const lineTotal = parseFloat(values[11]) || (orderQty * itemPrice);
            
            // Validate the data
            if (orderQty <= 0) {
              console.warn(`Row ${i}: Invalid Order Qty (${orderQty})`);
              continue;
            }
            
            if (sentQty > orderQty) {
              console.warn(`Row ${i}: Sent Qty (${sentQty}) cannot be greater than Order Qty (${orderQty})`);
              continue;
            }
            
            // Auto-calculate pending qty if it doesn't match
            const calculatedPendingQty = Math.max(0, orderQty - sentQty);
            if (pendingQty !== calculatedPendingQty) {
              console.warn(`Row ${i}: Adjusting Pending Qty from ${pendingQty} to ${calculatedPendingQty}`);
            }
            
            importedItems.push({
              itemName: values[5] || values[4] || '', // Use SKU as item name, fallback to barcode
              barcode: values[4] || '',
              sku: values[5] || '',
              size: values[6] || '',
              warehouse: values[12] || 'Main Warehouse', // New warehouse field
              quantity: orderQty,
              unitPrice: itemPrice,
              total: lineTotal,
              sentQty: sentQty,
              pendingQty: Math.max(0, orderQty - sentQty) // Always calculate correctly
            });
          }
        }
        
        console.log('Final imported items:', importedItems);
        
        if (importedItems.length > 0) {
          setLineItems(importedItems);
          
          // Set PO details from first row
          const firstRow = lines[1].split(',').map(v => v.trim());
          if (firstRow.length >= 4) {
            // Parse dates in DD/MM/YYYY format
            const parseDate = (dateStr: string) => {
              const parts = dateStr.split('/');
              if (parts.length === 3) {
                const [day, month, year] = parts;
                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
              }
              return '';
            };
            
            const orderDate = parseDate(firstRow[2]);
            const deliveryDate = parseDate(firstRow[3]);
            
            console.log('Parsed dates:', { orderDate, deliveryDate });
            
            setFormData({
              ...formData,
              orderDate: orderDate || formData.orderDate,
              expectedDeliveryDate: deliveryDate || formData.expectedDeliveryDate
            });
          }
          
          setShowImport(false);
          showSuccess('CSV Import', `Successfully imported ${importedItems.length} items from CSV`);
        } else {
          showError('No Valid Items', 'No valid items found in CSV file. Please check the format and data.');
        }
      } catch (error) {
        console.error('CSV Import Error:', error);
        showError('CSV Parse Error', 'Error parsing CSV file. Please check the format.');
      }
    };
    reader.readAsText(file);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  /**
  * Updates a line item’s field, recalculating totals and pending quantities when necessary before saving the new state.
  * @example
  * updateLineItem(0, 'quantity', 5)
  * undefined
  * @param {{number}} {{index}} - Index of the line item to update.
  * @param {{keyof LineItem}} {{field}} - Field name to update on the line item.
  * @param {{any}} {{value}} - New value to assign to the specified field.
  * @returns {{void}} Updates the line items state without returning a value.
  **/
  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-calculate total when quantity or unitPrice changes
    if (field === 'quantity' || field === 'unitPrice') {
      updated[index].total = updated[index].quantity * updated[index].unitPrice;
    }
    
    // Auto-calculate pending quantity when quantity or sentQty changes
    if (field === 'quantity' || field === 'sentQty') {
      const orderQty = updated[index].quantity || 0;
      const sentQty = updated[index].sentQty || 0;
      updated[index].pendingQty = Math.max(0, orderQty - sentQty);
    }
    
    setLineItems(updated);
  };

  const totalAmount = lineItems.reduce((sum, item) => sum + item.total, 0);

  /****
  * Synchronizes form submission by preventing default behavior, creating a purchase order, and navigating or showing errors based on the result.
  * @example
  * sync(event)
  * undefined
  * @param {{React.FormEvent}} {{e}} - Form submission event that triggers the PO creation process.
  * @returns {{Promise<void>}} Promise that resolves once the submission workflow (including navigation or error handling) completes.
  ****/
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData) return;

    setLoading(true);
    try {
      const selectedVendor = vendors.find(v => v.id === formData.vendorId);
      
      const poFormData = {
        vendorId: formData.vendorId,
        orderDate: formData.orderDate,
        expectedDeliveryDate: formData.expectedDeliveryDate,
        lineItems,
      };

      const result = await poService.createPO(
        poFormData,
        {
          uid: user.uid,
          name: userData.name,
          role: userData.role
        },
        selectedVendor?.name || ''
      );

      if (result.success) {
        router.push('/pos');
      } else {
        console.error('Failed to create PO:', result.error);
        showError('Failed to Create PO', result.error || 'An error occurred while creating the PO');
      }
    } catch (error) {
      console.error('Error creating PO:', error);
      showError('Error', 'Failed to create PO');
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
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setShowImport(!showImport)}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <span>Import CSV</span>
            </button>
            <button
              type="button"
              onClick={addLineItem}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
            >
              <Plus className="size-4" />
              <span>Add Item</span>
            </button>
          </div>
        </div>

        {/* CSV Import Section */}
        {showImport && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-medium text-blue-900 mb-2">Import from CSV</h3>
            <p className="text-sm text-blue-800 mb-3">
              Upload a CSV file with the exact format shown in the template. Dates should be in DD/MM/YYYY format.
            </p>
            <div className="text-xs text-blue-700 mb-3">
              <strong>Required columns:</strong> PO Number, Vendor Name, Order Date, Delivery Date, Barcode, SKU, Size, Order Qty, Item Price, Sent Qty, Pending Qty, Line Total
            </div>
            <div className="flex space-x-3 mb-3">
              <button
                type="button"
                onClick={() => {
                  setLineItems([{ 
                    itemName: '', 
                    barcode: '', 
                    sku: '', 
                    size: '', 
                    quantity: 1, 
                    unitPrice: 0, 
                    total: 0,
                    sentQty: 0,
                    pendingQty: 1
                  }]);
                }}
                className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={() => {
                  const csvContent = `PO Number,Vendor Name,Order Date,Delivery Date,Barcode,SKU,Size,Order Qty,Item Price,Sent Qty,Pending Qty,Line Total
PO-2024-001,ABC Electronics Ltd,15/01/2024,30/01/2024,DELL123456789ABC,DELL-INS-15,15 inch,100,25000,0,100,2500000
PO-2024-001,ABC Electronics Ltd,15/01/2024,30/01/2024,MOUSE-WL-789XYZ,MOUSE-WL-01,Standard,200,500,0,200,100000
PO-2024-002,XYZ Suppliers,16/01/2024,01/02/2024,CHAIR456789DEF,CHAIR-EXE-BLK,Large,50,3000,0,50,150000
PO-2024-002,XYZ Suppliers,16/01/2024,01/02/2024,DESK-OFF-123GHI,DESK-OFF-WD,4x2 feet,25,8000,0,25,200000`;
                  
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'po-import-template.csv';
                  a.click();
                  window.URL.revokeObjectURL(url);
                }}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Download Template
              </button>
            </div>
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVImport}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
        )}

        <div className="space-y-4">
          {lineItems.map((item, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-end">
              {/* Barcode */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Barcode
                </label>
                <input
                  type="text"
                  value={item.barcode || ''}
                  onChange={(e) => updateLineItem(index, 'barcode', e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* SKU */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  SKU
                </label>
                <input
                  type="text"
                  required
                  value={item.sku || ''}
                  onChange={(e) => updateLineItem(index, 'sku', e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Size */}
              <div className="col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Size
                </label>
                <input
                  type="text"
                  value={item.size || ''}
                  onChange={(e) => updateLineItem(index, 'size', e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Warehouse */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Warehouse
                </label>
                <select
                  value={item.warehouse || 'Main Warehouse'}
                  onChange={(e) => updateLineItem(index, 'warehouse', e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="Main Warehouse">Main Warehouse</option>
                  <option value="Secondary Warehouse">Secondary Warehouse</option>
                  <option value="Distribution Center">Distribution Center</option>
                  <option value="Storage Facility">Storage Facility</option>
                </select>
              </div>

              {/* Order Qty */}
              <div className="col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Order Qty
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value, 10))}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Item Price */}
              <div className="col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Item Price
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value))}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Sent Qty */}
              <div className="col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Sent Qty
                </label>
                <input
                  type="number"
                  min="0"
                  value={item.sentQty || 0}
                  onChange={(e) => updateLineItem(index, 'sentQty', parseInt(e.target.value, 10))}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Pending Qty */}
              <div className="col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Pending Qty
                </label>
                <input
                  type="number"
                  min="0"
                  value={item.pendingQty || 0}
                  onChange={(e) => updateLineItem(index, 'pendingQty', parseInt(e.target.value, 10))}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Line Total */}
              <div className="col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Line Total
                </label>
                <input
                  type="text"
                  disabled
                  value={item.total.toFixed(2)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-50 text-gray-700"
                />
              </div>

              {/* Remove Button */}
              {lineItems.length > 1 && (
                <div className="col-span-1">
                  <button
                    type="button"
                    onClick={() => removeLineItem(index)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
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
