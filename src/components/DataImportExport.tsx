'use client';

import { useState } from 'react';
import { Upload, Download, FileText, AlertCircle, CheckCircle, X, Eye } from 'lucide-react';
import { useToast } from '@/components/ToastContainer';
import { addVendor, Vendor, PurchaseOrder, getPOs, getVendors, vendorNameToDocId } from '@/lib/firestore';
import { poService, auditService, commentService } from '@/lib/services';
import { getUserInfo, getUserDisplayName } from '@/lib/utils/userUtils';
import { useAuth } from '@/contexts/AuthContext';
import { Timestamp, doc, setDoc, serverTimestamp, collection, query, orderBy, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ImportResult {
  success: number;
  errors: Array<{ row: number; error: string; data: any }>;
  warnings: Array<{ row: number; warning: string; data: any }>;
}

interface DataImportExportProps {
  type: 'vendors' | 'pos' | 'shipments' | 'appointments';
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

  // Helper function to parse dates in DD/MM/YYYY or YYYY-MM-DD format
  const parseDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    
    // Check if it's DD/MM/YYYY format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('/');
      return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    }
    
    // Otherwise assume YYYY-MM-DD format or let Date constructor handle it
    return new Date(dateStr);
  };
  const [exporting, setExporting] = useState(false);

  const vendorTemplate = [
    ['Name', 'Contact Person', 'Phone', 'Email', 'GST', 'Address', 'Warehouse Name', 'Warehouse Address', 'Warehouse Type', 'Warehouse Contact', 'Warehouse Phone'],
    ['ABC Electronics Ltd', 'John Doe', '9876543210', 'john@abc.com', '22AAAAA0000A1Z5', '123 Business Park, Mumbai', 'Main Warehouse', '789 Storage Complex, Mumbai', 'main', 'Warehouse Manager', '9876543212'],
    ['XYZ Suppliers', 'Jane Smith', '9876543211', 'jane@xyz.com', '22BBBBB0000B1Z5', '456 Industrial Area, Delhi', 'Distribution Center', '321 Logistics Hub, Delhi', 'distribution', 'Operations Head', '9876543213'],
  ];

  const poTemplate = [
    ['PO Number', 'Vendor Name', 'Order Date', 'Delivery Date', 'Barcode', 'SKU', 'Size', 'Order Qty', 'Item Price', 'Sent Qty', 'Pending Qty', 'Line Total', 'Warehouse'],
    ['PO-2024-001', 'ABC Electronics Ltd', '15/01/2024', '30/01/2024', 'DELL123456789ABC', 'DELL-INS-15', '15 inch', '100', '25000', '0', '100', '2500000', 'Main Warehouse'],
    ['PO-2024-001', 'ABC Electronics Ltd', '15/01/2024', '30/01/2024', 'MOUSE-WL-789XYZ', 'MOUSE-WL-01', 'Standard', '200', '500', '0', '200', '100000', 'Main Warehouse'],
    ['PO-2024-002', 'XYZ Suppliers', '16/01/2024', '01/02/2024', 'CHAIR456789DEF', 'CHAIR-EXE-BLK', 'Large', '50', '3000', '0', '50', '150000', 'Distribution Center'],
    ['PO-2024-002', 'XYZ Suppliers', '16/01/2024', '01/02/2024', 'DESK-OFF-123GHI', 'DESK-OFF-WD', '4x2 feet', '25', '8000', '0', '25', '200000', 'Storage Facility'],
  ];

  const shipmentTemplate = [
    ['PO Number', 'Appointment ID', 'Invoice Number', 'Shipment Date', 'Expected Delivery Date', 'Carrier', 'Tracking Number', 'Item Name', 'Barcode', 'SKU', 'Size', 'Warehouse', 'Shipped Qty', 'Unit Price', 'Line Total', 'Notes'],
    ['PO-2024-001', 'APT-2024-001', 'INV-2024-001', '21/11/2025', '25/11/2025', 'FedEx', '1234567890', 'Dell Laptop', 'DELL123456789ABC', 'DELL-INS-15', '15 inch', 'Main Warehouse', '50', '25000', '1250000', 'Handle with care'],
    ['PO-2024-001', 'APT-2024-001', 'INV-2024-001', '21/11/2025', '25/11/2025', 'FedEx', '1234567890', 'HP Mouse', 'HP987654321XYZ', 'HP-MSE-01', 'Standard', 'Main Warehouse', '100', '500', '50000', 'Fragile items'],
  ];

  const appointmentTemplate = [
    ['Appointment ID', 'PO Number', 'Vendor Name', 'Date', 'Time', 'Location', 'Purpose', 'Status', 'Transporter', 'Docket Number', 'Invoice Number', 'Item Name', 'Barcode', 'SKU', 'Size', 'Warehouse', 'Appointment Qty', 'Unit Price', 'Line Total', 'Notes'],
    ['APT-2024-001', 'PO-2024-001', 'ABC Electronics Ltd', '25/11/2025', '10:00', 'Warehouse A', 'delivery', 'scheduled', 'FedEx', 'DOC-001', 'INV-2024-001', 'Dell Laptop', 'DELL123456789ABC', 'DELL-INS-15', '15 inch', 'Main Warehouse', '50', '25000', '1250000', 'Morning delivery'],
    ['APT-2024-001', 'PO-2024-001', 'ABC Electronics Ltd', '25/11/2025', '10:00', 'Warehouse A', 'delivery', 'scheduled', 'FedEx', 'DOC-001', 'INV-2024-001', 'HP Mouse', 'HP987654321XYZ', 'HP-MSE-01', 'Standard', 'Main Warehouse', '100', '500', '50000', 'Same appointment multiple items'],
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
    
    // Item Info Validation (adjusted indices after removing Status column)
    if (!data[4]?.trim()) errors.push('Barcode is required');
    if (!data[5]?.trim()) errors.push('SKU is required');
    if (!data[7]?.trim()) errors.push('Order Qty is required');
    if (!data[8]?.trim()) errors.push('Item Price is required');
    
    // Date format validation (DD/MM/YYYY or YYYY-MM-DD)
    if (data[2] && !/^\d{2}\/\d{2}\/\d{4}$/.test(data[2]) && !/^\d{4}-\d{2}-\d{2}$/.test(data[2])) {
      errors.push('Order Date must be in DD/MM/YYYY or YYYY-MM-DD format');
    }
    if (data[3] && !/^\d{2}\/\d{2}\/\d{4}$/.test(data[3]) && !/^\d{4}-\d{2}-\d{2}$/.test(data[3])) {
      errors.push('Delivery Date must be in DD/MM/YYYY or YYYY-MM-DD format');
    }
    
    // Quantity validations (adjusted indices)
    const orderQty = Number(data[7]);
    const sentQty = Number(data[9]) || 0;
    const pendingQty = Number(data[10]) || 0;
    
    if (data[7] && (isNaN(orderQty) || orderQty <= 0)) {
      errors.push('Order Qty must be a positive number');
    }
    if (data[9] && (isNaN(sentQty) || sentQty < 0)) {
      errors.push('Sent Qty must be a non-negative number');
    }
    if (data[10] && (isNaN(pendingQty) || pendingQty < 0)) {
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
    
    // Price validation (adjusted index)
    if (data[8] && (isNaN(Number(data[8])) || Number(data[8]) <= 0)) {
      errors.push('Item Price must be a positive number');
    }
    
    // Line Total validation (adjusted index)
    if (data[11] && (isNaN(Number(data[11])) || Number(data[11]) < 0)) {
      errors.push('Line Total must be a non-negative number');
    }
    
    // Barcode validation (adjusted index)
    if (data[4] && !data[4].trim()) {
      errors.push('Barcode cannot be empty');
    }

    return { isValid: errors.length === 0, errors };
  };

  const validateShipmentData = (data: string[]): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Required fields validation
    if (!data[0]?.trim()) errors.push('PO Number is required');
    if (!data[1]?.trim()) errors.push('Appointment ID is required');
    if (!data[2]?.trim()) errors.push('Invoice Number is required');
    if (!data[3]?.trim()) errors.push('Shipment Date is required');
    if (!data[7]?.trim()) errors.push('Item Name is required');
    
    // Date format validation
    if (data[3] && !/^\d{2}\/\d{2}\/\d{4}$/.test(data[3]) && !/^\d{4}-\d{2}-\d{2}$/.test(data[3])) {
      errors.push('Shipment Date must be in DD/MM/YYYY or YYYY-MM-DD format');
    }
    if (data[4] && !/^\d{2}\/\d{2}\/\d{4}$/.test(data[4]) && !/^\d{4}-\d{2}-\d{2}$/.test(data[4])) {
      errors.push('Expected Delivery Date must be in DD/MM/YYYY or YYYY-MM-DD format');
    }
    
    // Quantity and price validation
    const shippedQty = Number(data[12]);
    const unitPrice = Number(data[13]);
    const lineTotal = Number(data[14]);
    
    if (data[12] && (isNaN(shippedQty) || shippedQty <= 0)) {
      errors.push('Shipped Qty must be a positive number');
    }
    if (data[13] && (isNaN(unitPrice) || unitPrice < 0)) {
      errors.push('Unit Price must be a non-negative number');
    }
    if (data[14] && (isNaN(lineTotal) || lineTotal < 0)) {
      errors.push('Line Total must be a non-negative number');
    }

    return { isValid: errors.length === 0, errors };
  };

  const validateAppointmentData = (data: string[]): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Required fields validation
    if (!data[0]?.trim()) errors.push('Appointment ID is required');
    if (!data[1]?.trim()) errors.push('PO Number is required');
    if (!data[2]?.trim()) errors.push('Vendor Name is required');
    if (!data[3]?.trim()) errors.push('Date is required');
    if (!data[4]?.trim()) errors.push('Time is required');
    if (!data[5]?.trim()) errors.push('Location is required');
    if (!data[6]?.trim()) errors.push('Purpose is required');
    if (!data[7]?.trim()) errors.push('Status is required');
    if (!data[11]?.trim()) errors.push('Item Name is required');
    
    // Date format validation
    if (data[3] && !/^\d{2}\/\d{2}\/\d{4}$/.test(data[3]) && !/^\d{4}-\d{2}-\d{2}$/.test(data[3])) {
      errors.push('Date must be in DD/MM/YYYY or YYYY-MM-DD format');
    }
    
    // Time format validation
    if (data[4] && !/^\d{2}:\d{2}$/.test(data[4])) {
      errors.push('Time must be in HH:MM format');
    }
    
    // Purpose validation
    if (data[6] && !['delivery', 'inspection', 'meeting', 'pickup'].includes(data[6].toLowerCase())) {
      errors.push('Purpose must be one of: delivery, inspection, meeting, pickup');
    }
    
    // Status validation
    if (data[7] && !['scheduled', 'confirmed', 'prepared', 'shipped', 'in-transit', 'delivered', 'cancelled'].includes(data[7].toLowerCase())) {
      errors.push('Status must be one of: scheduled, confirmed, prepared, shipped, in-transit, delivered, cancelled');
    }
    
    // Quantity and price validation
    const appointmentQty = Number(data[16]);
    const unitPrice = Number(data[17]);
    const lineTotal = Number(data[18]);
    
    if (data[16] && (isNaN(appointmentQty) || appointmentQty <= 0)) {
      errors.push('Appointment Qty must be a positive number');
    }
    if (data[17] && (isNaN(unitPrice) || unitPrice < 0)) {
      errors.push('Unit Price must be a non-negative number');
    }
    if (data[18] && (isNaN(lineTotal) || lineTotal < 0)) {
      errors.push('Line Total must be a non-negative number');
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
    
    // Group shipment items by PO Number and Appointment ID
    const shipmentGroups: Record<string, any> = {};
    
    // Group appointment items by Appointment ID
    const appointmentGroups: Record<string, any> = {};

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
            const warehouses = [];
            
            // Check if warehouse data is provided
            if (row[6] && row[7]) { // Warehouse Name and Address
              warehouses.push({
                id: `WH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: row[6],
                address: row[7],
                type: (row[8] || 'main') as 'main' | 'secondary' | 'distribution' | 'storage',
                contactPerson: row[9] || undefined,
                phone: row[10] || undefined,
                isActive: true
              });
            }

            const vendorData: Omit<Vendor, 'id'> = {
              name: row[0],
              contactPerson: row[1],
              phone: row[2],
              email: row[3] || undefined,
              gst: row[4] || undefined,
              address: row[5] || undefined,
              warehouses: warehouses.length > 0 ? warehouses : undefined,
            };

            await addVendor(vendorData, user.uid, user.email || undefined);
            result.success += 1;
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
            
            // Calculate line total if not provided (adjusted indices after removing Status)
            const orderQty = Number(row[7]);
            const itemPrice = Number(row[8]);
            const lineTotal = row[11] ? Number(row[11]) : (orderQty * itemPrice);
            
            const lineItem = {
              itemName: row[5] || row[4], // Use SKU as item name, fallback to barcode
              barcode: row[4],
              sku: row[5],
              size: row[6] || '',
              warehouse: row[12] || 'Main Warehouse', // New warehouse field
              quantity: orderQty,
              unitPrice: itemPrice,
              total: lineTotal,
              sentQty: Number(row[9]) || 0,
              pendingQty: Number(row[10]) || orderQty
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
                  orderDate: Timestamp.fromDate(parseDate(row[2])),
                  expectedDeliveryDate: Timestamp.fromDate(parseDate(row[3])),
                  status: 'Pending' as PurchaseOrder['status'],
                  createdBy_uid: user.uid,
                  createdBy_name: getUserDisplayName(user, userData),
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
        } else if (type === 'shipments') {
          const validation = validateShipmentData(row);
          
          if (!validation.isValid) {
            result.errors.push({
              row: rowNumber,
              error: validation.errors.join(', '),
              data: row
            });
            continue;
          }

          const poNumber = row[0];
          const appointmentId = row[1];
          
          // Group shipment line items by PO Number and Appointment ID
          const shipmentKey = `${poNumber}-${appointmentId}`;
          if (!shipmentGroups[shipmentKey]) {
            shipmentGroups[shipmentKey] = {
              poNumber: poNumber,
              appointmentId: appointmentId,
              invoiceNumber: row[2],
              shipmentDate: parseDate(row[3]),
              expectedDeliveryDate: row[4] ? parseDate(row[4]) : null,
              carrier: row[5] || '',
              trackingNumber: row[6] || '',
              notes: row[15] || '',
              lineItems: []
            };
          }
          
          // Add line item to shipment
          const shippedQty = parseInt(row[12], 10) || 0;
          const unitPrice = parseFloat(row[13]) || 0;
          const lineTotal = parseFloat(row[14]) || (shippedQty * unitPrice);
          
          shipmentGroups[shipmentKey].lineItems.push({
            itemName: row[7],
            barcode: row[8] || '',
            sku: row[9] || '',
            size: row[10] || '',
            shippedQty: shippedQty,
            unitPrice: unitPrice,
            total: lineTotal
          });

          // Don't count success here - will count after shipment is created
        } else if (type === 'appointments') {
          const validation = validateAppointmentData(row);
          
          if (!validation.isValid) {
            result.errors.push({
              row: rowNumber,
              error: validation.errors.join(', '),
              data: row
            });
            continue;
          }

          const appointmentIdFromRow = row[0];
          
          // Group appointment line items by Appointment ID
          if (!appointmentGroups[appointmentIdFromRow]) {
            appointmentGroups[appointmentIdFromRow] = {
              appointmentId: appointmentIdFromRow,
              poNumber: row[1],
              vendorName: row[2],
              appointmentDate: parseDate(row[3]),
              appointmentTime: row[4],
              location: row[5],
              purpose: row[6].toLowerCase(),
              status: row[7].toLowerCase(),
              transporterName: row[8] || '',
              docketNumber: row[9] || '',
              invoiceNumber: row[10] || '',
              notes: row[19] || '',
              lineItems: []
            };
          }
          
          // Add line item to appointment
          const appointmentQty = parseInt(row[16], 10) || 0;
          const unitPrice = parseFloat(row[17]) || 0;
          const lineTotal = parseFloat(row[18]) || (appointmentQty * unitPrice);
          
          appointmentGroups[appointmentIdFromRow].lineItems.push({
            itemName: row[11],
            barcode: row[12] || '',
            sku: row[13] || '',
            size: row[14] || '',
            warehouse: row[15] || 'Main Warehouse',
            appointmentQty: appointmentQty,
            unitPrice: unitPrice,
            total: lineTotal
          });
          
          result.success += 1;
        }
      }

      // Create POs from grouped data (only for PO import)
      if (type === 'pos') {
        for (const [poNumber, group] of Object.entries(poGroups)) {
          try {
            console.log('Creating PO with number from CSV:', poNumber);
            
            const finalPOData = {
              vendorId: group.poData.vendorId,
              vendorName: group.poData.vendorName,
              orderDate: group.poData.orderDate.toDate().toISOString().split('T')[0],
              expectedDeliveryDate: group.poData.expectedDeliveryDate.toDate().toISOString().split('T')[0],
              lineItems: group.poData.lineItems
            };
            
            const createResult = await poService.createPO(
              finalPOData,
              getUserInfo(user, userData),
              group.poData.vendorName,
              poNumber // Pass the PO number from CSV as custom PO number
            );
            
            console.log('PO created successfully:', createResult);
            result.success = result.success + 1;
          } catch (error: any) {
            result.errors.push({
              row: 0,
              error: `Failed to create PO ${poNumber}: ${error.message}`,
              data: [poNumber]
            });
          }
        }
      }

      // Create shipments from grouped data (only for shipment import)
      if (type === 'shipments') {
        for (const [shipmentKey, group] of Object.entries(shipmentGroups)) {
          try {
            // Calculate total amount
            const totalAmount = group.lineItems.reduce((sum: number, item: any) => sum + item.total, 0);
            
            const shipmentData = {
              poNumber: group.poNumber,
              appointmentId: group.appointmentId,
              invoiceNumber: group.invoiceNumber,
              shipmentDate: Timestamp.fromDate(group.shipmentDate),
              status: 'Prepared' as const,
              createdBy_uid: user.uid,
              createdBy_name: getUserDisplayName(user, userData),
              lineItems: group.lineItems,
              totalAmount: totalAmount,
              ...(group.expectedDeliveryDate && { expectedDeliveryDate: Timestamp.fromDate(group.expectedDeliveryDate) }),
              ...(group.carrier && { carrier: group.carrier }),
              ...(group.trackingNumber && { trackingNumber: group.trackingNumber }),
              ...(group.notes && { notes: group.notes })
            };

            // Create shipment using proper service that updates PO sentQty
            const { createShipment } = await import('@/lib/firestore');
            const shipmentResult = await createShipment(group.poNumber, shipmentData);
            
            console.log('Shipment created successfully:', shipmentResult);
            
            // Create appointment for this shipment
            console.log('🚀 Creating appointment for shipment:', shipmentResult.id);
            try {
              const appointmentDocId = `APT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              const appointmentRef = doc(db, 'appointments', appointmentDocId);
              
              // Get vendor name from PO
              console.log('Fetching PO data for:', group.poNumber);
              const existingPOs = await getPOs(user.uid, userData?.role);
              const relatedPO = existingPOs.find(po => po.poNumber === group.poNumber);
              console.log('Found PO:', relatedPO?.poNumber, 'Vendor:', relatedPO?.vendorName);
              
              const appointmentData = {
                id: appointmentDocId,
                appointmentId: group.appointmentId,
                poNumber: group.poNumber,
                vendorName: relatedPO?.vendorName || 'Unknown Vendor',
                appointmentDate: shipmentData.shipmentDate,
                appointmentTime: '10:00',
                location: 'Warehouse',
                purpose: 'delivery',
                status: 'scheduled',
                transporterId: '',
                transporterName: group.carrier || '',
                transporterEmail: '',
                transporterPhone: '',
                docketNumber: group.trackingNumber || '',
                invoiceNumber: group.invoiceNumber,
                notes: `Imported shipment appointment for ${shipmentResult.id}`,
                createdBy: getUserDisplayName(user, userData),
                createdAt: serverTimestamp(),
                shipmentId: shipmentResult.id,
                lineItems: group.lineItems.map((item: any) => ({
                  itemName: item.itemName,
                  barcode: item.barcode || '',
                  sku: item.sku || '',
                  size: item.size || '',
                  warehouse: item.warehouse || 'Main Warehouse',
                  appointmentQty: item.shippedQty,
                  unitPrice: item.unitPrice,
                  total: item.total
                })),
                totalAmount: totalAmount
              };
              
              console.log('About to create appointment with data:', appointmentData);
              await setDoc(appointmentRef, appointmentData);
              console.log('✅ Appointment created successfully:', appointmentDocId);
              
              // Update shipment with appointmentDocId
              try {
                const shipmentRef = doc(db, 'shipments', shipmentResult.id);
                await updateDoc(shipmentRef, {
                  appointmentDocId: appointmentDocId,
                  appointmentId: group.appointmentId
                });
                console.log('✅ Shipment updated with appointment reference');
              } catch (updateError: any) {
                console.error('❌ Failed to update shipment with appointment:', updateError);
              }
            } catch (appointmentError: any) {
              console.error('❌ Failed to create appointment for shipment:', appointmentError);
              console.error('Error message:', appointmentError.message);
              console.error('Error details:', appointmentError);
              // Add error to result instead of silently continuing
              result.errors.push({
                row: 0,
                error: `Failed to create appointment for shipment ${shipmentResult.id}: ${appointmentError.message}`,
                data: [group.poNumber, group.appointmentId]
              });
            }
            
            result.success += 1;
          } catch (error: any) {
            console.error('🔴 Shipment creation error for', shipmentKey, ':', error);
            result.errors.push({
              row: 0,
              error: `Failed to create shipment ${shipmentKey}: ${error.message || JSON.stringify(error)}`,
              data: [shipmentKey]
            });
          }
        }
      }

      // Create appointments from grouped data (only for appointment import)
      if (type === 'appointments') {
        for (const [appointmentKey, group] of Object.entries(appointmentGroups)) {
          try {
            // Calculate total amount
            const totalAmount = group.lineItems.reduce((sum: number, item: any) => sum + item.total, 0);
            
            const appointmentDataToSave = {
              appointmentId: group.appointmentId,
              poNumber: group.poNumber,
              vendorName: group.vendorName,
              appointmentDate: Timestamp.fromDate(group.appointmentDate),
              appointmentTime: group.appointmentTime,
              location: group.location,
              purpose: group.purpose,
              status: group.status,
              transporterName: group.transporterName,
              docketNumber: group.docketNumber,
              invoiceNumber: group.invoiceNumber,
              notes: group.notes,
              lineItems: group.lineItems,
              totalAmount: totalAmount,
              createdBy: getUserDisplayName(user, userData),
              createdAt: serverTimestamp()
            };

            // Generate appointment ID and create directly
            const appointmentDocId = `APT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const appointmentRef = doc(db, 'appointments', appointmentDocId);
            const appointmentWithId = {
              ...appointmentDataToSave,
              id: appointmentDocId
            };
            
            await setDoc(appointmentRef, appointmentWithId);
            
            console.log('Appointment created successfully:', appointmentDocId);
            result.success = result.success + 1;
          } catch (error: any) {
            result.errors.push({
              row: 0,
              error: `Failed to create appointment ${appointmentKey}: ${error.message}`,
              data: [appointmentKey]
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
    const template = type === 'vendors' ? vendorTemplate : 
                    type === 'pos' ? poTemplate : 
                    type === 'appointments' ? appointmentTemplate : shipmentTemplate;
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
          ['Name', 'Contact Person', 'Phone', 'Email', 'GST', 'Address', 'Warehouse Name', 'Warehouse Address', 'Warehouse Type', 'Warehouse Contact', 'Warehouse Phone']
        ];
        
        // Export vendors with their warehouses (one row per warehouse)
        vendors.forEach(vendor => {
          if (vendor.warehouses && vendor.warehouses.length > 0) {
            vendor.warehouses.forEach(warehouse => {
              exportData.push([
                vendor.name || '',
                vendor.contactPerson || '',
                vendor.phone || '',
                vendor.email || '',
                vendor.gst || '',
                vendor.address || '',
                warehouse.name || '',
                warehouse.address || '',
                warehouse.type || '',
                warehouse.contactPerson || '',
                warehouse.phone || ''
              ]);
            });
          } else {
            // Vendor without warehouses
            exportData.push([
              vendor.name || '',
              vendor.contactPerson || '',
              vendor.phone || '',
              vendor.email || '',
              vendor.gst || '',
              vendor.address || '',
              '', '', '', '', ''
            ]);
          }
        });
        
        csvContent = exportData.map(row => 
          row.map(cell => `"${cell}"`).join(',')
        ).join('\n');
      } else if (type === 'pos') {
        // Fetch real PO data from Firestore
        const pos = await getPOs(user.uid, userData?.role);
        
        const exportData = [
          ['PO Number', 'Vendor Name', 'Order Date', 'Delivery Date', 'Status', 'Item Name', 'Barcode', 'SKU', 'Size', 'Warehouse', 'Order Qty', 'Item Price', 'Sent Qty', 'Pending Qty', 'Line Total']
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
                item.warehouse || 'Main Warehouse',
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
              '', '', '', '', 'Main Warehouse', '0', '0', '0', '0', '0'
            ]);
          }
        });
        
        csvContent = exportData.map(row => 
          row.map(cell => `"${cell}"`).join(',')
        ).join('\n');
      } else if (type === 'appointments') {
        // Fetch real appointment data from Firestore
        const appointmentsRef = collection(db, 'appointments');
        const q = query(appointmentsRef, orderBy('appointmentDate', 'desc'));
        const snapshot = await getDocs(q);
        
        const appointments = snapshot.docs.map(doc => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            ...data,
            appointmentDate: data.appointmentDate?.toDate() || new Date()
          };
        });
        
        const exportData = [
          ['Appointment ID', 'PO Number', 'Vendor Name', 'Date', 'Time', 'Location', 'Purpose', 'Status', 'Transporter', 'Docket Number', 'Notes'],
          ...appointments.map(appointment => [
            appointment.appointmentId || '',
            appointment.poNumber || '',
            appointment.vendorName || '',
            appointment.appointmentDate ? appointment.appointmentDate.toLocaleDateString('en-GB') : '',
            appointment.appointmentTime || '',
            appointment.location || '',
            appointment.purpose || '',
            appointment.status || '',
            appointment.transporterName || '',
            appointment.docketNumber || '',
            appointment.notes || ''
          ])
        ];
        
        csvContent = exportData.map(row => 
          row.map(cell => `"${cell}"`).join(',')
        ).join('\n');
      } else if (type === 'shipments') {
        // Fetch real shipment data from Firestore
        const shipmentsRef = collection(db, 'shipments');
        const q = query(shipmentsRef, orderBy('shipmentDate', 'desc'));
        const snapshot = await getDocs(q);
        
        const shipments = snapshot.docs.map(doc => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            ...data,
            shipmentDate: data.shipmentDate?.toDate() || new Date(),
            expectedDeliveryDate: data.expectedDeliveryDate?.toDate() || null
          };
        });
        
        const exportData = [
          ['PO Number', 'Appointment ID', 'Invoice Number', 'Shipment Date', 'Expected Delivery Date', 'Carrier', 'Tracking Number', 'Notes'],
          ...shipments.map(shipment => [
            shipment.poNumber || '',
            shipment.appointmentId || '',
            shipment.invoiceNumber || '',
            shipment.shipmentDate ? shipment.shipmentDate.toLocaleDateString('en-GB') : '',
            shipment.expectedDeliveryDate ? shipment.expectedDeliveryDate.toLocaleDateString('en-GB') : '',
            shipment.carrier || '',
            shipment.trackingNumber || '',
            shipment.notes || ''
          ])
        ];
        
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
              <FileText className="w-size-6 text-blue-600" />
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
              <X className="w-size-5" />
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
              <Upload className="w-size-4 inline mr-2" />
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
              <Download className="w-size-4 inline mr-2" />
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
                    ) : type === 'pos' ? (
                      <>
                        <li>• Required fields: PO Number, Vendor Name, Order Date, Delivery Date</li>
                        <li>• Item fields required: Barcode, SKU, Order Qty, Item Price</li>
                        <li>• Date format: DD/MM/YYYY (e.g., 15/01/2024) or YYYY-MM-DD (e.g., 2024-01-15)</li>
                        <li>• All new POs will be created with "Pending" status</li>
                        <li>• Status can be changed later using Approve/Reject buttons in the portal</li>
                        <li>• Barcode: Any format accepted (alphanumeric, no length limit)</li>
                        <li>• Quantities: Sent Qty + Pending Qty must equal Order Qty</li>
                        <li>• Multiple items per PO: Use same PO Number for different items</li>
                        <li>• Same PO Number will group items into single Purchase Order</li>
                      </>
                    ) : (
                      <>
                        <li>• Required fields: PO Number, Appointment ID, Invoice Number, Shipment Date</li>
                        <li>• PO Number must exist in the system (will validate against existing POs)</li>
                        <li>• Date format: DD/MM/YYYY (e.g., 21/11/2025) or YYYY-MM-DD (e.g., 2025-11-21)</li>
                        <li>• Only PO details will be accepted - items cannot be modified</li>
                        <li>• Shipment will include all items from the original PO</li>
                        <li>• Carrier and Tracking Number are optional</li>
                        <li>• All shipments will be created with "Prepared" status</li>
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
                    <Download className="w-size-4" />
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
                      <Upload className="w-size-8 text-gray-400 mx-auto mb-2" />
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
                          <FileText className="w-size-4 text-green-600" />
                          <span className="text-sm text-green-800">{importFile.name}</span>
                          <span className="text-xs text-green-600">
                            ({(importFile.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          onClick={() => setShowPreview(!showPreview)}
                          className="flex items-center space-x-1 text-xs text-green-600 hover:text-green-800"
                        >
                          <Eye className="w-size-3" />
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
                         <CheckCircle className="w-size-5 text-green-600" />
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