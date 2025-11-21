import { Timestamp } from 'firebase/firestore';

// Base interfaces
export interface BaseEntity {
  id?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface User extends BaseEntity {
  email: string;
  name: string;
  role: 'Admin' | 'Manager' | 'Employee';
  uid?: string; // Firebase UID for reference
}

export interface Warehouse {
  id: string;
  name: string;
  address: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  capacity?: number;
  type?: 'main' | 'secondary' | 'distribution' | 'storage';
  isActive: boolean;
}

export interface Vendor extends BaseEntity {
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  gst?: string;
  address?: string;
  warehouses?: Warehouse[];
}

export interface Transporter extends BaseEntity {
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
  warehouses?: Warehouse[];
  active?: boolean;
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

export interface PurchaseOrder extends BaseEntity {
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

export interface ShipmentLineItem {
  itemName: string;
  barcode?: string;
  sku?: string;
  size?: string;
  shippedQty: number;
  unitPrice: number;
  total: number;
}

export interface Shipment extends BaseEntity {
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

export interface ReturnOrder extends BaseEntity {
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
}

export interface Comment extends BaseEntity {
  poId: string;
  userId: string;
  userName: string;
  userRole: string;
  content: string;
  timestamp: Timestamp;
  parentId?: string; // For replies
  likes: string[]; // Array of user IDs who liked
  isEdited?: boolean;
  mentions?: string[]; // Array of mentioned user IDs
}

export interface AuditLog extends BaseEntity {
  action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'login' | 'logout' | 'comment' | 'ship' | 'receive' | 'sync';
  entityType: 'user' | 'vendor' | 'po' | 'ro' | 'shipment' | 'transporter' | 'comment' | 'system' | 'appointment' | 'appointment_shipment_status' | 'shipment_appointment_status';
  entityId: string;
  entityName: string;
  userId: string;
  userName: string;
  userRole: string;
  description: string;
  changes?: Record<string, { old: any; new: any }>;
  metadata?: Record<string, any>;
  timestamp: Timestamp;
  ipAddress?: string;
  userAgent?: string;
}

export interface ActivityItem {
  id: string;
  type: 'po_created' | 'po_updated' | 'po_approved' | 'po_rejected' | 'po_shipped' | 'po_received' | 
        'vendor_added' | 'vendor_updated' | 'vendor_deleted' |
        'ro_created' | 'ro_approved' | 'ro_rejected' |
        'shipment_created' | 'shipment_shipped' | 'shipment_delivered' |
        'comment_added' | 'user_login' | 'user_created';
  user: {
    id: string;
    name: string;
    role: string;
  };
  entity?: {
    type: 'po' | 'vendor' | 'ro' | 'shipment' | 'user';
    id: string;
    name: string;
  };
  description: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Query types
export interface QueryOptions {
  limit?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  where?: Array<{
    field: string;
    operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'not-in' | 'array-contains';
    value: any;
  }>;
}

// Form types
export interface CreatePOForm {
  vendorId: string;
  orderDate: string;
  expectedDeliveryDate: string;
  lineItems: Omit<LineItem, 'total' | 'sentQty' | 'pendingQty' | 'receivedQty'>[];
}

export interface CreateVendorForm {
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  gst?: string;
  address?: string;
}

export interface CreateUserForm {
  email: string;
  name: string;
  role: 'Admin' | 'Manager' | 'Employee';
  password: string;
}

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: any;
}

// Permission types
export interface Permission {
  resource: string;
  action: string;
}

export interface RolePermissions {
  role: string;
  permissions: Permission[];
}