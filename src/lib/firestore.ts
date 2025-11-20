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
  } catch (error) {
    throw new DatabaseError('Failed to update vendor', error);
  }
};

export const deleteVendor = async (id: string, userId?: string, userEmail?: string, vendorName?: string) => {
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
  } catch (error) {
    throw new DatabaseError('Failed to delete vendor', error);
  }
};

// PO operations - SIMPLIFIED (Regular structure only)
// UPDATED: Now accepts optional poNumber. If provided (e.g. from import), it uses it. If not, it generates one.
export const createPO = async (po: Omit<PurchaseOrder, 'id'> | Omit<PurchaseOrder, 'id' | 'poNumber'>) => {
  let poNumber: string;

  // Check if poNumber is provided in the input object
  if ('poNumber' in po && po.poNumber) {
    poNumber = po.poNumber;
  } else {
    // Generate new if not provided
    poNumber = await generatePONumber();
  }

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
    throw new DatabaseError('Failed to fetch purchase orders', error);
  }
};

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
    return null;
  }
};

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
  try {
    const poRef = doc(db, 'purchaseOrders', id);
    await updateDoc(poRef, {
      ...po,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    throw new DatabaseError('Failed to update purchase order', error);
  }
};

export const deletePO = async (id: string) => {
  try {
    const poRef = doc(db, 'purchaseOrders', id);
    await deleteDoc(poRef);
  } catch (error) {
    throw new DatabaseError('Failed to delete purchase order', error);
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
    
    return { id: docId };
  } catch (error) {
    throw new DatabaseError('Failed to add transporter', error);
  }
};

export const getTransporters = async (): Promise<Transporter[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'transporters'));
    const transporters = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transporter));
    return transporters;
  } catch (error) {
    throw new DatabaseError('Failed to fetch transporters', error);
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
    return null;
  }
};

export const updateTransporter = async (id: string, transporter: Partial<Transporter>, userId?: string, userEmail?: string) => {
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
  } catch (error) {
    throw new DatabaseError('Failed to update transporter', error);
  }
};

export const deleteTransporter = async (id: string, userId?: string, userEmail?: string, transporterName?: string) => {
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
  } catch (error) {
    throw new DatabaseError('Failed to delete transporter', error);
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
    throw new DatabaseError('Failed to fetch return orders', error);
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
    return null;
  }
};

export const getReturnOrdersByPO = async (poNumber: string): Promise<ReturnOrder[]> => {
  try {
    const rosRef = collection(db, 'returnOrders');
    const q = query(rosRef, where('poNumber', '==', poNumber), orderBy('returnDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReturnOrder));
  } catch (error) {
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
    throw new DatabaseError('Failed to update return order status', error);
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
    throw new DatabaseError('Failed to update return order', error);
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
  try {
    const userRef = doc(db, 'users', id);
    await updateDoc(userRef, {
      ...user,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    throw new DatabaseError('Failed to update user', error);
  }
};

export const deleteUser = async (id: string) => {
  try {
    const userRef = doc(db, 'users', id);
    await deleteDoc(userRef);
  } catch (error) {
    throw new DatabaseError('Failed to delete user', error);
  }
};

// Shipment operations
export const createShipment = async (poNumber: string, shipmentData: Omit<Shipment, 'id'>) => {
  try {
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
    
    return { id: shipmentId };
  } catch (error) {
    throw new DatabaseError('Failed to create shipment', error);
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
  } catch (error) {
    throw new DatabaseError('Failed to update PO with shipment', error);
  }
};

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
  } catch (error) {
    throw new DatabaseError('Failed to update shipment status', error);
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
  } catch (error) {
    throw new DatabaseError('Failed to update PO received quantities', error);
  }
};
