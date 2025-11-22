import { db } from './firebase';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, query, where } from 'firebase/firestore';

// User-specific permissions interface
export interface UserPermissions {
  userId: string;
  userEmail: string;
  userName: string;
  role: RoleType;
  customPermissions?: Permission[]; // If set, overrides role permissions
  useRolePermissions: boolean; // If true, use role permissions; if false, use custom
  updatedAt?: Date;
  updatedBy?: string;
}

// Permission types
export type Permission = 
  // PO Permissions
  | 'po.view' | 'po.create' | 'po.edit' | 'po.delete' | 'po.approve' | 'po.reject'
  // Vendor Permissions
  | 'vendor.view' | 'vendor.create' | 'vendor.edit' | 'vendor.delete'
  // User Permissions
  | 'user.view' | 'user.create' | 'user.edit' | 'user.delete'
  // Shipment Permissions
  | 'shipment.view' | 'shipment.create' | 'shipment.edit' | 'shipment.delete'
  // Report Permissions
  | 'report.view' | 'report.export' | 'report.compliance'
  // Settings Permissions
  | 'settings.view' | 'settings.edit' | 'permissions.manage'
  // Audit Permissions
  | 'audit.view' | 'audit.export';

export type RoleType = 'Admin' | 'Manager' | 'Employee';

export interface RolePermissions {
  role: RoleType;
  permissions: Permission[];
  description: string;
  updatedAt?: Date;
  updatedBy?: string;
}

// Default permissions for each role
export const DEFAULT_PERMISSIONS: Record<RoleType, Permission[]> = {
  Admin: [
    // All permissions
    'po.view', 'po.create', 'po.edit', 'po.delete', 'po.approve', 'po.reject',
    'vendor.view', 'vendor.create', 'vendor.edit', 'vendor.delete',
    'user.view', 'user.create', 'user.edit', 'user.delete',
    'shipment.view', 'shipment.create', 'shipment.edit', 'shipment.delete',
    'report.view', 'report.export', 'report.compliance',
    'settings.view', 'settings.edit', 'permissions.manage',
    'audit.view', 'audit.export'
  ],
  Manager: [
    // PO permissions
    'po.view', 'po.create', 'po.edit', 'po.approve', 'po.reject',
    // Vendor permissions
    'vendor.view', 'vendor.create', 'vendor.edit',
    // User permissions (limited)
    'user.view',
    // Shipment permissions
    'shipment.view', 'shipment.create', 'shipment.edit',
    // Report permissions
    'report.view', 'report.export', 'report.compliance',
    // Audit permissions
    'audit.view'
  ],
  Employee: [
    // PO permissions (limited)
    'po.view', 'po.create', 'po.edit',
    // Vendor permissions (view only)
    'vendor.view',
    // Shipment permissions (view only)
    'shipment.view',
    // Report permissions (view only)
    'report.view'
  ]
};

// Permission descriptions
export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  'po.view': 'View purchase orders',
  'po.create': 'Create new purchase orders',
  'po.edit': 'Edit purchase orders',
  'po.delete': 'Delete purchase orders',
  'po.approve': 'Approve purchase orders',
  'po.reject': 'Reject purchase orders',
  'vendor.view': 'View vendors',
  'vendor.create': 'Create new vendors',
  'vendor.edit': 'Edit vendor details',
  'vendor.delete': 'Delete vendors',
  'user.view': 'View users',
  'user.create': 'Create new users',
  'user.edit': 'Edit user details',
  'user.delete': 'Delete users',
  'shipment.view': 'View shipments',
  'shipment.create': 'Create new shipments',
  'shipment.edit': 'Edit shipment details',
  'shipment.delete': 'Delete shipments',
  'report.view': 'View reports',
  'report.export': 'Export reports',
  'report.compliance': 'Generate compliance reports',
  'settings.view': 'View settings',
  'settings.edit': 'Edit settings',
  'permissions.manage': 'Manage role permissions',
  'audit.view': 'View audit logs',
  'audit.export': 'Export audit logs'
};

