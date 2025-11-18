'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { getAllUsers, createUser, updateUser, deleteUser, User } from '@/lib/firestore';
import { Plus, User as UserIcon, Edit, Trash2, Save, X } from 'lucide-react';
import { getThemeClasses } from '@/styles/theme';

export default function UsersManagementPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<(User & { id: string })[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Employee' as 'Admin' | 'Manager' | 'Employee',
  });
  const [editFormData, setEditFormData] = useState<User & { id: string }>({
    id: '',
    name: '',
    email: '',
    role: 'Employee' as 'Admin' | 'Manager' | 'Employee',
  });

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
      console.log('Loading users...');
      const userList = await getAllUsers();
      console.log('Users loaded:', userList);
      setUsers(userList);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // This would need Firebase Admin SDK for creating users with custom passwords
      // Create user with Firebase Authentication and Firestore
      const docId = formData.email.replace(/[@.]/g, '-');
      await createUser(docId, {
        email: formData.email,
        name: formData.name,
        role: formData.role
      });
      setFormData({ name: '', email: '', password: '', role: 'Employee' });
      setShowForm(false);
      loadUsers();
    } catch (error: any) {
      console.error('Error adding user:', error);
      alert('Failed to add user: ' + error.message);
    }
  };

  const handleEdit = (user: User & { id: string }) => {
    setEditingUser(user.id);
    setEditFormData(user);
  };

  const handleUpdate = async (userId: string) => {
    try {
      await updateUser(userId, editFormData);
      setEditingUser(null);
      loadUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      alert('Failed to update user: ' + error.message);
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (confirm(`Are you sure you want to delete "${userName}"?`)) {
      try {
        await deleteUser(userId);
        loadUsers();
      } catch (error: any) {
        console.error('Error deleting user:', error);
        alert('Failed to delete user: ' + error.message);
      }
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <Sidebar />
      
      <div className="pt-16">
        <main className={`w-full ${getThemeClasses.pagePadding()}`}>
          <div className={`flex items-center justify-between ${getThemeClasses.sectionMargin()}`}>
            <h1 className={getThemeClasses.pageTitle()}>Users Management</h1>
            <button
              onClick={() => setShowForm(!showForm)}
              className={`flex items-center space-x-2 ${getThemeClasses.buttonPadding()} ${getThemeClasses.button('primary')}`}
            >
              <Plus className={getThemeClasses.icon('medium')} />
              <span>Add User</span>
            </button>
          </div>

          {showForm && (
            <div className={`${getThemeClasses.card()} ${getThemeClasses.sectionPadding()} ${getThemeClasses.sectionMargin()}`}>
              <h2 className={getThemeClasses.sectionHeading()}>Add New User</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block ${getThemeClasses.description()} mb-2 font-medium`}>Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className={`block ${getThemeClasses.description()} mb-2 font-medium`}>Email *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className={`block ${getThemeClasses.description()} mb-2 font-medium`}>Password *</label>
                    <input
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className={`block ${getThemeClasses.description()} mb-2 font-medium`}>Role *</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as 'Admin' | 'Manager' | 'Employee' })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Employee">Employee</option>
                      <option value="Manager">Manager</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className={`${getThemeClasses.buttonPadding()} ${getThemeClasses.button('secondary')}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`${getThemeClasses.buttonPadding()} ${getThemeClasses.button('primary')}`}
                  >
                    Add User
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className={getThemeClasses.card()}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={`px-6 py-3 text-left ${getThemeClasses.smallText()} font-medium text-gray-500 uppercase`}>Name</th>
                    <th className={`px-6 py-3 text-left ${getThemeClasses.smallText()} font-medium text-gray-500 uppercase`}>Email</th>
                    <th className={`px-6 py-3 text-left ${getThemeClasses.smallText()} font-medium text-gray-500 uppercase`}>Role</th>
                    <th className={`px-6 py-3 text-left ${getThemeClasses.smallText()} font-medium text-gray-500 uppercase`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className={`px-6 py-4 whitespace-nowrap ${getThemeClasses.description()}`}>{user.name}</td>
                      <td className={`px-6 py-4 whitespace-nowrap ${getThemeClasses.description()}`}>{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 ${getThemeClasses.smallText()} font-semibold rounded-full ${
                          user.role === 'Admin' ? 'bg-red-100 text-red-800' :
                          user.role === 'Manager' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap ${getThemeClasses.description()} font-medium`}>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className={getThemeClasses.icon('small')} />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id, user.name)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className={getThemeClasses.icon('small')} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}