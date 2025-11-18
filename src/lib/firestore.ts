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
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { logAuditEvent } from './auditLogs';

export interface User {
  email: string;
  name: string;
  role: 'Admin' | 'Manager' | 'Employee';
  uid?: string; // Firebase UID for reference
  password?: string; // Plain text password
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
  console.log('Adding vendor to Firestore:', vendor);
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
    
    console.log('Vendor added with ID:', docId);
    return { id: docId };
  } catch (error) {
    console.error('Firestore addVendor error:', error);
    throw error;
  }
};

export const getVendors = async (): Promise<Vendor[]> => {
  console.log('Fetching vendors from Firestore...');
  try {
    const snapshot = await getDocs(collection(db, 'vendors'));
    const vendors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor));
    console.log('Vendors fetched:', vendors);
    return vendors;
  } catch (error) {
    console.error('Firestore getVendors error:', error);
    throw error;
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

// PO operations
export const createPO = async (po: Omit<PurchaseOrder, 'id' | 'poNumber'>) => {
  const poNumber = await generatePONumber();
  const poData = {
    ...po,
    poNumber,
    createdAt: serverTimestamp(),
  };
  return await addDoc(collection(db, 'purchaseOrders'), poData);
};

export const createPOWithCustomNumber = async (po: Omit<PurchaseOrder, 'id'>) => {
  // Use PO number as document ID for consistency
  const docId = po.poNumber.replace(/[^a-zA-Z0-9]/g, '-');
  const poRef = doc(db, 'purchaseOrders', docId);
  
  const poData = {
    ...po,
    createdAt: serverTimestamp(),
  };
  
  await setDoc(poRef, poData);
  return { id: docId };
};

// Create PO with organized subcollection structure
export const createPOWithOrganizedStructure = async (po: Omit<PurchaseOrder, 'id'>) => {
  console.log('Creating PO with organized structure:', po.poNumber);
  
  const orderDate = po.orderDate.toDate();
  const year = orderDate.getFullYear();
  const month = String(orderDate.getMonth() + 1).padStart(2, '0');
  
  console.log('Date info:', { year, month, orderDate });
  
  try {
    // Create vendor document first (if it doesn't exist)
    const vendorDocRef = doc(db, 'purchaseOrders', po.vendorId);
    console.log('Creating vendor document:', po.vendorId);
    await setDoc(vendorDocRef, {
      vendorId: po.vendorId,
      vendorName: po.vendorName,
      createdAt: serverTimestamp()
    }, { merge: true });
    
    // Create year document
    const yearDocRef = doc(vendorDocRef, 'years', year.toString());
    console.log('Creating year document:', year.toString());
    await setDoc(yearDocRef, {
      year: year,
      createdAt: serverTimestamp()
    }, { merge: true });
    
    // Create month document
    const monthDocRef = doc(yearDocRef, 'months', month);
    console.log('Creating month document:', month);
    await setDoc(monthDocRef, {
      month: month,
      year: year,
      createdAt: serverTimestamp()
    }, { merge: true });
    
    // Create PO document
    const poDocRef = doc(monthDocRef, 'pos', po.poNumber);
    console.log('Creating PO document:', po.poNumber);
    const poData = {
      ...po,
      createdAt: serverTimestamp(),
    };
    
    await setDoc(poDocRef, poData);
    console.log('PO created successfully at path:', `purchaseOrders/${po.vendorId}/years/${year}/months/${month}/pos/${po.poNumber}`);
    
    return { id: po.poNumber, path: `purchaseOrders/${po.vendorId}/years/${year}/months/${month}/pos/${po.poNumber}` };
  } catch (error) {
    console.error('Error creating organized PO structure:', error);
    throw error;
  }
};

export const getPOs = async (userId?: string, role?: string): Promise<PurchaseOrder[]> => {
  try {
    console.log('getPOs called with userId:', userId, 'role:', role);
    const posRef = collection(db, 'purchaseOrders');
    let q;
    
    if (role === 'Employee' && userId) {
      console.log('Creating employee-specific query');
      q = query(posRef, where('createdBy_uid', '==', userId), orderBy('orderDate', 'desc'));
    } else {
      console.log('Creating general query for all POs');
      q = query(posRef, orderBy('orderDate', 'desc'));
    }
    
    console.log('Executing query...');
    const snapshot = await getDocs(q);
    console.log('Query executed, found', snapshot.docs.length, 'documents');
    
    const pos = snapshot.docs.map(doc => {
      const data = doc.data();
      console.log('Processing document:', doc.id, 'Keys:', Object.keys(data));
      return { id: doc.id, ...data } as PurchaseOrder;
    });
    
    console.log('Returning', pos.length, 'POs from regular structure');
    return pos;
  } catch (error) {
    console.error('Error in getPOs:', error);
    throw error;
  }
};

// Get POs from organized subcollection structure
export const getPOsFromOrganizedStructure = async (userId?: string, role?: string): Promise<PurchaseOrder[]> => {
  try {
    const allPOs: PurchaseOrder[] = [];
    
    console.log('Fetching POs from organized structure...');
    console.log('User ID:', userId, 'Role:', role);
    
    // First, try to get from regular purchaseOrders collection (old structure)
    try {
      console.log('Attempting to fetch from regular structure...');
      const regularPOs = await getPOs(userId, role);
      console.log('Found', regularPOs.length, 'POs in regular structure');
      if (regularPOs.length > 0) {
        console.log('Sample regular PO:', regularPOs[0]);
      }
      allPOs.push(...regularPOs);
    } catch (error) {
      console.error('Error fetching from regular structure:', error);
    }
    
    // Then, get from organized subcollection structure (new structure)
    try {
      console.log('Attempting to fetch from organized structure...');
      const vendorsSnapshot = await getDocs(collection(db, 'purchaseOrders'));
      console.log('Found', vendorsSnapshot.docs.length, 'vendor documents');
      
      for (const vendorDoc of vendorsSnapshot.docs) {
        const vendorId = vendorDoc.id;
        const vendorData = vendorDoc.data();
        
        console.log('Processing vendor document:', vendorId, 'Data keys:', Object.keys(vendorData));
        
        // Skip if this is a regular PO document (not a vendor document)
        if (vendorData.poNumber) {
          console.log('Skipping regular PO document:', vendorId);
          continue;
        }
        
        try {
          // Get all years for this vendor
          console.log(`Checking years for vendor: ${vendorId}`);
          const yearsSnapshot = await getDocs(collection(db, `purchaseOrders/${vendorId}/years`));
          console.log(`Found ${yearsSnapshot.docs.length} years for vendor ${vendorId}`);
          
          for (const yearDoc of yearsSnapshot.docs) {
            const year = yearDoc.id;
            console.log(`Processing year: ${year} for vendor: ${vendorId}`);
            
            try {
              // Get all months for this year
              const monthsSnapshot = await getDocs(collection(db, `purchaseOrders/${vendorId}/years/${year}/months`));
              console.log(`Found ${monthsSnapshot.docs.length} months for ${vendorId}/${year}`);
              
              for (const monthDoc of monthsSnapshot.docs) {
                const month = monthDoc.id;
                console.log(`Processing month: ${month} for ${vendorId}/${year}`);
                
                try {
                  // Get all POs for this month
                  const posSnapshot = await getDocs(collection(db, `purchaseOrders/${vendorId}/years/${year}/months/${month}/pos`));
                  console.log(`Found ${posSnapshot.docs.length} POs for ${vendorId}/${year}/${month}`);
                  
                  for (const poDoc of posSnapshot.docs) {
                    const poData = poDoc.data() as PurchaseOrder;
                    console.log(`Processing PO: ${poDoc.id} for ${vendorId}/${year}/${month}`);
                    
                    // Filter by user role if needed
                    if (role === 'Employee' && userId && poData.createdBy_uid !== userId) {
                      console.log(`Skipping PO ${poDoc.id} - not created by current user`);
                      continue;
                    }
                    
                    allPOs.push({
                      id: poDoc.id,
                      ...poData
                    });
                    console.log(`Added PO: ${poDoc.id} to results`);
                  }
                } catch (error) {
                  console.log(`No POs found for ${vendorId}/${year}/${month}:`, error);
                }
              }
            } catch (error) {
              console.log(`No months found for ${vendorId}/${year}:`, error);
            }
          }
        } catch (error) {
          console.log(`No years found for vendor ${vendorId}:`, error);
        }
      }
    } catch (error) {
      console.log('Error fetching from organized structure:', error);
    }
    
    // Remove duplicates based on PO number
    const uniquePOs = allPOs.filter((po, index, self) => 
      index === self.findIndex(p => p.poNumber === po.poNumber)
    );
    
    // Sort by order date descending
    uniquePOs.sort((a, b) => {
      const dateA = a.orderDate?.toDate?.() || new Date(0);
      const dateB = b.orderDate?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
    
    console.log('Total unique POs found:', uniquePOs.length);
    return uniquePOs;
  } catch (error) {
    console.error('Error fetching organized POs:', error);
    // Fallback to regular getPOs
    return await getPOs(userId, role);
  }
};

export const getPO = async (id: string): Promise<PurchaseOrder | null> => {
  const docRef = doc(db, 'purchaseOrders', id);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as PurchaseOrder;
  }
  return null;
};

// Get single PO from organized structure
export const getPOFromOrganizedStructure = async (poNumber: string): Promise<PurchaseOrder | null> => {
  try {
    console.log('Searching for PO:', poNumber);
    
    // First, try to get from regular purchaseOrders collection (old structure)
    try {
      const regularPO = await getPO(poNumber);
      if (regularPO) {
        console.log('Found PO in regular structure');
        return regularPO;
      }
    } catch (error) {
      console.log('PO not found in regular structure');
    }
    
    // Then, search in organized subcollection structure (new structure)
    const vendorsSnapshot = await getDocs(collection(db, 'purchaseOrders'));
    
    for (const vendorDoc of vendorsSnapshot.docs) {
      const vendorId = vendorDoc.id;
      const vendorData = vendorDoc.data();
      
      // Skip if this is a regular PO document (not a vendor document)
      if (vendorData.poNumber) {
        continue;
      }
      
      try {
        // Get all years for this vendor
        const yearsSnapshot = await getDocs(collection(db, `purchaseOrders/${vendorId}/years`));
        
        for (const yearDoc of yearsSnapshot.docs) {
          const year = yearDoc.id;
          
          try {
            // Get all months for this year
            const monthsSnapshot = await getDocs(collection(db, `purchaseOrders/${vendorId}/years/${year}/months`));
            
            for (const monthDoc of monthsSnapshot.docs) {
              const month = monthDoc.id;
              
              try {
                // Check if PO exists in this month
                const poDocRef = doc(db, `purchaseOrders/${vendorId}/years/${year}/months/${month}/pos`, poNumber);
                const poDocSnap = await getDoc(poDocRef);
                
                if (poDocSnap.exists()) {
                  console.log('Found PO in organized structure:', `${vendorId}/${year}/${month}/${poNumber}`);
                  return {
                    id: poDocSnap.id,
                    ...poDocSnap.data()
                  } as PurchaseOrder;
                }
              } catch (error) {
                // Continue searching
              }
            }
          } catch (error) {
            // Continue searching
          }
        }
      } catch (error) {
        // Continue searching
      }
    }
    
    console.log('PO not found in any structure');
    return null;
  } catch (error) {
    console.error('Error fetching PO from organized structure:', error);
    // Fallback to regular getPO
    return await getPO(poNumber);
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

// Update PO status in organized structure
export const updatePOStatusInOrganizedStructure = async (
  poNumber: string,
  status: PurchaseOrder['status'],
  approvedBy?: string
) => {
  try {
    console.log('Updating PO status:', poNumber, 'to', status);
    
    // First, try to update in regular purchaseOrders collection (old structure)
    try {
      await updatePOStatus(poNumber, status, approvedBy);
      console.log('Updated PO in regular structure');
      return;
    } catch (error) {
      console.log('PO not found in regular structure, searching organized structure');
    }
    
    // Then, search and update in organized subcollection structure (new structure)
    const vendorsSnapshot = await getDocs(collection(db, 'purchaseOrders'));
    
    for (const vendorDoc of vendorsSnapshot.docs) {
      const vendorId = vendorDoc.id;
      const vendorData = vendorDoc.data();
      
      // Skip if this is a regular PO document (not a vendor document)
      if (vendorData.poNumber) {
        continue;
      }
      
      try {
        // Get all years for this vendor
        const yearsSnapshot = await getDocs(collection(db, `purchaseOrders/${vendorId}/years`));
        
        for (const yearDoc of yearsSnapshot.docs) {
          const year = yearDoc.id;
          
          try {
            // Get all months for this year
            const monthsSnapshot = await getDocs(collection(db, `purchaseOrders/${vendorId}/years/${year}/months`));
            
            for (const monthDoc of monthsSnapshot.docs) {
              const month = monthDoc.id;
              
              try {
                // Check if PO exists in this month and update it
                const poDocRef = doc(db, `purchaseOrders/${vendorId}/years/${year}/months/${month}/pos`, poNumber);
                const poDocSnap = await getDoc(poDocRef);
                
                if (poDocSnap.exists()) {
                  const updateData: any = { status };
                  if (approvedBy) {
                    updateData.approvedBy_uid = approvedBy;
                  }
                  
                  await updateDoc(poDocRef, updateData);
                  console.log('Updated PO in organized structure:', `${vendorId}/${year}/${month}/${poNumber}`);
                  return;
                }
              } catch (error) {
                // Continue searching
              }
            }
          } catch (error) {
            // Continue searching
          }
        }
      } catch (error) {
        // Continue searching
      }
    }
    
    throw new Error('PO not found in any structure');
  } catch (error) {
    console.error('Error updating PO status in organized structure:', error);
    throw error;
  }
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

// Test function to check Firestore connectivity
export const testFirestoreConnection = async () => {
  try {
    console.log('Testing Firestore connection...');
    
    // Test 1: Try to read from purchaseOrders collection
    const posRef = collection(db, 'purchaseOrders');
    const snapshot = await getDocs(posRef);
    console.log('Test 1 - purchaseOrders collection:', snapshot.docs.length, 'documents');
    
    // Test 2: Try to read from vendors collection
    const vendorsRef = collection(db, 'vendors');
    const vendorsSnapshot = await getDocs(vendorsRef);
    console.log('Test 2 - vendors collection:', vendorsSnapshot.docs.length, 'documents');
    
    // Test 3: Try to read from users collection
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    console.log('Test 3 - users collection:', usersSnapshot.docs.length, 'documents');
    
    return {
      purchaseOrders: snapshot.docs.length,
      vendors: vendorsSnapshot.docs.length,
      users: usersSnapshot.docs.length
    };
  } catch (error) {
    console.error('Firestore connection test failed:', error);
    throw error;
  }
};

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
    // Find and update PO in organized structure
    const po = await getPOFromOrganizedStructure(poNumber);
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
    
    // Update PO in organized structure
    await updatePOInOrganizedStructure(poNumber, {
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

export const updatePOInOrganizedStructure = async (poNumber: string, updateData: Partial<PurchaseOrder>) => {
  try {
    console.log('Updating PO in organized structure:', poNumber);
    
    // First, try to update in regular purchaseOrders collection (old structure)
    try {
      const docRef = doc(db, 'purchaseOrders', poNumber);
      await updateDoc(docRef, updateData);
      console.log('Updated PO in regular structure');
      return;
    } catch (error) {
      console.log('PO not found in regular structure, searching organized structure');
    }
    
    // Then, search and update in organized subcollection structure (new structure)
    const vendorsSnapshot = await getDocs(collection(db, 'purchaseOrders'));
    
    for (const vendorDoc of vendorsSnapshot.docs) {
      const vendorId = vendorDoc.id;
      const vendorData = vendorDoc.data();
      
      // Skip if this is a regular PO document (not a vendor document)
      if (vendorData.poNumber) {
        continue;
      }
      
      try {
        // Get all years for this vendor
        const yearsSnapshot = await getDocs(collection(db, `purchaseOrders/${vendorId}/years`));
        
        for (const yearDoc of yearsSnapshot.docs) {
          const year = yearDoc.id;
          
          try {
            // Get all months for this year
            const monthsSnapshot = await getDocs(collection(db, `purchaseOrders/${vendorId}/years/${year}/months`));
            
            for (const monthDoc of monthsSnapshot.docs) {
              const month = monthDoc.id;
              
              try {
                // Check if PO exists in this month and update it
                const poDocRef = doc(db, `purchaseOrders/${vendorId}/years/${year}/months/${month}/pos`, poNumber);
                const poDocSnap = await getDoc(poDocRef);
                
                if (poDocSnap.exists()) {
                  await updateDoc(poDocRef, {
                    ...updateData,
                    updatedAt: serverTimestamp()
                  });
                  console.log('Updated PO in organized structure:', `${vendorId}/${year}/${month}/${poNumber}`);
                  return;
                }
              } catch (error) {
                // Continue searching
              }
            }
          } catch (error) {
            // Continue searching
          }
        }
      } catch (error) {
        // Continue searching
      }
    }
    
    throw new Error('PO not found in any structure');
  } catch (error) {
    console.error('Error updating PO in organized structure:', error);
    throw error;
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
    const po = await getPOFromOrganizedStructure(poNumber);
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
    
    await updatePOInOrganizedStructure(poNumber, {
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
