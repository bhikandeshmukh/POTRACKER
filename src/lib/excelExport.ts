import * as XLSX from 'xlsx';
import { PurchaseOrder } from './types';
import { format } from 'date-fns';

export interface ExcelExportOptions {
  filename?: string;
  includeLineItems?: boolean;
  includeMetadata?: boolean;
  sheetName?: string;
}

// Helper function to format dates
const formatDate = (date: any): string => {
  if (!date) return '';
  if (date.toDate) return format(date.toDate(), 'dd/MM/yyyy');
  if (date instanceof Date) return format(date, 'dd/MM/yyyy');
  return '';
};

// Helper function to format currency
const formatCurrency = (amount: number): string => {
  return `₹${amount.toLocaleString('en-IN')}`;
};

// Export single PO with detailed line items
export const exportSinglePOToExcel = (po: PurchaseOrder, options: ExcelExportOptions = {}) => {
  const {
    filename = `PO-${po.poNumber}-${new Date().toISOString().split('T')[0]}.xlsx`,
    includeMetadata = true
  } = options;

  const workbook = XLSX.utils.book_new();

  // PO Summary Sheet
  const summaryData = [
    ['Purchase Order Details', ''],
    ['PO Number', po.poNumber],
    ['Vendor Name', po.vendorName],
    ['Vendor ID', po.vendorId],
    ['Order Date', formatDate(po.orderDate)],
    ['Expected Delivery Date', formatDate(po.expectedDeliveryDate)],
    ['Status', po.status],
    ['Total Amount', formatCurrency(po.totalAmount)],
    ['Created By', po.createdBy_name],
    ['Total Items', (po.lineItems?.length || 0).toString()],
    [''],
    ['Line Items Summary', ''],
    ['S.No', 'Item Name', 'Barcode', 'SKU', 'Size', 'Warehouse', 'Quantity', 'Unit Price', 'Line Total', 'Sent Qty', 'Pending Qty', 'Status']
  ];

  // Add line items to summary
  po.lineItems?.forEach((item, index) => {
    const itemStatus = (item.sentQty || 0) >= item.quantity ? 'Completed' : 
                      (item.sentQty || 0) > 0 ? 'Partial' : 'Pending';
    
    summaryData.push([
      (index + 1).toString(),
      item.itemName,
      item.barcode || '',
      item.sku || '',
      item.size || '',
      item.warehouse || 'Main Warehouse',
      item.quantity.toString(),
      formatCurrency(item.unitPrice),
      formatCurrency(item.total),
      (item.sentQty || 0).toString(),
      (item.pendingQty || item.quantity).toString(),
      itemStatus
    ]);
  });

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  
  // Set column widths
  summarySheet['!cols'] = [
    { width: 5 },   // S.No
    { width: 25 },  // Item Name
    { width: 15 },  // Barcode
    { width: 12 },  // SKU
    { width: 10 },  // Size
    { width: 15 },  // Warehouse
    { width: 10 },  // Quantity
    { width: 12 },  // Unit Price
    { width: 12 },  // Line Total
    { width: 10 },  // Sent Qty
    { width: 12 },  // Pending Qty
    { width: 10 }   // Status
  ];

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'PO Summary');

  // Detailed Line Items Sheet
  const lineItemsData = [
    ['Item Details', '', '', '', '', '', '', '', '', '', '', ''],
    ['S.No', 'Item Name', 'Barcode', 'SKU', 'Size', 'Warehouse', 'Order Qty', 'Unit Price', 'Line Total', 'Sent Qty', 'Pending Qty', 'Received Qty']
  ];

  po.lineItems?.forEach((item, index) => {
    lineItemsData.push([
      (index + 1).toString(),
      item.itemName,
      item.barcode || '',
      item.sku || '',
      item.size || '',
      item.warehouse || 'Main Warehouse',
      item.quantity.toString(),
      item.unitPrice.toString(),
      item.total.toString(),
      (item.sentQty || 0).toString(),
      (item.pendingQty || item.quantity).toString(),
      (item.receivedQty || 0).toString()
    ]);
  });

  // Add totals row
  const totalQty = po.lineItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const totalSent = po.lineItems?.reduce((sum, item) => sum + (item.sentQty || 0), 0) || 0;
  const totalPending = po.lineItems?.reduce((sum, item) => sum + (item.pendingQty || item.quantity), 0) || 0;

  lineItemsData.push([
    '',
    'TOTAL',
    '',
    '',
    '',
    '',
    totalQty.toString(),
    '',
    po.totalAmount.toString(),
    totalSent.toString(),
    totalPending.toString(),
    ''
  ]);

  const lineItemsSheet = XLSX.utils.aoa_to_sheet(lineItemsData);
  lineItemsSheet['!cols'] = [
    { width: 5 },   // S.No
    { width: 25 },  // Item Name
    { width: 15 },  // Barcode
    { width: 12 },  // SKU
    { width: 10 },  // Size
    { width: 15 },  // Warehouse
    { width: 10 },  // Order Qty
    { width: 12 },  // Unit Price
    { width: 12 },  // Line Total
    { width: 10 },  // Sent Qty
    { width: 12 },  // Pending Qty
    { width: 12 }   // Received Qty
  ];

  XLSX.utils.book_append_sheet(workbook, lineItemsSheet, 'Line Items');

  // Metadata sheet (if requested)
  if (includeMetadata) {
    const metadataData = [
      ['Purchase Order Metadata', ''],
      ['Export Date', format(new Date(), 'dd/MM/yyyy HH:mm:ss')],
      ['Export By', 'System'],
      [''],
      ['PO Statistics', ''],
      ['Total Line Items', po.lineItems?.length || 0],
      ['Total Quantity', totalQty],
      ['Total Sent', totalSent],
      ['Total Pending', totalPending],
      ['Completion %', totalQty > 0 ? Math.round((totalSent / totalQty) * 100) : 0],
      [''],
      ['Vendor Information', ''],
      ['Vendor ID', po.vendorId],
      ['Vendor Name', po.vendorName],
      [''],
      ['Dates', ''],
      ['Order Date', formatDate(po.orderDate)],
      ['Expected Delivery', formatDate(po.expectedDeliveryDate)],
      ['Created At', formatDate(po.createdAt)],
      ['Updated At', formatDate(po.updatedAt)]
    ];

    const metadataSheet = XLSX.utils.aoa_to_sheet(metadataData);
    metadataSheet['!cols'] = [{ width: 20 }, { width: 30 }];
    XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');
  }

  // Download the file
  XLSX.writeFile(workbook, filename);
};