// Permission categories
export const PERMISSION_CATEGORIES = {
  'Purchase Orders': ['po.view', 'po.create', 'po.edit', 'po.delete', 'po.approve', 'po.reject'],
  'Vendors': ['vendor.view', 'vendor.create', 'vendor.edit', 'vendor.delete'],
  'Users': ['user.view', 'user.create', 'user.edit', 'user.delete'],
  'Shipments': ['shipment.view', 'shipment.create', 'shipment.edit', 'shipment.delete'],
  'Reports': ['report.view', 'report.export', 'report.compliance'],
  'Settings': ['settings.view', 'settings.edit', 'permissions.manage'],
  'Audit': ['audit.view', 'audit.export']
};

// Get user-specific permissions
/**
* Retrieves the appropriate permissions for a user based on role or custom overrides.
* @example
* sync('user123', 'user@example.com', 'Member')
* [ { id: 'read' }, { id: 'write' } ]
* @param {{string}} {{userId}} - Unique identifier of the user.
* @param {{string}} {{userEmail}} - E-mail address of the user.
* @param {{RoleType}} {{userRole}} - Role assigned to the user.
* @returns {{Promise<Permission[]>}} Resolves to the permissions array applicable to the user.
**/
export const getUserPermissions = async (userId: string, userEmail: string, userRole: RoleType): Promise<Permission[]> => {
  try {
    // Admin always gets all permissions
    if (userRole === 'Admin') {
      return DEFAULT_PERMISSIONS.Admin;
    }

    // Check if user has custom permissions
    const userDocRef = doc(db, 'userPermissions', userId);
    const userDocSnap = await getDoc(userDocRef);
    
    if (userDocSnap.exists()) {
      const userPerms = userDocSnap.data() as UserPermissions;
      
      // If user has custom permissions and not using role permissions
      if (!userPerms.useRolePermissions && userPerms.customPermissions) {
        return userPerms.customPermissions;
      }
    }
    
    // Otherwise, use role permissions
    const rolePerms = await getRolePermissions(userRole);
    return rolePerms.permissions;
  } catch (error) {
    // Fallback to role permissions
    return DEFAULT_PERMISSIONS[userRole];
  }
};

// Get all users with custom permissions
export const getAllUserPermissions = async (): Promise<UserPermissions[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'userPermissions'));
    return snapshot.docs.map(doc => ({ 
      userId: doc.id, 
      ...doc.data() 
    } as UserPermissions));
  } catch (error) {
    return [];
  }
};

// Update user-specific permissions (Admin only)
/**
* Synchronizes user permissions by writing the provided details into the userPermissions document.
* @example
* sync('user123', 'user@example.com', 'Jane Doe', RoleType.Admin, [], true, 'system')
* undefined
* @param {{string}} {{userId}} - Identifier of the user whose permissions are being synced.
* @param {{string}} {{userEmail}} - Email of the user.
* @param {{string}} {{userName}} - Display name of the user.
* @param {{RoleType}} {{role}} - Role assigned to the user.
* @param {{Permission[]}} {{customPermissions}} - Custom permissions explicitly granted to the user.
* @param {{boolean}} {{useRolePermissions}} - Flag indicating whether role permissions should be applied.
* @param {{string}} {{updatedBy}} - Identifier of the actor performing the update.
* @returns {{Promise<void>}} Promise that resolves once the permissions document is updated.
**/
export const updateUserPermissions = async (
  userId: string,
  userEmail: string,
  userName: string,
  role: RoleType,
  customPermissions: Permission[],
  useRolePermissions: boolean,
  updatedBy: string
): Promise<void> => {
  const userDocRef = doc(db, 'userPermissions', userId);
  const userPerms: UserPermissions = {
    userId,
    userEmail,
    userName,
    role,
    customPermissions,
    useRolePermissions,
    updatedAt: new Date(),
    updatedBy
  };
  
  await setDoc(userDocRef, userPerms);
};

// Delete user-specific permissions (revert to role permissions)
/**
* Synchronizes user permissions in Firestore for the given user ID.
* @example
* sync("user123")
* Promise<void>
* @param {{string}} {{userId}} - Identifier of the user whose permissions should be synced.
* @returns {{Promise<void>}} Promise that resolves when the sync operation is complete.
**/
export const deleteUserPermissions = async (userId: string): Promise<void> => {
  const userDocRef = doc(db, 'userPermissions', userId);
  await setDoc(userDocRef, {
    userId,
    useRolePermissions: true,
    updatedAt: new Date()
  }, { merge: true });
};

