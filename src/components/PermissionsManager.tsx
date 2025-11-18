'use client';

import { useState, useEffect } from 'react';
import { Shield, Save, RotateCcw, Lock, Unlock, AlertCircle, CheckCircle } from 'lucide-react';
import { 
  RoleType, 
  Permission, 
  RolePermissions,
  getAllRolePermissions,
  updateRolePermissions,
  PERMISSION_CATEGORIES,
  PERMISSION_DESCRIPTIONS,
  DEFAULT_PERMISSIONS
} from '@/lib/permissions';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ToastContainer';

export default function PermissionsManager() {
  const { user, userData } = useAuth();
  const { showSuccess, showError } = useToast();
  const [rolePermissions, setRolePermissions] = useState<Record<RoleType, Permission[]>>({
    Admin: [],
    Manager: [],
    Employee: []
  });
  const [selectedRole, setSelectedRole] = useState<RoleType>('Manager');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const allPerms = await getAllRolePermissions();
      
      const permsMap: Record<RoleType, Permission[]> = {
        Admin: [],
        Manager: [],
        Employee: []
      };
      
      allPerms.forEach(rp => {
        permsMap[rp.role] = rp.permissions;
      });
      
      setRolePermissions(permsMap);
    } catch (error) {
      console.error('Error loading permissions:', error);
      showError('Error', 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (role: RoleType, permission: Permission) => {
    setRolePermissions(prev => {
      const currentPerms = prev[role];
      const newPerms = currentPerms.includes(permission)
        ? currentPerms.filter(p => p !== permission)
        : [...currentPerms, permission];
      
      setHasChanges(true);
      return { ...prev, [role]: newPerms };
    });
  };

  const selectAllInCategory = (role: RoleType, category: string) => {
    const categoryPerms = PERMISSION_CATEGORIES[category as keyof typeof PERMISSION_CATEGORIES] as Permission[];
    
    setRolePermissions(prev => {
      const currentPerms = prev[role];
      const allSelected = categoryPerms.every(p => currentPerms.includes(p));
      
      let newPerms: Permission[];
      if (allSelected) {
        // Deselect all in category
        newPerms = currentPerms.filter(p => !categoryPerms.includes(p));
      } else {
        // Select all in category
        const toAdd = categoryPerms.filter(p => !currentPerms.includes(p));
        newPerms = [...currentPerms, ...toAdd];
      }
      
      setHasChanges(true);
      return { ...prev, [role]: newPerms };
    });
  };

  const resetToDefaults = (role: RoleType) => {
    if (confirm(`Reset ${role} permissions to defaults?`)) {
      setRolePermissions(prev => ({
        ...prev,
        [role]: DEFAULT_PERMISSIONS[role]
      }));
      setHasChanges(true);
    }
  };

  const savePermissions = async () => {
    if (!user || userData?.role !== 'Admin') {
      showError('Access Denied', 'Only admins can update permissions');
      return;
    }

    try {
      setSaving(true);
      
      // Save all role permissions
      await Promise.all(
        Object.entries(rolePermissions).map(([role, perms]) =>
          updateRolePermissions(role as RoleType, perms, user.email || user.uid)
        )
      );
      
      showSuccess('Success', 'Permissions updated successfully');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving permissions:', error);
      showError('Error', 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const getRoleColor = (role: RoleType) => {
    switch (role) {
      case 'Admin': return 'bg-red-50 text-red-700 border-red-200';
      case 'Manager': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Employee': return 'bg-green-50 text-green-700 border-green-200';
    }
  };

  const getRoleIcon = (role: RoleType) => {
    switch (role) {
      case 'Admin': return '👑';
      case 'Manager': return '👔';
      case 'Employee': return '👤';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-gray-600">Loading permissions...</span>
      </div>
    );
  }

  const currentRolePerms = rolePermissions[selectedRole];
  const permissionCount = currentRolePerms.length;
  const totalPermissions = Object.values(PERMISSION_CATEGORIES).flat().length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <Shield className="w-7 h-7 text-blue-600" />
            <span>Role Permissions Management</span>
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure permissions for each role. Only admins can modify these settings.
          </p>
        </div>

        {hasChanges && (
          <div className="flex items-center space-x-3">
            <button
              onClick={loadPermissions}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RotateCcw className="w-4 h-4 inline mr-2" />
              Discard Changes
            </button>
            <button
              onClick={savePermissions}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Warning for non-admins */}
      {userData?.role !== 'Admin' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium">View Only Mode</p>
            <p>You can view permissions but only administrators can modify them.</p>
          </div>
        </div>
      )}

      {/* Role Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Role</h3>
        <div className="grid grid-cols-3 gap-4">
          {(['Admin', 'Manager', 'Employee'] as RoleType[]).map(role => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedRole === role
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="text-center">
                <div className="text-3xl mb-2">{getRoleIcon(role)}</div>
                <div className="font-semibold text-gray-900">{role}</div>
                <div className="text-sm text-gray-600 mt-1">
                  {rolePermissions[role].length} permissions
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Permissions Grid */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <span className="text-2xl">{getRoleIcon(selectedRole)}</span>
                <span>{selectedRole} Permissions</span>
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {permissionCount} of {totalPermissions} permissions enabled
              </p>
            </div>
            
            <button
              onClick={() => resetToDefaults(selectedRole)}
              disabled={userData?.role !== 'Admin'}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-4 h-4 inline mr-2" />
              Reset to Defaults
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {Object.entries(PERMISSION_CATEGORIES).map(([category, perms]) => {
            const categoryPerms = perms as Permission[];
            const enabledCount = categoryPerms.filter(p => currentRolePerms.includes(p)).length;
            const allEnabled = enabledCount === categoryPerms.length;

            return (
              <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <h4 className="font-semibold text-gray-900">{category}</h4>
                      <span className="text-sm text-gray-600">
                        ({enabledCount}/{categoryPerms.length})
                      </span>
                    </div>
                    
                    <button
                      onClick={() => selectAllInCategory(selectedRole, category)}
                      disabled={userData?.role !== 'Admin'}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {allEnabled ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  {categoryPerms.map(permission => {
                    const isEnabled = currentRolePerms.includes(permission);
                    
                    return (
                      <label
                        key={permission}
                        className={`flex items-center space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${
                          isEnabled
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        } ${userData?.role !== 'Admin' ? 'cursor-not-allowed opacity-75' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => togglePermission(selectedRole, permission)}
                          disabled={userData?.role !== 'Admin'}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed"
                        />
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            {isEnabled ? (
                              <Unlock className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Lock className="w-4 h-4 text-gray-400" />
                            )}
                            <span className="font-medium text-gray-900">
                              {permission}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 ml-6">
                            {PERMISSION_DESCRIPTIONS[permission]}
                          </p>
                        </div>

                        {isEnabled && (
                          <CheckCircle className="w-5 h-5 text-blue-600" />
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Permission Changes</p>
            <p>
              Changes to permissions will take effect immediately after saving. 
              Users will need to refresh their session to see updated permissions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
