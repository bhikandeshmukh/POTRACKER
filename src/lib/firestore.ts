import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc, 
  doc, 
  updateDoc, 
  setDoc,
  deleteDoc,
  query, 
  where, 
  orderBy,
  limit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { logAuditEvent } from './auditLogs';
import { logger } from './logger';
import { DatabaseError, NotFoundError } from './errors';

export interface User {
  email: string;
  name: string;
  role: 'Admin' | 'Manager' | 'Employee';
  uid?: string; // Firebase UID for reference
}

export interface Vendor {
  id?: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  gst?: string;
  address?: string;
}

export interface Transporter {
  id?: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  driverName?: string;
  driverPhone?: string;
  address?: string;
  gst?: string;
  panNumber?: string;
  active?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface ReturnOrderItem {
  itemName: string;
  barcode?: string;
  sku?: string;
  size?: string;
  returnQty: number;
  unitPrice: number;
  total: number;
  reason: string;
  condition?: 'Damaged' | 'Defective' | 'Wrong Item' | 'Excess' | 'Other';
}

export interface ReturnOrder {
  id?: string;
  roNumber: string;
  poNumber: string;
  poId: string;
  vendorId: string;
  vendorName: string;
  returnDate: Timestamp;
  totalAmount: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
  createdBy_uid: string;
  createdBy_name: string;
  approvedBy_uid?: string;
  approvedBy_name?: string;
  lineItems: ReturnOrderItem[];
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface LineItem {
  itemName: string;
  barcode?: string;
  sku?: string;
  size?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sentQty?: number;
  pendingQty?: number;
  receivedQty?: number;
}

export interface Shipment {
  id?: string;
  poNumber: string;
  appointmentId: string;
  invoiceNumber: string;
  shipmentDate: Timestamp;
  expectedDeliveryDate?: Timestamp;
  actualDeliveryDate?: Timestamp;
  status: 'Prepared' | 'Shipped' | 'In Transit' | 'Delivered' | 'Cancelled';
  carrier?: string;
  trackingNumber?: string;
  notes?: string;
  createdBy_uid: string;
  createdBy_name: string;
  lineItems: ShipmentLineItem[];
  totalAmount: number;
}

export interface ShipmentLineItem {
  itemName: string;
  barcode?: string;
  sku?: string;
  size?: string;
  shippedQty: number;
  unitPrice: number;
  total: number;
}

export interface PurchaseOrder {
  id?: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  orderDate: Timestamp;
  expectedDeliveryDate: Timestamp;
  totalAmount: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Shipped' | 'Received' | 'Partial';
  createdBy_uid: string;
  createdBy_name: string;
  approvedBy_uid?: string;
  lineItems: LineItem[];
  shipments?: Shipment[];
  totalShippedAmount?: number;
  totalReceivedAmount?: number;
}

// Generate PO Number
export const generatePONumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const posRef = collection(db, 'purchaseOrders');
  const snapshot = await getDocs(posRef);
  const count = snapshot.size + 1;
  return `PO-${year}-${String(count).padStart(3, '0')}`;
};

// Vendor operations
export const addVendor = async (vendor: Omit<Vendor, 'id'>, userId?: string, userEmail?: string) => {
  logger.debug('Adding vendor to Firestore', { vendorName: vendor.name });
  try {
    // Use vendor name as document ID
    const docId = vendorNameToDocId(vendor.name);
    const vendorRef = doc(db, 'vendors', docId);
    
    await setDoc(vendorRef, {
      ...vendor,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Log audit event
    if (userId && userEmail) {
      await logAuditEvent(
        userId,
        userEmail,
        'create',
        'vendor',
        docId,
        vendor.name
      );
    }
    
    logger.info('Vendor added successfully', { vendorId: docId, vendorName: vendor.name });
    return { id: docId };
  } catch (error) {
    logger.error('Failed to add vendor', error, { vendorName: vendor.name });
    throw new DatabaseError('Failed to add vendor', error);
  }
};

export const getVendors = async (): Promise<Vendor[]> => {
  logger.debug('Fetching vendors from Firestore');
  try {
    const snapshot = await getDocs(collection(db, 'vendors'));
    const vendors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor));
    logger.debug('Vendors fetched successfully', { count: vendors.length });
    return vendors;
  } catch (error) {
    logger.error('Failed to fetch vendors', error);
    throw new DatabaseError('Failed to fetch vendors', error);
  }
};

export const updateVendor = async (id: string, vendor: Partial<Vendor>, userId?: string, userEmail?: string) => {
  console.log('Updating vendor:', id, vendor);
  try {
    const vendorRef = doc(db, 'vendors', id);
    await updateDoc(vendorRef, {
      ...vendor,
      updatedAt: serverTimestamp()
    });
    
    // Log audit event
    if (userId && userEmail && vendor.name) {
      await logAuditEvent(
        userId,
        userEmail,
        'update',
        'vendor',
        id,
        vendor.name
      );
    }
    
    console.log('Vendor updated successfully');
  } catch (error) {
    console.error('Firestore updateVendor error:', error);
    throw error;
  }
};

export const deleteVendor = async (id: string, userId?: string, userEmail?: string, vendorName?: string) => {
  console.log('Deleting vendor:', id);
  try {
    const vendorRef = doc(db, 'vendors', id);
    await deleteDoc(vendorRef);
    
    // Log audit event
    if (userId && userEmail && vendorName) {
      await logAuditEvent(
        userId,
        userEmail,
        'delete',
        'vendor',
        id,
        vendorName
      );
    }
    
    console.log('Vendor deleted successfully');
  } catch (error) {
    console.error('Firestore deleteVendor error:', error);
    throw error;
  }
};

// PO operations - SIMPLIFIED (Regular structure only)
export const createPO = async (po: Omit<PurchaseOrder, 'id' | 'poNumber'>) => {
  const poNumber = await generatePONumber();
  const poData = {
    ...po,
    poNumber,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  // Use PO number as document ID for easy retrieval
  const docId = poNumber.replace(/[^a-zA-Z0-9]/g, '-');
  const poRef = doc(db, 'purchaseOrders', docId);
  await setDoc(poRef, poData);
  
  return { id: docId, poNumber };
};

// REMOVED: Organized structure - caused performance issues
// All POs now use simple flat structure in /purchaseOrders/{poNumber}

// Get POs with pagination support
export const getPOs = async (
  userId?: string, 
  role?: string,
  limitCount: number = 50
): Promise<PurchaseOrder[]> => {
  try {
    const posRef = collection(db, 'purchaseOrders');
    let q;
    
    if (role === 'Employee' && userId) {
      q = query(
        posRef, 
        where('createdBy_uid', '==', userId), 
        orderBy('orderDate', 'desc'),
        limit(limitCount)
      );
    } else {
      q = query(
        posRef, 
        orderBy('orderDate', 'desc'),
        limit(limitCount)
      );
    }
    
    const snapshot = await getDocs(q);
    const pos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder));
    
    return pos;
  } catch (error) {
    console.error('Error in getPOs:', error);
    throw error;
  }
};

