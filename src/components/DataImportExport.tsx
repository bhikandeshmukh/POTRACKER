'use client';

import { useState } from 'react';
import { Upload, Download, FileText, AlertCircle, CheckCircle, X, Eye } from 'lucide-react';
import { useToast } from '@/components/ToastContainer';
import { addVendor, Vendor, PurchaseOrder, getPOs, getVendors, vendorNameToDocId, createPO } from '@/lib/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Timestamp } from 'firebase/firestore';

interface ImportResult {
  success: number;
  errors: Array<{ row: number; error: string; data: any }>;
  warnings: Array<{ row: number; warning: string; data: any }>;
}

interface DataImportExportProps {
  type: 'vendors' | 'pos';
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

export default function DataImportExport({ type, isOpen, onClose, onImportComplete }: DataImportExportProps) {
  const { user, userData } = useAuth();
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [exporting, setExporting] = useState(false);

  const vendorTemplate = [
    ['Name', 'Contact Person', 'Phone', 'Email', 'GST', 'Address'],
    ['ABC Electronics Ltd', 'John Doe', '9876543210', 'john@abc.com', '22AAAAA0000A1Z5', '123 Business Park, Mumbai'],
    ['XYZ Suppliers', 'Jane Smith', '9876543211', 'jane@xyz.com', '22BBBBB0000B1Z5', '456 Industrial Area, Delhi'],
  ];

  const poTemplate = [
    ['PO Number', 'Vendor Name', 'Order Date', 'Delivery Date', 'Status', 'Item Name', 'Barcode', 'SKU', 'Size', 'Order Qty', 'Item Price', 'Sent Qty', 'Pending Qty', 'Line Total'],
    ['PO-2024-001', 'ABC Electronics Ltd', '2024-01-15', '2024-01-30', 'Pending', 'Dell Inspiron Laptop', 'DELL123456789ABC', 'DELL-INS-15', '15 inch', '100', '25000', '0', '100', '2500000'],
    ['PO-2024-001', 'ABC Electronics Ltd', '2024-01-15', '2024-01-30', 'Pending', 'Wireless Mouse', 'MOUSE-WL-789XYZ', 'MOUSE-WL-01', 'Standard', '200', '500', '50', '150', '100000'],
    ['PO-2024-002', 'XYZ Suppliers', '2024-01-16', '2024-02-01', 'Approved', 'Executive Chair', 'CHAIR456789DEF', 'CHAIR-EXE-BLK', 'Large', '50', '3000', '30', '20', '150000'],
    ['PO-2024-002', 'XYZ Suppliers', '2024-01-16', '2024-02-01', 'Approved', 'Office Desk', 'DESK-OFF-123GHI', 'DESK-OFF-WD', '4x2 feet', '25', '8000', '15', '10', '200000'],
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      parseCSVPreview(file);
    }
  };

