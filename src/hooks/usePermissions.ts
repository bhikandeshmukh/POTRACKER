import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Permission, 
  getUserPermissions, 
  hasPermission as checkPermission,
  hasAnyPermission as checkAnyPermission,
  hasAllPermissions as checkAllPermissions
} from '@/lib/permissions';

/**
* Manages and exposes permission helpers for the authenticated user.
* @example
* usePermissions()
* { permissions, loading, hasPermission, hasAnyPermission, hasAllPermissions, canView, canCreate, canEdit, canDelete, isAdmin, isManager, isEmployee }
* @param {void} _ - No parameters.
* @returns {{permissions: Permission[], loading: boolean, hasPermission: (permission: Permission) => boolean, hasAnyPermission: (requiredPermissions: Permission[]) => boolean, hasAllPermissions: (requiredPermissions: Permission[]) => boolean, canView: (resource: string) => boolean, canCreate: (resource: string) => boolean, canEdit: (resource: string) => boolean, canDelete: (resource: string) => boolean, isAdmin: boolean, isManager: boolean, isEmployee: boolean}} Hook state and helpers for user permissions.
**/
export const usePermissions = () => {
  const { user, userData } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /**
    * Synchronizes user permissions and loading state based on current user data.
    * @example
    * sync()
    * undefined
    * @returns {Promise<void>} Updates permissions and loading indicators for the current user.
    **/
    const loadPermissions = async () => {
      if (user && userData?.role) {
        try {
          // Get user-specific permissions (Admin gets all, others get custom or role-based)
          const userPerms = await getUserPermissions(
            user.uid,
            user.email || '',
            userData.role
          );
          setPermissions(userPerms);
        } catch (error) {
          console.error('Error loading permissions:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [user, userData?.role]);

  const hasPermission = (permission: Permission): boolean => {
    return checkPermission(permissions, permission);
  };

  const hasAnyPermission = (requiredPermissions: Permission[]): boolean => {
    return checkAnyPermission(permissions, requiredPermissions);
  };

  const hasAllPermissions = (requiredPermissions: Permission[]): boolean => {
    return checkAllPermissions(permissions, requiredPermissions);
  };

  const canView = (resource: string): boolean => {
    return hasPermission(`${resource}.view` as Permission);
  };

  const canCreate = (resource: string): boolean => {
    return hasPermission(`${resource}.create` as Permission);
  };

  const canEdit = (resource: string): boolean => {
    return hasPermission(`${resource}.edit` as Permission);
  };

  const canDelete = (resource: string): boolean => {
    return hasPermission(`${resource}.delete` as Permission);
  };

  return {
    permissions,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canView,
    canCreate,
    canEdit,
    canDelete,
    isAdmin: userData?.role === 'Admin',
    isManager: userData?.role === 'Manager',
    isEmployee: userData?.role === 'Employee'
  };
};