// Export multiple POs (bulk export)
export const exportBulkPOsToExcel = (pos: PurchaseOrder[], options: ExcelExportOptions = {}) => {
  const {
    filename = `POs-Bulk-Export-${new Date().toISOString().split('T')[0]}.xlsx`,
    includeLineItems = true
  } = options;

  const workbook = XLSX.utils.book_new();

  // PO Summary Sheet
  const summaryData = [
    ['Purchase Orders Summary', '', '', '', '', '', '', '', ''],
    ['PO Number', 'Vendor Name', 'Order Date', 'Delivery Date', 'Status', 'Total Items', 'Total Amount', 'Created By', 'Completion %']
  ];

  pos.forEach(po => {
    const totalQty = po.lineItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
    const totalSent = po.lineItems?.reduce((sum, item) => sum + (item.sentQty || 0), 0) || 0;
    const completionPercent = totalQty > 0 ? Math.round((totalSent / totalQty) * 100) : 0;

    summaryData.push([
      po.poNumber,
      po.vendorName,
      formatDate(po.orderDate),
      formatDate(po.expectedDeliveryDate),
      po.status,
      (po.lineItems?.length || 0).toString(),
      formatCurrency(po.totalAmount),
      po.createdBy_name,
      `${completionPercent}%`
    ]);
  });

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [
    { width: 15 }, // PO Number
    { width: 20 }, // Vendor Name
    { width: 12 }, // Order Date
    { width: 12 }, // Delivery Date
    { width: 10 }, // Status
    { width: 10 }, // Total Items
    { width: 15 }, // Total Amount
    { width: 15 }, // Created By
    { width: 12 }  // Completion %
  ];

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'PO Summary');

  // Detailed Line Items Sheet (if requested)
  if (includeLineItems) {
    const lineItemsData = [
      ['All Line Items', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['PO Number', 'Vendor Name', 'Item Name', 'Barcode', 'SKU', 'Size', 'Warehouse', 'Order Qty', 'Unit Price', 'Line Total', 'Sent Qty', 'Pending Qty', 'Status']
    ];

    pos.forEach(po => {
      po.lineItems?.forEach(item => {
        const itemStatus = (item.sentQty || 0) >= item.quantity ? 'Completed' : 
                          (item.sentQty || 0) > 0 ? 'Partial' : 'Pending';

        lineItemsData.push([
          po.poNumber,
          po.vendorName,
          item.itemName,
          item.barcode || '',
          item.sku || '',
          item.size || '',
          item.warehouse || 'Main Warehouse',
          item.quantity.toString(),
          item.unitPrice.toString(),
          item.total.toString(),
          (item.sentQty || 0).toString(),
          (item.pendingQty || item.quantity).toString(),
          itemStatus
        ]);
      });
    });

    const lineItemsSheet = XLSX.utils.aoa_to_sheet(lineItemsData);
    lineItemsSheet['!cols'] = [
      { width: 15 }, // PO Number
      { width: 20 }, // Vendor Name
      { width: 25 }, // Item Name
      { width: 15 }, // Barcode
      { width: 12 }, // SKU
      { width: 10 }, // Size
      { width: 15 }, // Warehouse
      { width: 10 }, // Order Qty
      { width: 12 }, // Unit Price
      { width: 12 }, // Line Total
      { width: 10 }, // Sent Qty
      { width: 12 }, // Pending Qty
      { width: 10 }  // Status
    ];

    XLSX.utils.book_append_sheet(workbook, lineItemsSheet, 'All Line Items');
  }

  // Statistics Sheet
  const totalPOs = pos.length;
  const totalAmount = pos.reduce((sum, po) => sum + po.totalAmount, 0);
  const totalItems = pos.reduce((sum, po) => sum + (po.lineItems?.length || 0), 0);
  const statusCounts = pos.reduce((acc, po) => {
    acc[po.status] = (acc[po.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statsData = [
    ['Export Statistics', ''],
    ['Export Date', format(new Date(), 'dd/MM/yyyy HH:mm:ss')],
    ['Total POs', totalPOs.toString()],
    ['Total Amount', formatCurrency(totalAmount)],
    ['Total Line Items', totalItems.toString()],
    [''],
    ['Status Breakdown', ''],
    ...Object.entries(statusCounts).map(([status, count]) => [status, count.toString()]),
    [''],
    ['Vendor Breakdown', ''],
  ];

  // Add vendor breakdown
  const vendorCounts = pos.reduce((acc, po) => {
    acc[po.vendorName] = (acc[po.vendorName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(vendorCounts).forEach(([vendor, count]) => {
    statsData.push([vendor, count.toString()]);
  });

  const statsSheet = XLSX.utils.aoa_to_sheet(statsData);
  statsSheet['!cols'] = [{ width: 20 }, { width: 15 }];
  XLSX.utils.book_append_sheet(workbook, statsSheet, 'Statistics');

  // Download the file
  XLSX.writeFile(workbook, filename);
};

// Export filtered POs with custom options
export const exportFilteredPOsToExcel = (
  pos: PurchaseOrder[], 
  filters: Record<string, any>,
  options: ExcelExportOptions = {}
) => {
  const filterDescription = Object.entries(filters)
    .filter(([_, value]) => value && (Array.isArray(value) ? value.length > 0 : true))
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
    .join('; ');

  const filename = options.filename || 
    `POs-Filtered-${filterDescription.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`;

  exportBulkPOsToExcel(pos, { ...options, filename });
};