// REMOVED: Complex organized structure function
// Now using simple flat structure only - much faster!

// Get single PO by ID
export const getPO = async (id: string): Promise<PurchaseOrder | null> => {
  try {
    const docRef = doc(db, 'purchaseOrders', id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as PurchaseOrder;
    }
    return null;
  } catch (error) {
    console.error('Error fetching PO:', error);
    return null;
  }
};

// REMOVED: Organized structure lookup - now using simple flat structure only

export const updatePOStatus = async (
  id: string, 
  status: PurchaseOrder['status'], 
  approvedBy?: string
) => {
  const docRef = doc(db, 'purchaseOrders', id);
  const updateData: any = { status };
  if (approvedBy) {
    updateData.approvedBy_uid = approvedBy;
  }
  return await updateDoc(docRef, updateData);
};



export const updatePO = async (id: string, po: Partial<PurchaseOrder>) => {
  console.log('Updating PO:', id, po);
  try {
    const poRef = doc(db, 'purchaseOrders', id);
    await updateDoc(poRef, {
      ...po,
      updatedAt: serverTimestamp()
    });
    console.log('PO updated successfully');
  } catch (error) {
    console.error('Firestore updatePO error:', error);
    throw error;
  }
};

export const deletePO = async (id: string) => {
  console.log('Deleting PO:', id);
  try {
    const poRef = doc(db, 'purchaseOrders', id);
    await deleteDoc(poRef);
    console.log('PO deleted successfully');
  } catch (error) {
    console.error('Firestore deletePO error:', error);
    throw error;
  }
};

