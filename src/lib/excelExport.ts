import ExcelJS from 'exceljs';
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
export const exportSinglePOToExcel = async (po: PurchaseOrder, options: ExcelExportOptions = {}) => {
  const {
    filename = `PO-${po.poNumber}-${new Date().toISOString().split('T')[0]}.xlsx`,
    includeMetadata = true
  } = options;

  const workbook = new ExcelJS.Workbook();

  // PO Summary Sheet
  const summarySheet = workbook.addWorksheet('PO Summary');
  
  summarySheet.columns = [
    { header: 'Field', key: 'field', width: 25 },
    { header: 'Value', key: 'value', width: 35 }
  ];

  summarySheet.addRows([
    { field: 'Purchase Order Details', value: '' },
    { field: 'PO Number', value: po.poNumber },
    { field: 'Vendor Name', value: po.vendorName },
    { field: 'Vendor ID', value: po.vendorId },
    { field: 'Order Date', value: formatDate(po.orderDate) },
    { field: 'Expected Delivery Date', value: formatDate(po.expectedDeliveryDate) },
    { field: 'Status', value: po.status },
    { field: 'Total Amount', value: formatCurrency(po.totalAmount) },
    { field: 'Created By', value: po.createdBy_name },
    { field: 'Total Items', value: (po.lineItems?.length || 0).toString() }
  ]);

  // Line Items Summary
  summarySheet.addRow({});
  summarySheet.addRow({ field: 'Line Items Summary', value: '' });
  
  const summaryTableSheet = workbook.addWorksheet('Line Items');
  summaryTableSheet.columns = [
    { header: 'S.No', key: 'sno', width: 5 },
    { header: 'Item Name', key: 'itemName', width: 25 },
    { header: 'Barcode', key: 'barcode', width: 15 },
    { header: 'SKU', key: 'sku', width: 12 },
    { header: 'Size', key: 'size', width: 10 },
    { header: 'Warehouse', key: 'warehouse', width: 15 },
    { header: 'Quantity', key: 'quantity', width: 10 },
    { header: 'Unit Price', key: 'unitPrice', width: 12 },
    { header: 'Line Total', key: 'lineTotal', width: 12 },
    { header: 'Sent Qty', key: 'sentQty', width: 10 },
    { header: 'Pending Qty', key: 'pendingQty', width: 12 },
    { header: 'Status', key: 'status', width: 10 }
  ];

  po.lineItems?.forEach((item, index) => {
    const itemStatus = (item.sentQty || 0) >= item.quantity ? 'Completed' : 
                      (item.sentQty || 0) > 0 ? 'Partial' : 'Pending';
    
    summaryTableSheet.addRow({
      sno: index + 1,
      itemName: item.itemName,
      barcode: item.barcode || '',
      sku: item.sku || '',
      size: item.size || '',
      warehouse: item.warehouse || 'Main Warehouse',
      quantity: item.quantity,
      unitPrice: formatCurrency(item.unitPrice),
      lineTotal: formatCurrency(item.total),
      sentQty: item.sentQty || 0,
      pendingQty: item.pendingQty || item.quantity,
      status: itemStatus
    });
  });

  // Add totals row
  const totalQty = po.lineItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const totalSent = po.lineItems?.reduce((sum, item) => sum + (item.sentQty || 0), 0) || 0;
  const totalPending = po.lineItems?.reduce((sum, item) => sum + (item.pendingQty || item.quantity), 0) || 0;

  const totalsRow = summaryTableSheet.addRow({
    sno: '',
    itemName: 'TOTAL',
    barcode: '',
    sku: '',
    size: '',
    warehouse: '',
    quantity: totalQty,
    unitPrice: '',
    lineTotal: formatCurrency(po.totalAmount),
    sentQty: totalSent,
    pendingQty: totalPending,
    status: ''
  });
  totalsRow.font = { bold: true };

  // Metadata sheet (if requested)
  if (includeMetadata) {
    const metadataSheet = workbook.addWorksheet('Metadata');
    metadataSheet.columns = [
      { header: 'Metric', key: 'metric', width: 25 },
      { header: 'Value', key: 'value', width: 35 }
    ];

    metadataSheet.addRows([
      { metric: 'Purchase Order Metadata', value: '' },
      { metric: 'Export Date', value: format(new Date(), 'dd/MM/yyyy HH:mm:ss') },
      { metric: 'Export By', value: 'System' },
      { metric: '', value: '' },
      { metric: 'PO Statistics', value: '' },
      { metric: 'Total Line Items', value: po.lineItems?.length || 0 },
      { metric: 'Total Quantity', value: totalQty },
      { metric: 'Total Sent', value: totalSent },
      { metric: 'Total Pending', value: totalPending },
      { metric: 'Completion %', value: totalQty > 0 ? Math.round((totalSent / totalQty) * 100) : 0 },
      { metric: '', value: '' },
      { metric: 'Vendor Information', value: '' },
      { metric: 'Vendor ID', value: po.vendorId },
      { metric: 'Vendor Name', value: po.vendorName },
      { metric: '', value: '' },
      { metric: 'Dates', value: '' },
      { metric: 'Order Date', value: formatDate(po.orderDate) },
      { metric: 'Expected Delivery', value: formatDate(po.expectedDeliveryDate) },
      { metric: 'Created At', value: formatDate(po.createdAt) },
      { metric: 'Updated At', value: formatDate(po.updatedAt) }
    ]);
  }

  // Write file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};

// Export multiple POs (bulk export)
export const exportBulkPOsToExcel = async (pos: PurchaseOrder[], options: ExcelExportOptions = {}) => {
  const {
    filename = `POs-Bulk-Export-${new Date().toISOString().split('T')[0]}.xlsx`,
    includeLineItems = true
  } = options;

  const workbook = new ExcelJS.Workbook();

  // PO Summary Sheet
  const summarySheet = workbook.addWorksheet('PO Summary');
  summarySheet.columns = [
    { header: 'PO Number', key: 'poNumber', width: 15 },
    { header: 'Vendor Name', key: 'vendorName', width: 20 },
    { header: 'Order Date', key: 'orderDate', width: 12 },
    { header: 'Delivery Date', key: 'deliveryDate', width: 12 },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Total Items', key: 'totalItems', width: 10 },
    { header: 'Total Amount', key: 'totalAmount', width: 15 },
    { header: 'Created By', key: 'createdBy', width: 15 },
    { header: 'Completion %', key: 'completionPercent', width: 12 }
  ];

  pos.forEach(po => {
    const totalQty = po.lineItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
    const totalSent = po.lineItems?.reduce((sum, item) => sum + (item.sentQty || 0), 0) || 0;
    const completionPercent = totalQty > 0 ? Math.round((totalSent / totalQty) * 100) : 0;

    summarySheet.addRow({
      poNumber: po.poNumber,
      vendorName: po.vendorName,
      orderDate: formatDate(po.orderDate),
      deliveryDate: formatDate(po.expectedDeliveryDate),
      status: po.status,
      totalItems: (po.lineItems?.length || 0),
      totalAmount: formatCurrency(po.totalAmount),
      createdBy: po.createdBy_name,
      completionPercent: `${completionPercent}%`
    });
  });

  // Detailed Line Items Sheet (if requested)
  if (includeLineItems) {
    const lineItemsSheet = workbook.addWorksheet('All Line Items');
    lineItemsSheet.columns = [
      { header: 'PO Number', key: 'poNumber', width: 15 },
      { header: 'Vendor Name', key: 'vendorName', width: 20 },
      { header: 'Item Name', key: 'itemName', width: 25 },
      { header: 'Barcode', key: 'barcode', width: 15 },
      { header: 'SKU', key: 'sku', width: 12 },
      { header: 'Size', key: 'size', width: 10 },
      { header: 'Warehouse', key: 'warehouse', width: 15 },
      { header: 'Order Qty', key: 'orderQty', width: 10 },
      { header: 'Unit Price', key: 'unitPrice', width: 12 },
      { header: 'Line Total', key: 'lineTotal', width: 12 },
      { header: 'Sent Qty', key: 'sentQty', width: 10 },
      { header: 'Pending Qty', key: 'pendingQty', width: 12 },
      { header: 'Status', key: 'status', width: 10 }
    ];

    pos.forEach(po => {
      po.lineItems?.forEach(item => {
        const itemStatus = (item.sentQty || 0) >= item.quantity ? 'Completed' : 
                          (item.sentQty || 0) > 0 ? 'Partial' : 'Pending';

        lineItemsSheet.addRow({
          poNumber: po.poNumber,
          vendorName: po.vendorName,
          itemName: item.itemName,
          barcode: item.barcode || '',
          sku: item.sku || '',
          size: item.size || '',
          warehouse: item.warehouse || 'Main Warehouse',
          orderQty: item.quantity,
          unitPrice: formatCurrency(item.unitPrice),
          lineTotal: formatCurrency(item.total),
          sentQty: item.sentQty || 0,
          pendingQty: item.pendingQty || item.quantity,
          status: itemStatus
        });
      });
    });
  }

  // Statistics Sheet
  const totalPOs = pos.length;
  const totalAmount = pos.reduce((sum, po) => sum + po.totalAmount, 0);
  const totalItems = pos.reduce((sum, po) => sum + (po.lineItems?.length || 0), 0);
  const statusCounts = pos.reduce((acc, po) => {
    acc[po.status] = (acc[po.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statsSheet = workbook.addWorksheet('Statistics');
  statsSheet.columns = [
    { header: 'Metric', key: 'metric', width: 20 },
    { header: 'Value', key: 'value', width: 15 }
  ];

  statsSheet.addRows([
    { metric: 'Export Statistics', value: '' },
    { metric: 'Export Date', value: format(new Date(), 'dd/MM/yyyy HH:mm:ss') },
    { metric: 'Total POs', value: totalPOs },
    { metric: 'Total Amount', value: formatCurrency(totalAmount) },
    { metric: 'Total Line Items', value: totalItems },
    { metric: '', value: '' },
    { metric: 'Status Breakdown', value: '' }
  ]);

  Object.entries(statusCounts).forEach(([status, count]) => {
    statsSheet.addRow({ metric: status, value: count });
  });

  statsSheet.addRow({ metric: '', value: '' });
  statsSheet.addRow({ metric: 'Vendor Breakdown', value: '' });

  // Add vendor breakdown
  const vendorCounts = pos.reduce((acc, po) => {
    acc[po.vendorName] = (acc[po.vendorName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(vendorCounts).forEach(([vendor, count]) => {
    statsSheet.addRow({ metric: vendor, value: count });
  });

  // Write file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};

// Export filtered POs with custom options
export const exportFilteredPOsToExcel = async (
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

  await exportBulkPOsToExcel(pos, { ...options, filename });
};