// Get role permissions from Firestore
/**
* Retrieves permissions for a given role, falling back to defaults if needed.
* @example
* sync('admin')
* Promise.resolve({ role: 'admin', permissions: ['read'], description: 'Default permissions for admin' })
* @param {RoleType} role - Role identifier to fetch permissions for.
* @returns {Promise<RolePermissions>} Promise resolving to the permissions object for the specified role.
**/
export const getRolePermissions = async (role: RoleType): Promise<RolePermissions> => {
  try {
    const docRef = doc(db, 'rolePermissions', role);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as RolePermissions;
    }
    
    // Return default permissions if not found
    return {
      role,
      permissions: DEFAULT_PERMISSIONS[role],
      description: `Default permissions for ${role}`
    };
  } catch (error) {
    return {
      role,
      permissions: DEFAULT_PERMISSIONS[role],
      description: `Default permissions for ${role}`
    };
  }
};

// Get all role permissions
/**
* Retrieves stored role permissions from Firestore, falling back to default permissions when no data is available or an error occurs.
* @example
* sync()
* [{ role: 'admin', permissions: [...], description: 'Default permissions for admin' }, ...]
* @returns {Promise<RolePermissions[]>} A promise that resolves to the array of role permissions.
**/
export const getAllRolePermissions = async (): Promise<RolePermissions[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'rolePermissions'));
    const permissions = snapshot.docs.map(doc => doc.data() as RolePermissions);
    
    // If no permissions found, return defaults
    if (permissions.length === 0) {
      return Object.entries(DEFAULT_PERMISSIONS).map(([role, perms]) => ({
        role: role as RoleType,
        permissions: perms,
        description: `Default permissions for ${role}`
      }));
    }
    
    return permissions;
  } catch (error) {
    return Object.entries(DEFAULT_PERMISSIONS).map(([role, perms]) => ({
      role: role as RoleType,
      permissions: perms,
      description: `Default permissions for ${role}`
    }));
  }
};

// Update role permissions (Admin only)
/**
* Synchronizes role permissions in Firestore for the provided role.
* @example
* sync('admin', [{resource: 'users', action: 'read'}], 'system')
* undefined
* @param {{RoleType}} {{role}} - Role identifier for which permissions are updated.
* @param {{Permission[]}} {{permissions}} - Array of permissions to assign to the role.
* @param {{string}} {{updatedBy}} - Identifier of the user applying the update.
* @returns {{Promise<void>}} Promise resolving once the Firestore document is written.
**/
export const updateRolePermissions = async (
  role: RoleType,
  permissions: Permission[],
  updatedBy: string
): Promise<void> => {
  try {
    const docRef = doc(db, 'rolePermissions', role);
    const rolePermissions: RolePermissions = {
      role,
      permissions,
      description: `Permissions for ${role}`,
      updatedAt: new Date(),
      updatedBy
    };
    
    await setDoc(docRef, rolePermissions);
  } catch (error) {
    throw error;
  }
};

// Check if user has permission
export const hasPermission = (
  userPermissions: Permission[],
  requiredPermission: Permission
): boolean => {
  return userPermissions.includes(requiredPermission);
};

// Check if user has any of the permissions
export const hasAnyPermission = (
  userPermissions: Permission[],
  requiredPermissions: Permission[]
): boolean => {
  return requiredPermissions.some(perm => userPermissions.includes(perm));
};

// Check if user has all permissions
export const hasAllPermissions = (
  userPermissions: Permission[],
  requiredPermissions: Permission[]
): boolean => {
  return requiredPermissions.every(perm => userPermissions.includes(perm));
};

// Initialize default permissions in Firestore
/****
* Synchronizes default role permissions in the database by ensuring each role has its permissions document.
* @example
* sync()
* Promise<void>
* @returns {Promise<void>} Resolves when all default role permissions have been ensured in the database.
****/
export const initializeDefaultPermissions = async (): Promise<void> => {
  const roles: RoleType[] = ['Admin', 'Manager', 'Employee'];
  
  for (const role of roles) {
    const docRef = doc(db, 'rolePermissions', role);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      const rolePermissions: RolePermissions = {
        role,
        permissions: DEFAULT_PERMISSIONS[role],
        description: `Default permissions for ${role}`,
        updatedAt: new Date(),
        updatedBy: 'System'
      };
      
      await setDoc(docRef, rolePermissions);
    }
  }
};