// Helper function to convert email to document ID
export const emailToDocId = (email: string): string => {
  return email.replace(/[@.]/g, '-');
};

// Helper function to convert vendor name to document ID
export const vendorNameToDocId = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

// Transporter operations
export const addTransporter = async (transporter: Omit<Transporter, 'id'>, userId?: string, userEmail?: string) => {
  console.log('Adding transporter to Firestore:', transporter);
  try {
    const docId = vendorNameToDocId(transporter.name);
    const transporterRef = doc(db, 'transporters', docId);
    
    await setDoc(transporterRef, {
      ...transporter,
      active: transporter.active !== false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Log audit event
    if (userId && userEmail) {
      await logAuditEvent(
        userId,
        userEmail,
        'create',
        'transporter',
        docId,
        transporter.name
      );
    }
    
    console.log('Transporter added with ID:', docId);
    return { id: docId };
  } catch (error) {
    console.error('Firestore addTransporter error:', error);
    throw error;
  }
};

export const getTransporters = async (): Promise<Transporter[]> => {
  console.log('Fetching transporters from Firestore...');
  try {
    const snapshot = await getDocs(collection(db, 'transporters'));
    const transporters = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transporter));
    console.log('Transporters fetched:', transporters);
    return transporters;
  } catch (error) {
    console.error('Firestore getTransporters error:', error);
    throw error;
  }
};

export const getTransporter = async (id: string): Promise<Transporter | null> => {
  try {
    const docRef = doc(db, 'transporters', id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Transporter;
    }
    return null;
  } catch (error) {
    console.error('Firestore getTransporter error:', error);
    throw error;
  }
};

export const updateTransporter = async (id: string, transporter: Partial<Transporter>, userId?: string, userEmail?: string) => {
  console.log('Updating transporter:', id, transporter);
  try {
    const transporterRef = doc(db, 'transporters', id);
    await updateDoc(transporterRef, {
      ...transporter,
      updatedAt: serverTimestamp()
    });
    
    // Log audit event
    if (userId && userEmail && transporter.name) {
      await logAuditEvent(
        userId,
        userEmail,
        'update',
        'transporter',
        id,
        transporter.name
      );
    }
    
    console.log('Transporter updated successfully');
  } catch (error) {
    console.error('Firestore updateTransporter error:', error);
    throw error;
  }
};

export const deleteTransporter = async (id: string, userId?: string, userEmail?: string, transporterName?: string) => {
  console.log('Deleting transporter:', id);
  try {
    const transporterRef = doc(db, 'transporters', id);
    await deleteDoc(transporterRef);
    
    // Log audit event
    if (userId && userEmail && transporterName) {
      await logAuditEvent(
        userId,
        userEmail,
        'delete',
        'transporter',
        id,
        transporterName
      );
    }
    
    console.log('Transporter deleted successfully');
  } catch (error) {
    console.error('Firestore deleteTransporter error:', error);
    throw error;
  }
};

// Return Order operations
export const generateRONumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const rosRef = collection(db, 'returnOrders');
  const snapshot = await getDocs(rosRef);
  const count = snapshot.size + 1;
  return `RO-${year}-${String(count).padStart(3, '0')}`;
};

