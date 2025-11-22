'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, Save, RotateCcw, User, Lock, Unlock, AlertCircle, CheckCircle, Search } from 'lucide-react';
import { 
  Permission, 
  UserPermissions,
  getAllUserPermissions,
  updateUserPermissions,
  deleteUserPermissions,
  PERMISSION_CATEGORIES,
  PERMISSION_DESCRIPTIONS,
  DEFAULT_PERMISSIONS,
  RoleType
} from '@/lib/permissions';
import { getAllUsers } from '@/lib/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ToastContainer';

/**
* Renders the user permissions management interface with loading, selection, filtering, and permission updates.
* @example
* UserPermissionsManager()
* <div className="space-y-6">…</div>
* @returns {{JSX.Element}} Rendered permission management UI.
**/
export default function UserPermissionsManager() {
  const { user, userData } = useAuth();
  const { showSuccess, showError } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [userPermissions, setUserPermissions] = useState<Record<string, UserPermissions>>({});
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [allUsers, allUserPerms] = await Promise.all([
        getAllUsers(),
        getAllUserPermissions()
      ]);
      
      setUsers(allUsers);
      
      // Create map of user permissions
      const permsMap: Record<string, UserPermissions> = {};
      allUserPerms.forEach(up => {
        permsMap[up.userId] = up;
      });
      
      setUserPermissions(permsMap);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Error', 'Failed to load user permissions');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getSelectedUserData = () => {
    if (!selectedUser) return null;
    return users.find(u => u.id === selectedUser);
  };

  /**
  * Returns the effective permissions for the currently selected user.
  * @example
  * getPermissionsForSelectedUser()
  * [/* some permissions */
  const getSelectedUserPermissions = (): Permission[] => {
    if (!selectedUser) return [];
    
    const selectedUserData = getSelectedUserData();
    if (!selectedUserData) return [];
    
    // Admin always has all permissions
    if (selectedUserData.role === 'Admin') {
      return DEFAULT_PERMISSIONS.Admin;
    }
    
    const userPerms = userPermissions[selectedUser];
    
    if (userPerms && !userPerms.useRolePermissions && userPerms.customPermissions) {
      return userPerms.customPermissions;
    }
    
    // Use role permissions
    return DEFAULT_PERMISSIONS[selectedUserData.role as RoleType] || [];
  };

  const isUsingRolePermissions = (): boolean => {
    if (!selectedUser) return true;
    const userPerms = userPermissions[selectedUser];
    return !userPerms || userPerms.useRolePermissions;
  };

  /**
  * Toggle a custom permission for the currently selected non-admin user.
  * @example
  * toggleSelectedUserPermission('edit_posts')
  * undefined
  * @param {{Permission}} {{permission}} - Permission to add or remove for the selected user.
  * @returns {{void}} No return value.
  **/
  const togglePermission = (permission: Permission) => {
    if (!selectedUser) return;
    
    const selectedUserData = getSelectedUserData();
    if (!selectedUserData || selectedUserData.role === 'Admin') return;
    
    const currentPerms = getSelectedUserPermissions();
    const newPerms = currentPerms.includes(permission)
      ? currentPerms.filter(p => p !== permission)
      : [...currentPerms, permission];
    
    setUserPermissions(prev => ({
      ...prev,
      [selectedUser]: {
        userId: selectedUser,
        userEmail: selectedUserData.email,
        userName: selectedUserData.name,
        role: selectedUserData.role,
        customPermissions: newPerms,
        useRolePermissions: false
      }
    }));
    
    setHasChanges(true);
  };

  /****
  * Toggles all permissions within the given category for the currently selected non-admin user.
  * @example
  * toggleCategoryPermissions('analytics')
  * undefined
  * @param {{string}} {{category}} - Category key identifying which permission group to toggle for the selected user.
  * @returns {{void}} No return value.
  ****/
  const selectAllInCategory = (category: string) => {
    if (!selectedUser) return;
    
    const selectedUserData = getSelectedUserData();
    if (!selectedUserData || selectedUserData.role === 'Admin') return;
    
    const categoryPerms = PERMISSION_CATEGORIES[category as keyof typeof PERMISSION_CATEGORIES] as Permission[];
    const currentPerms = getSelectedUserPermissions();
    const allSelected = categoryPerms.every(p => currentPerms.includes(p));
    
    let newPerms: Permission[];
    if (allSelected) {
      newPerms = currentPerms.filter(p => !categoryPerms.includes(p));
    } else {
      const toAdd = categoryPerms.filter(p => !currentPerms.includes(p));
      newPerms = [...currentPerms, ...toAdd];
    }
    
    setUserPermissions(prev => ({
      ...prev,
      [selectedUser]: {
        userId: selectedUser,
        userEmail: selectedUserData.email,
        userName: selectedUserData.name,
        role: selectedUserData.role,
        customPermissions: newPerms,
        useRolePermissions: false
      }
    }));
    
    setHasChanges(true);
  };

  /**
  * Resets the selected user's permissions to their role defaults after confirmation.
  * @example
  * sync()
  * undefined
  * @returns {Promise<void>} Resolves after attempting to reset permissions or handling failure.
  **/
  const resetToRolePermissions = async () => {
    if (!selectedUser) return;
    
    const selectedUserData = getSelectedUserData();
    if (!selectedUserData) return;
    
    if (confirm(`Reset ${selectedUserData.name}'s permissions to their role defaults?`)) {
      try {
        await deleteUserPermissions(selectedUser);
        
        setUserPermissions(prev => {
          const newPerms = { ...prev };
          delete newPerms[selectedUser];
          return newPerms;
        });
        
        showSuccess('Success', 'Permissions reset to role defaults');
        setHasChanges(false);
      } catch (error) {
        showError('Error', 'Failed to reset permissions');
      }
    }
  };

  /**
  * Synchronizes selected user permissions by validating admin access and updating records via API.
  * @example
  * sync()
  * undefined
  * @param {{}} {{}} - No parameters.
  * @returns {{Promise<void>}} Promise resolving when synchronization completes.
  **/
  const savePermissions = async () => {
    if (!user || userData?.role !== 'Admin') {
      showError('Access Denied', 'Only admins can update permissions');
      return;
    }

    if (!selectedUser) return;
    
    const selectedUserData = getSelectedUserData();
    if (!selectedUserData) return;

    try {
      setSaving(true);
      
      const userPerms = userPermissions[selectedUser];
      
      await updateUserPermissions(
        selectedUser,
        selectedUserData.email,
        selectedUserData.name,
        selectedUserData.role,
        userPerms?.customPermissions || [],
        userPerms?.useRolePermissions !== false,
        user.email || user.uid
      );
      
      showSuccess('Success', `Permissions updated for ${selectedUserData.name}`);
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving permissions:', error);
      showError('Error', 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin': return 'bg-red-50 text-red-700 border-red-200';
      case 'Manager': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Employee': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="size-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-gray-600">Loading users...</span>
      </div>
    );
  }

  const selectedUserData = getSelectedUserData();
  const currentUserPerms = getSelectedUserPermissions();
  const permissionCount = currentUserPerms.length;
  const totalPermissions = Object.values(PERMISSION_CATEGORIES).flat().length;
  const usingRolePerms = isUsingRolePermissions();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <User className="size-7 text-blue-600" />
            <span>User Permissions Management</span>
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Assign custom permissions to individual users. Admin users always have all permissions.
          </p>
        </div>

        {hasChanges && selectedUser && (
          <div className="flex items-center space-x-3">
            <button
              onClick={loadData}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RotateCcw className="size-4 inline mr-2" />
              Discard Changes
            </button>
            <button
              onClick={savePermissions}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="size-4" />
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
          <AlertCircle className="size-5 text-yellow-600 shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium">View Only Mode</p>
            <p>You can view permissions but only administrators can modify them.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">Select User</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {filteredUsers.map(u => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u.id)}
                  className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedUser === u.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">{u.name}</span>
                    {u.role === 'Admin' && (
                      <Shield className="size-4 text-red-600" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{u.email}</p>
                  <span className={`inline-block mt-2 px-2 py-1 text-xs rounded-full ${getRoleColor(u.role)}`}>
                    {u.role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Permissions Panel */}
        <div className="lg:col-span-2">
          {!selectedUser ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <User className="size-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Select a user to manage their permissions</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                      <User className="size-5" />
                      <span>{selectedUserData?.name}</span>
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedUserData?.role === 'Admin' ? (
                        <span className="text-red-600 font-medium">Admin users have all permissions by default</span>
                      ) : usingRolePerms ? (
                        <span>Using role permissions ({permissionCount} permissions)</span>
                      ) : (
                        <span>Using custom permissions ({permissionCount} permissions)</span>
                      )}
                    </p>
                  </div>
                  
                  {selectedUserData?.role !== 'Admin' && !usingRolePerms && (
                    <button
                      onClick={resetToRolePermissions}
                      disabled={userData?.role !== 'Admin'}
                      className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RotateCcw className="size-4 inline mr-2" />
                      Reset to Role Permissions
                    </button>
                  )}
                </div>
              </div>

              {selectedUserData?.role === 'Admin' ? (
                <div className="p-6">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
                    <Shield className="size-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-red-800">
                      <p className="font-medium mb-1">Administrator Account</p>
                      <p>Admin users automatically have all {totalPermissions} permissions and cannot be restricted.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  {Object.entries(PERMISSION_CATEGORIES).map(([category, perms]) => {
                    const categoryPerms = perms as Permission[];
                    const enabledCount = categoryPerms.filter(p => currentUserPerms.includes(p)).length;
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
                              onClick={() => selectAllInCategory(category)}
                              disabled={userData?.role !== 'Admin'}
                              className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {allEnabled ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>
                        </div>

                        <div className="p-4 space-y-2">
                          {categoryPerms.map(permission => {
                            const isEnabled = currentUserPerms.includes(permission);
                            
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
                                  onChange={() => togglePermission(permission)}
                                  disabled={userData?.role !== 'Admin'}
                                  className="size-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed"
                                />
                                
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    {isEnabled ? (
                                      <Unlock className="size-4 text-blue-600" />
                                    ) : (
                                      <Lock className="size-4 text-gray-400" />
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
                                  <CheckCircle className="size-5 text-blue-600" />
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