  const parseCSVPreview = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    const data = lines.slice(0, 6).map(line => {
      // Simple CSV parsing - in production, use a proper CSV parser
      return line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
    });
    setPreviewData(data);
  };

  const validateVendorData = (data: string[]): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!data[0]?.trim()) errors.push('Name is required');
    if (!data[1]?.trim()) errors.push('Contact Person is required');
    if (!data[2]?.trim()) errors.push('Phone is required');
    if (data[2] && !/^\d{10}$/.test(data[2].replace(/\D/g, ''))) {
      errors.push('Phone must be 10 digits');
    }
    if (data[3] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data[3])) {
      errors.push('Invalid email format');
    }
    if (data[4] && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/.test(data[4])) {
      errors.push('Invalid GST format');
    }

    return { isValid: errors.length === 0, errors };
  };

  const validatePOData = (data: string[]): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Basic PO Info Validation
    if (!data[0]?.trim()) errors.push('PO Number is required');
    if (!data[1]?.trim()) errors.push('Vendor Name is required');
    if (!data[2]?.trim()) errors.push('Order Date is required');
    if (!data[3]?.trim()) errors.push('Delivery Date is required');
    
    // Item Info Validation
    if (!data[5]?.trim()) errors.push('Item Name is required');
    if (!data[6]?.trim()) errors.push('Barcode is required');
    if (!data[7]?.trim()) errors.push('SKU is required');
    if (!data[9]?.trim()) errors.push('Order Qty is required');
    if (!data[10]?.trim()) errors.push('Item Price is required');
    
    // Date format validation (YYYY-MM-DD)
    if (data[2] && !/^\d{4}-\d{2}-\d{2}$/.test(data[2])) {
      errors.push('Order Date must be in YYYY-MM-DD format');
    }
    if (data[3] && !/^\d{4}-\d{2}-\d{2}$/.test(data[3])) {
      errors.push('Delivery Date must be in YYYY-MM-DD format');
    }
    
    // Quantity validations
    const orderQty = Number(data[9]);
    const sentQty = Number(data[11]) || 0;
    const pendingQty = Number(data[12]) || 0;
    
    if (data[9] && (isNaN(orderQty) || orderQty <= 0)) {
      errors.push('Order Qty must be a positive number');
    }
    if (data[11] && (isNaN(sentQty) || sentQty < 0)) {
      errors.push('Sent Qty must be a non-negative number');
    }
    if (data[12] && (isNaN(pendingQty) || pendingQty < 0)) {
      errors.push('Pending Qty must be a non-negative number');
    }
    
    // Quantity logic validation
    if (!isNaN(orderQty) && !isNaN(sentQty) && !isNaN(pendingQty)) {
      if (sentQty + pendingQty !== orderQty) {
        errors.push('Sent Qty + Pending Qty must equal Order Qty');
      }
      if (sentQty > orderQty) {
        errors.push('Sent Qty cannot be greater than Order Qty');
      }
    }
    
    // Price validation
    if (data[10] && (isNaN(Number(data[10])) || Number(data[10]) <= 0)) {
      errors.push('Item Price must be a positive number');
    }
    
    // Line Total validation
    if (data[13] && (isNaN(Number(data[13])) || Number(data[13]) < 0)) {
      errors.push('Line Total must be a non-negative number');
    }
    
    // Barcode validation (universal - any format accepted)
    if (data[6] && !data[6].trim()) {
      errors.push('Barcode cannot be empty');
    }
    
    // Validate status
    const validStatuses = ['Pending', 'Approved', 'Rejected', 'Shipped', 'Received', 'Partial'];
    if (data[4] && !validStatuses.includes(data[4])) {
      errors.push('Status must be one of: Pending, Approved, Rejected, Shipped, Received, Partial');
    }

    return { isValid: errors.length === 0, errors };
  };

  const handleImport = async () => {
    if (!importFile || !user) return;

    setImporting(true);
    const result: ImportResult = { success: 0, errors: [], warnings: [] };
    
    // Group PO items by PO Number
    const poGroups: Record<string, {
      poData: Omit<PurchaseOrder, 'id' | 'poNumber' | 'totalAmount'>;
      totalAmount: number;
    }> = {};

    try {
      const text = await importFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const dataRows = lines.slice(1); // Skip header

      // Fetch existing vendors for validation
      const existingVendors = type === 'pos' ? await getVendors() : [];
      const vendorMap = new Map(existingVendors.map(v => [v.name.toLowerCase(), v.id]));

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i].split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
        const rowNumber = i + 2; // +2 because we skip header and arrays are 0-indexed

        if (type === 'vendors') {
          const validation = validateVendorData(row);
          
          if (!validation.isValid) {
            result.errors.push({
              row: rowNumber,
              error: validation.errors.join(', '),
              data: row
            });
            continue;
          }

          try {
            const vendorData: Omit<Vendor, 'id'> = {
              name: row[0],
              contactPerson: row[1],
              phone: row[2],
              email: row[3] || undefined,
              gst: row[4] || undefined,
              address: row[5] || undefined,
            };

            await addVendor(vendorData, user.uid, user.email || undefined);
            result.success++;
          } catch (error: any) {
            result.errors.push({
              row: rowNumber,
              error: error.message || 'Failed to create vendor',
              data: row
            });
          }
        } else if (type === 'pos') {
          const validation = validatePOData(row);
          
          if (!validation.isValid) {
            result.errors.push({
              row: rowNumber,
              error: validation.errors.join(', '),
              data: row
            });
            continue;
          }

          try {
            const poNumber = row[0]; // PO Number is first column
            const vendorName = row[1];
            
            // Calculate line total if not provided
            const orderQty = Number(row[9]);
            const itemPrice = Number(row[10]);
            const lineTotal = row[13] ? Number(row[13]) : (orderQty * itemPrice);
            
            const lineItem = {
              itemName: row[5],
              barcode: row[6],
              sku: row[7],
              size: row[8] || '',
              quantity: orderQty,
              unitPrice: itemPrice,
              total: lineTotal,
              sentQty: Number(row[11]) || 0,
              pendingQty: Number(row[12]) || orderQty
            };

            // Group items by PO Number
            if (!poGroups[poNumber]) {
              // Check if vendor exists, if not use generated ID
              let vendorId = vendorMap.get(vendorName.toLowerCase());
              if (!vendorId) {
                vendorId = vendorNameToDocId(vendorName);
                result.warnings.push({
                  row: rowNumber,
                  warning: `Vendor "${vendorName}" not found in database. Using generated ID: ${vendorId}`,
                  data: row
                });
              }
              
              poGroups[poNumber] = {
                poData: {
                  vendorId: vendorId,
                  vendorName: vendorName,
                  orderDate: Timestamp.fromDate(new Date(row[2])),
                  expectedDeliveryDate: Timestamp.fromDate(new Date(row[3])),
                  status: (row[4] || 'Pending') as PurchaseOrder['status'],
                  createdBy_uid: user.uid,
                  createdBy_name: user.displayName || user.email || 'Imported User',
                  lineItems: []
                },
                totalAmount: 0
              };
            }
            
            // Add line item to the group
            poGroups[poNumber].poData.lineItems.push(lineItem);
            poGroups[poNumber].totalAmount += lineTotal;
            
          } catch (error: any) {
            result.errors.push({
              row: rowNumber,
              error: error.message || `Failed to process row`,
              data: row
            });
          }
        }
      }

      // Create POs from grouped data (only for PO import)
      if (type === 'pos') {
        for (const [poNumber, group] of Object.entries(poGroups)) {
          try {
            const finalPOData = {
              poNumber,
              ...group.poData,
              totalAmount: group.totalAmount
            };
            
            await createPO(finalPOData);
            result.success++;
          } catch (error: any) {
            result.errors.push({
              row: 0,
              error: `Failed to create PO ${poNumber}: ${error.message}`,
              data: [poNumber]
            });
          }
        }
      }

      setImportResult(result);
      
      if (result.success > 0) {
        showSuccess(
          'Import Completed',
          `Successfully imported ${result.success} ${type}. ${result.errors.length} errors, ${result.warnings.length} warnings.`
        );
        onImportComplete?.();
      } else {
        showError('Import Failed', 'No records were imported successfully.');
      }
    } catch (error) {
      showError('Import Error', 'Failed to process the file. Please check the format.');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = type === 'vendors' ? vendorTemplate : poTemplate;
    const csvContent = template.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportData = async () => {
    if (!user) {
      showError('Authentication Error', 'Please login to export data');
      return;
    }

    setExporting(true);
    try {
      let csvContent = '';
      
      if (type === 'vendors') {
        // Fetch real vendor data from Firestore
        const vendors = await getVendors();
        
        const exportData = [
          ['Name', 'Contact Person', 'Phone', 'Email', 'GST', 'Address'],
          ...vendors.map(vendor => [
            vendor.name || '',
            vendor.contactPerson || '',
            vendor.phone || '',
            vendor.email || '',
            vendor.gst || '',
            vendor.address || ''
          ])
        ];
        
        csvContent = exportData.map(row => 
          row.map(cell => `"${cell}"`).join(',')
        ).join('\n');
      } else {
        // Fetch real PO data from Firestore
        const pos = await getPOs(user.uid, userData?.role);
        
        const exportData = [
          ['PO Number', 'Vendor Name', 'Order Date', 'Delivery Date', 'Status', 'Item Name', 'Barcode', 'SKU', 'Size', 'Order Qty', 'Item Price', 'Sent Qty', 'Pending Qty', 'Line Total']
        ];
        
        // Convert POs to CSV rows (each line item becomes a row)
        pos.forEach(po => {
          const orderDate = po.orderDate?.toDate ? po.orderDate.toDate().toISOString().split('T')[0] : '';
          const deliveryDate = po.expectedDeliveryDate?.toDate ? po.expectedDeliveryDate.toDate().toISOString().split('T')[0] : '';
          
          if (po.lineItems && po.lineItems.length > 0) {
            po.lineItems.forEach(item => {
              exportData.push([
                po.poNumber || '',
                po.vendorName || '',
                orderDate,
                deliveryDate,
                po.status || '',
                item.itemName || '',
                item.barcode || '',
                item.sku || '',
                item.size || '',
                item.quantity?.toString() || '0',
                item.unitPrice?.toString() || '0',
                item.sentQty?.toString() || '0',
                item.pendingQty?.toString() || '0',
                item.total?.toString() || '0'
              ]);
            });
          } else {
            // If no line items, still export PO basic info
            exportData.push([
              po.poNumber || '',
              po.vendorName || '',
              orderDate,
              deliveryDate,
              po.status || '',
              '', '', '', '', '0', '0', '0', '0', '0'
            ]);
          }
        });
        
        csvContent = exportData.map(row => 
          row.map(cell => `"${cell}"`).join(',')
        ).join('\n');
      }
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      showSuccess('Export Complete', `${type} data has been exported successfully`);
    } catch (error) {
      console.error('Export error:', error);
      showError('Export Failed', 'Failed to export data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <FileText className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Data {activeTab === 'import' ? 'Import' : 'Export'}
                </h2>
                <p className="text-sm text-gray-600">
                  {activeTab === 'import' ? 'Import' : 'Export'} {type} data via CSV
                </p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('import')}
              className={`flex-1 px-6 py-3 text-sm font-medium ${
                activeTab === 'import'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Upload className="w-4 h-4 inline mr-2" />
              Import Data
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`flex-1 px-6 py-3 text-sm font-medium ${
                activeTab === 'export'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Download className="w-4 h-4 inline mr-2" />
              Export Data
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {activeTab === 'import' ? (
              /* Import Tab */
              <div className="space-y-6">
                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 mb-2">Import Instructions</h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Download the template file to see the required format</li>
                    <li>• Fill in your data following the same column structure</li>
                    <li>• Save as CSV file and upload below</li>
                    {type === 'vendors' ? (
                      <li>• Required fields: Name, Contact Person, Phone</li>
                    ) : (
                      <>
                        <li>• Required fields: PO Number, Vendor Name, Order Date, Delivery Date</li>
                        <li>• Item fields required: Item Name, Barcode, SKU, Order Qty, Item Price</li>
                        <li>• Date format: YYYY-MM-DD (e.g., 2024-01-15)</li>
                        <li>• Status options: Pending, Approved, Rejected, Shipped, Received, Partial</li>
                        <li>• Barcode: Any format accepted (alphanumeric, no length limit)</li>
                        <li>• Quantities: Sent Qty + Pending Qty must equal Order Qty</li>
                        <li>• Multiple items per PO: Use same PO Number for different items</li>
                        <li>• Same PO Number will group items into single Purchase Order</li>
                      </>
                    )}
                  </ul>
                </div>

                {/* Template Download */}
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Download Template</h4>
                    <p className="text-sm text-gray-600">
                      Get the CSV template with sample data and required format
                    </p>
                  </div>
                  <button
                    onClick={downloadTemplate}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Template</span>
                  </button>
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload CSV File
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="csv-upload"
                    />
                    <label htmlFor="csv-upload" className="cursor-pointer">
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        Click to upload CSV file or drag and drop
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        CSV files only, max 10MB
                      </p>
                    </label>
                  </div>
                  
                  {importFile && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-green-800">{importFile.name}</span>
                          <span className="text-xs text-green-600">
                            ({(importFile.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          onClick={() => setShowPreview(!showPreview)}
                          className="flex items-center space-x-1 text-xs text-green-600 hover:text-green-800"
                        >
                          <Eye className="w-3 h-3" />
                          <span>{showPreview ? 'Hide' : 'Preview'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Preview */}
                {showPreview && previewData.length > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <h4 className="font-medium text-gray-900">Data Preview (First 5 rows)</h4>
                      <p className="text-xs text-gray-600 mt-1">Excel-like format showing your uploaded data</p>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="inline-block min-w-full">
                        <table className="min-w-full border-collapse">
                          {/* Header Row */}
                          {previewData.length > 0 && (
                            <thead>
                              <tr className="bg-blue-50 border-b-2 border-blue-200">
                                <th className="w-12 px-3 py-2 text-xs font-medium text-gray-500 bg-gray-100 border-r border-gray-300 text-center">
                                  #
                                </th>
                                {previewData[0].map((header: string, index: number) => (
                                  <th 
                                    key={index} 
                                    className="px-4 py-3 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider border-r border-blue-200 min-w-[120px] bg-blue-50"
                                  >
                                    {header}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                          )}
                          
                          {/* Data Rows */}
                          <tbody className="bg-white">
                            {previewData.slice(1).map((row, rowIndex) => (
                              <tr 
                                key={rowIndex} 
                                className={`border-b border-gray-200 hover:bg-gray-50 ${
                                  rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-25'
                                }`}
                              >
                                {/* Row Number */}
                                <td className="w-12 px-3 py-2 text-xs text-gray-500 bg-gray-50 border-r border-gray-300 text-center font-medium">
                                  {rowIndex + 2}
                                </td>
                                
                                {/* Data Cells */}
                                {row.map((cell: string, cellIndex: number) => (
                                  <td 
                                    key={cellIndex} 
                                    className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200 min-w-[120px] max-w-[200px]"
                                  >
                                    <div className="truncate" title={cell}>
                                      {cell || (
                                        <span className="text-gray-400 italic text-xs">empty</span>
                                      )}
                                    </div>
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    
                    {/* Preview Footer */}
                    <div className="bg-gray-50 px-4 py-2 border-t border-gray-200">
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>
                          Showing {Math.min(previewData.length - 1, 5)} of {previewData.length - 1} data rows
                        </span>
                        <span className="flex items-center space-x-4">
                          <span>Columns: {previewData[0]?.length || 0}</span>
                          <span>•</span>
                          <span>File: {importFile?.name}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Import Results */}
                {importResult && (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="font-medium text-green-800">
                          Successfully imported {importResult.success} records
                        </span>
                      </div>
                    </div>

                    {importResult.warnings.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                          <AlertCircle className="w-5 h-5 text-yellow-600" />
                          <span className="font-medium text-yellow-800">
                            {importResult.warnings.length} warnings
                          </span>
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {importResult.warnings.map((warning, index) => (
                            <div key={index} className="text-sm text-yellow-700">
                              Row {warning.row}: {warning.warning}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {importResult.errors.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                          <AlertCircle className="w-5 h-5 text-red-600" />
                          <span className="font-medium text-red-800">
                            {importResult.errors.length} errors occurred
                          </span>
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {importResult.errors.map((error, index) => (
                            <div key={index} className="text-sm text-red-700">
                              Row {error.row}: {error.error}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Import Button */}
                {importFile && !importResult && (
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{importing ? 'Importing...' : `Import ${type}`}</span>
                  </button>
                )}
              </div>
            ) : (
              /* Export Tab */
              <div className="space-y-6">
                {/* Export Options */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-medium text-green-900 mb-2">Export Options</h3>
                  <p className="text-sm text-green-800">
                    Export all {type} data to CSV format for backup or analysis
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Complete Export</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Export all {type} with complete information
                    </p>
                    <button
                      onClick={exportData}
                      disabled={exporting}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download className="w-4 h-4" />
                      <span>{exporting ? 'Exporting...' : 'Export All'}</span>
                    </button>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Filtered Export</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Export with current filters applied
                    </p>
                    <button
                      onClick={exportData}
                      disabled={exporting}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download className="w-4 h-4" />
                      <span>{exporting ? 'Exporting...' : 'Export Filtered'}</span>
                    </button>
                  </div>
                </div>

                {/* Export Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Export Information</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Data will be exported in CSV format</li>
                    <li>• All fields will be included in the export</li>
                    <li>• File will be automatically downloaded</li>
                    <li>• Export includes current data snapshot</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}