export const createReturnOrder = async (ro: Omit<ReturnOrder, 'id' | 'roNumber'>) => {
  const roNumber = await generateRONumber();
  const roData = {
    ...ro,
    roNumber,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  const docRef = await addDoc(collection(db, 'returnOrders'), roData);
  
  // Log audit event
  await logAuditEvent(
    ro.createdBy_uid,
    ro.createdBy_name,
    'create',
    'ro',
    docRef.id,
    roNumber
  );
  
  return { id: docRef.id, roNumber };
};

export const getReturnOrders = async (userId?: string, role?: string): Promise<ReturnOrder[]> => {
  try {
    const rosRef = collection(db, 'returnOrders');
    let q;
    
    if (role === 'Employee' && userId) {
      q = query(rosRef, where('createdBy_uid', '==', userId), orderBy('returnDate', 'desc'));
    } else {
      q = query(rosRef, orderBy('returnDate', 'desc'));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReturnOrder));
  } catch (error) {
    console.error('Error fetching return orders:', error);
    throw error;
  }
};

export const getReturnOrder = async (id: string): Promise<ReturnOrder | null> => {
  try {
    const docRef = doc(db, 'returnOrders', id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as ReturnOrder;
    }
    return null;
  } catch (error) {
    console.error('Error fetching return order:', error);
    throw error;
  }
};

