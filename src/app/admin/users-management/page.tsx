'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { UserPlus, Users, Shield, User, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getThemeClasses } from '@/styles/theme';
import UserRegistration from '@/components/UserRegistration';
import PermissionsManager from '@/components/PermissionsManager';
import UserPermissionsManager from '@/components/UserPermissionsManager';
import { getAllUsers, updateUser, deleteUser } from '@/lib/firestore';
import { useToast } from '@/components/ToastContainer';
import { Edit, Trash2, X, Save } from 'lucide-react';

type TabType = 'users' | 'create' | 'role-permissions' | 'user-permissions';

/**
* Renders the admin users management interface with tabs for listing, creating, and managing permissions.
* @example
* UsersManagementPage()
* <div className="min-h-screen bg-gray-50">…</div>
* @returns {JSX.Element} A JSX tree containing the users management dashboard UI.
**/
export default function UsersManagementPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    role: 'Employee' as 'Admin' | 'Manager' | 'Employee'
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && (!user || userData?.role !== 'Admin')) {
      router.push('/dashboard');
    }
  }, [user, userData, loading, router]);

  useEffect(() => {
    if (user && userData?.role === 'Admin') {
      loadUsers();
    }
  }, [user, userData]);

  const loadUsers = async () => {
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setEditFormData({
      name: user.name,
      email: user.email,
      role: user.role
    });
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingUser(null);
  };

  /**
  * Handles synchronizing user edits by submitting form data and updating the user list.
  * @example
  * sync(sampleEvent)
  * Promise<void>
  * @param {{React.FormEvent}} {{e}} - Form event for submitting edited user data.
  * @returns {{Promise<void>}} Promise that resolves when the update process completes.
  **/
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingUser) return;

    setSaving(true);
    try {
      await updateUser(editingUser.id, editFormData);
      showSuccess('Success', 'User updated successfully');
      await loadUsers();
      handleCloseEditModal();
    } catch (error) {
      console.error('Error updating user:', error);
      showError('Error', 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  /**
  * Prompts for confirmation and deletes a user if confirmed, handling success and error messaging.
  * @example
  * sync(userToDelete)
  * undefined
  * @param {{any}} {{userToDelete}} - The user object to delete, including id and name.
  * @returns {{Promise<void>}} Promise resolving when the deletion flow completes.
  **/
  const handleDeleteUser = async (userToDelete: any) => {
    if (!confirm(`Are you sure you want to delete ${userToDelete.name}?`)) {
      return;
    }

    try {
      await deleteUser(userToDelete.id);
      showSuccess('Success', 'User deleted successfully');
      await loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      showError('Error', 'Failed to delete user');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full size-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'users' as TabType, name: 'Users List', icon: Users, count: users.length },
    { id: 'create' as TabType, name: 'Create User', icon: UserPlus },
    { id: 'role-permissions' as TabType, name: 'Role Permissions', icon: Shield },
    { id: 'user-permissions' as TabType, name: 'User Permissions', icon: User },
  ];

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin': return 'bg-red-50 text-red-700 border-red-200';
      case 'Manager': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Employee': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Sidebar />
      
      <div className="pt-16">
        <main className={`w-full ${getThemeClasses.pagePadding()}`}>
          {/* Breadcrumb */}
          <div className="mb-6">
            <Link 
              href="/admin/dashboard"
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="size-4 mr-2" />
              Back to Admin Dashboard
            </Link>
          </div>

          {/* Page Header */}
          <div className="mb-6">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="size-6 text-blue-600" />
              </div>
              <div>
                <h1 className={getThemeClasses.pageTitle()}>Users Management</h1>
                <p className="text-sm text-gray-600">
                  Manage users, roles, and permissions in one place
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`
                        flex items-center space-x-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors
                        ${isActive
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }
                      `}
                    >
                      <Icon className="size-5" />
                      <span>{tab.name}</span>
                      {tab.count !== undefined && (
                        <span className={`
                          px-2 py-0.5 text-xs rounded-full
                          ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}
                        `}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {/* Users List Tab */}
              {activeTab === 'users' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">All Users</h2>
                    <button
                      onClick={() => setActiveTab('create')}
                      className={`flex items-center space-x-2 ${getThemeClasses.buttonPadding()} ${getThemeClasses.button('primary')}`}
                    >
                      <UserPlus className="size-4" />
                      <span>Create New User</span>
                    </button>
                  </div>

                  {loadingUsers ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full size-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-4 text-gray-600">Loading users...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {users.map((userItem) => (
                        <div
                          key={userItem.id}
                          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="p-2 bg-gray-100 rounded-lg">
                                <User className="size-5 text-gray-600" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-gray-900">{userItem.name}</h3>
                                <p className="text-sm text-gray-600">{userItem.email}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => handleEditUser(userItem)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit User"
                              >
                                <Edit className="size-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(userItem)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete User"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getRoleColor(userItem.role)}`}>
                              {userItem.role}
                            </span>
                            
                            <button
                              onClick={() => setActiveTab('user-permissions')}
                              className="text-sm text-blue-600 hover:text-blue-800"
                            >
                              Permissions
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!loadingUsers && users.length === 0 && (
                    <div className="text-center py-12">
                      <Users className="size-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
                      <p className="text-gray-600 mb-4">Get started by creating your first user</p>
                      <button
                        onClick={() => setActiveTab('create')}
                        className={`${getThemeClasses.buttonPadding()} ${getThemeClasses.button('primary')}`}
                      >
                        <UserPlus className="size-4 inline mr-2" />
                        Create User
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Create User Tab */}
              {activeTab === 'create' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Create New User</h2>
                    <p className="text-sm text-gray-600">
                      Add a new user to the system with their role and permissions
                    </p>
                  </div>
                  <UserRegistration />
                </div>
              )}

              {/* Role Permissions Tab */}
              {activeTab === 'role-permissions' && (
                <div>
                  <PermissionsManager />
                </div>
              )}

              {/* User Permissions Tab */}
              {activeTab === 'user-permissions' && (
                <div>
                  <UserPermissionsManager />
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={handleCloseEditModal} />
          
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Edit User</h2>
                <button
                  onClick={handleCloseEditModal}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <X className="size-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter email"
                    disabled
                    title="Email cannot be changed"
                  />
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Manager">Manager</option>
                    <option value="Employee">Employee</option>
                  </select>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleCloseEditModal}
                    className={`${getThemeClasses.buttonPadding()} ${getThemeClasses.button('secondary')}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className={`flex items-center space-x-2 ${getThemeClasses.buttonPadding()} ${getThemeClasses.button('primary')} disabled:opacity-50`}
                  >
                    {saving ? (
                      <>
                        <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="size-4" />
                        <span>Update User</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