export const getReturnOrdersByPO = async (poNumber: string): Promise<ReturnOrder[]> => {
  try {
    const rosRef = collection(db, 'returnOrders');
    const q = query(rosRef, where('poNumber', '==', poNumber), orderBy('returnDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReturnOrder));
  } catch (error) {
    console.error('Error fetching return orders by PO:', error);
    return [];
  }
};

export const updateReturnOrderStatus = async (
  id: string,
  status: ReturnOrder['status'],
  approvedBy?: { uid: string; name: string }
) => {
  try {
    const roRef = doc(db, 'returnOrders', id);
    const updateData: any = { 
      status,
      updatedAt: serverTimestamp()
    };
    
    if (approvedBy) {
      updateData.approvedBy_uid = approvedBy.uid;
      updateData.approvedBy_name = approvedBy.name;
    }
    
    await updateDoc(roRef, updateData);
    
    // Log audit event
    if (approvedBy) {
      await logAuditEvent(
        approvedBy.uid,
        approvedBy.name,
        'update',
        'ro',
        id,
        `Status: ${status}`
      );
    }
  } catch (error) {
    console.error('Error updating return order status:', error);
    throw error;
  }
};

export const updateReturnOrder = async (id: string, ro: Partial<ReturnOrder>) => {
  try {
    const roRef = doc(db, 'returnOrders', id);
    await updateDoc(roRef, {
      ...ro,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating return order:', error);
    throw error;
  }
};

export const deleteReturnOrder = async (id: string, userId?: string, userName?: string) => {
  try {
    const roRef = doc(db, 'returnOrders', id);
    await deleteDoc(roRef);
    
    // Log audit event
    if (userId && userName) {
      await logAuditEvent(
        userId,
        userName,
        'delete',
        'ro',
        id,
        'Return Order'
      );
    }
  } catch (error) {
    console.error('Error deleting return order:', error);
    throw error;
  }
};

// Audit Log Interface
export interface AuditLog {
  id?: string;
  action: 'create' | 'update' | 'delete' | 'approve' | 'reject';
  entityType: 'user' | 'vendor' | 'po';
  entityId: string;
  entityName: string;
  userId: string;
  userName: string;
  userRole: string;
  changes?: Record<string, { old: any; new: any }>;
  timestamp: Timestamp;
  ipAddress?: string;
  userAgent?: string;
}

// Audit Log Operations
export const createAuditLog = async (log: Omit<AuditLog, 'id' | 'timestamp'>) => {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      ...log,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
};

export const getAuditLogs = async (entityId?: string, limit = 50): Promise<AuditLog[]> => {
  try {
    const logsRef = collection(db, 'auditLogs');
    let q = query(logsRef, orderBy('timestamp', 'desc'));
    
    if (entityId) {
      q = query(logsRef, where('entityId', '==', entityId), orderBy('timestamp', 'desc'));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.slice(0, limit).map(doc => ({ id: doc.id, ...doc.data() } as AuditLog));
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    return [];
  }
};

// User operations
export const createUser = async (uid: string, user: User) => {
  // Use email-based document ID instead of UID
  const docId = emailToDocId(user.email);
  const userRef = doc(db, 'users', docId);
  const userData = {
    ...user,
    uid, // Store the actual Firebase UID for reference
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  const result = await setDoc(userRef, userData);
  
  // Create audit log
  await createAuditLog({
    action: 'create',
    entityType: 'user',
    entityId: docId,
    entityName: user.name,
    userId: uid,
    userName: user.name,
    userRole: user.role || 'Unknown'
  });
  
  return result;
};

export const getUser = async (uid: string): Promise<User | null> => {
  // First try to get by UID (for backward compatibility)
  let docRef = doc(db, 'users', uid);
  let docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as User;
  }
  
  return null;
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
  const docId = emailToDocId(email);
  const docRef = doc(db, 'users', docId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as User;
  }
  return null;
};

export const getAllUsers = async (): Promise<(User & { id: string })[]> => {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User & { id: string }));
};

export const updateUser = async (id: string, user: Partial<User>) => {
  console.log('Updating user:', id, user);
  try {
    const userRef = doc(db, 'users', id);
    await updateDoc(userRef, {
      ...user,
      updatedAt: serverTimestamp()
    });
    console.log('User updated successfully');
  } catch (error) {
    console.error('Firestore updateUser error:', error);
    throw error;
  }
};

export const deleteUser = async (id: string) => {
  console.log('Deleting user:', id);
  try {
    const userRef = doc(db, 'users', id);
    await deleteDoc(userRef);
    console.log('User deleted successfully');
  } catch (error) {
    console.error('Firestore deleteUser error:', error);
    throw error;
  }
};

// Test function to check Firestore connectivity - REMOVED FOR PERFORMANCE
// This was causing unnecessary reads on every page load
// Use browser console and Firebase console to debug connection issues instead

// Shipment operations
export const createShipment = async (poNumber: string, shipmentData: Omit<Shipment, 'id'>) => {
  try {
    console.log('Creating shipment for PO:', poNumber);
    
    // Generate shipment ID
    const shipmentId = `SHP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create shipment document in shipments collection
    const shipmentRef = doc(db, 'shipments', shipmentId);
    const shipmentWithId = {
      ...shipmentData,
      id: shipmentId,
      poNumber,
      createdAt: serverTimestamp(),
    };
    
    await setDoc(shipmentRef, shipmentWithId);
    
    // Update PO with shipment reference and quantities
    await updatePOWithShipment(poNumber, shipmentWithId);
    
    console.log('Shipment created successfully:', shipmentId);
    return { id: shipmentId };
  } catch (error) {
    console.error('Error creating shipment:', error);
    throw error;
  }
};

export const updatePOWithShipment = async (poNumber: string, shipment: Shipment) => {
  try {
    // Find and update PO
    const po = await getPO(poNumber);
    if (!po) {
      throw new Error('PO not found');
    }
    
    // Update line item quantities
    const updatedLineItems = po.lineItems.map(lineItem => {
      const shipmentItem = shipment.lineItems.find(si => 
        si.sku === lineItem.sku || si.barcode === lineItem.barcode || si.itemName === lineItem.itemName
      );
      
      if (shipmentItem) {
        const newSentQty = (lineItem.sentQty || 0) + shipmentItem.shippedQty;
        const newPendingQty = lineItem.quantity - newSentQty;
        
        return {
          ...lineItem,
          sentQty: newSentQty,
          pendingQty: Math.max(0, newPendingQty)
        };
      }
      
      return lineItem;
    });
    
    // Calculate totals
    const totalShippedAmount = (po.totalShippedAmount || 0) + shipment.totalAmount;
    const allItemsShipped = updatedLineItems.every(item => (item.pendingQty || 0) === 0);
    const someItemsShipped = updatedLineItems.some(item => (item.sentQty || 0) > 0);
    
    // Determine new status
    let newStatus: PurchaseOrder['status'] = po.status;
    if (allItemsShipped) {
      newStatus = 'Shipped';
    } else if (someItemsShipped) {
      newStatus = 'Partial';
    }
    
    // Add shipment to PO shipments array
    const updatedShipments = [...(po.shipments || []), shipment];
    
    // Update PO
    await updatePO(poNumber, {
      lineItems: updatedLineItems,
      shipments: updatedShipments,
      totalShippedAmount,
      status: newStatus
    });
    
    console.log('PO updated with shipment data');
  } catch (error) {
    console.error('Error updating PO with shipment:', error);
    throw error;
  }
};

// REMOVED: updatePOInOrganizedStructure - now using simple updatePO()

export const getShipments = async (poNumber?: string): Promise<Shipment[]> => {
  try {
    const shipmentsRef = collection(db, 'shipments');
    let q;
    
    if (poNumber) {
      q = query(shipmentsRef, where('poNumber', '==', poNumber), orderBy('shipmentDate', 'desc'));
    } else {
      q = query(shipmentsRef, orderBy('shipmentDate', 'desc'));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shipment));
  } catch (error) {
    console.error('Error fetching shipments:', error);
    return [];
  }
};

export const updateShipmentStatus = async (shipmentId: string, status: Shipment['status'], actualDeliveryDate?: Date) => {
  try {
    const shipmentRef = doc(db, 'shipments', shipmentId);
    const updateData: any = { 
      status,
      updatedAt: serverTimestamp()
    };
    
    if (actualDeliveryDate) {
      updateData.actualDeliveryDate = Timestamp.fromDate(actualDeliveryDate);
    }
    
    await updateDoc(shipmentRef, updateData);
    
    // If delivered, update PO received quantities
    if (status === 'Delivered') {
      const shipmentDoc = await getDoc(shipmentRef);
      if (shipmentDoc.exists()) {
        const shipment = shipmentDoc.data() as Shipment;
        await updatePOReceivedQuantities(shipment.poNumber, shipment);
      }
    }
    
    console.log('Shipment status updated successfully');
  } catch (error) {
    console.error('Error updating shipment status:', error);
    throw error;
  }
};

export const updatePOReceivedQuantities = async (poNumber: string, shipment: Shipment) => {
  try {
    const po = await getPO(poNumber);
    if (!po) {
      throw new Error('PO not found');
    }
    
    // Update received quantities
    const updatedLineItems = po.lineItems.map(lineItem => {
      const shipmentItem = shipment.lineItems.find(si => 
        si.sku === lineItem.sku || si.barcode === lineItem.barcode || si.itemName === lineItem.itemName
      );
      
      if (shipmentItem) {
        const newReceivedQty = (lineItem.receivedQty || 0) + shipmentItem.shippedQty;
        
        return {
          ...lineItem,
          receivedQty: newReceivedQty
        };
      }
      
      return lineItem;
    });
    
    // Calculate total received amount
    const totalReceivedAmount = (po.totalReceivedAmount || 0) + shipment.totalAmount;
    const allItemsReceived = updatedLineItems.every(item => 
      (item.receivedQty || 0) >= item.quantity
    );
    
    // Update PO status if all items received
    let newStatus = po.status;
    if (allItemsReceived) {
      newStatus = 'Received';
    }
    
    await updatePO(poNumber, {
      lineItems: updatedLineItems,
      totalReceivedAmount,
      status: newStatus
    });
    
    console.log('PO received quantities updated');
  } catch (error) {
    console.error('Error updating PO received quantities:', error);
    throw error;
  }
};
