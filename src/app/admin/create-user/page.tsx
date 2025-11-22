'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getThemeClasses } from '@/styles/theme';

/**
* Renders a user creation page with a form that handles signup logic and displays status messages.
* @example
* CreateUserPage()
* <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">...</div>
* @param {void} none - This component does not accept any props.
* @returns {JSX.Element} The admin user creation form and related UI.
**/
export default function CreateUserPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'Employee' as 'Admin' | 'Manager' | 'Employee'
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const { signUp } = useAuth();

  /**
  * Handles form submission for creating a new user and updates UI state.
  * @example
  * sync(event)
  * undefined
  * @param {{React.FormEvent}} {{e}} - The form submission event.
  * @returns {{Promise<void>}} Resolves when form handling is complete.
  **/
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await signUp(formData.email, formData.password, formData.name, formData.role);
      setMessage('✅ User created successfully!');
      setFormData({ email: '', password: '', name: '', role: 'Employee' });
    } catch (error: any) {
      console.error('Error creating user:', error);
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className={`${getThemeClasses.card()} ${getThemeClasses.sectionPadding()} w-full max-w-md`}>
        <h1 className={`${getThemeClasses.pageTitle()} ${getThemeClasses.sectionMargin()}`}>Create New User</h1>

        {message && (
          <div className={`mb-4 p-3 rounded ${
            message.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block ${getThemeClasses.description()} mb-2 font-medium`}>
              Email
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className={`block ${getThemeClasses.description()} mb-2 font-medium`}>
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className={`block ${getThemeClasses.description()} mb-2 font-medium`}>
              Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Rahul Sharma"
            />
          </div>

          <div>
            <label className={`block ${getThemeClasses.description()} mb-2 font-medium`}>
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as 'Admin' | 'Manager' | 'Employee' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Employee">Employee</option>
              <option value="Manager">Manager</option>
              <option value="Admin">Admin</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full ${getThemeClasses.buttonPadding()} ${getThemeClasses.button('primary')} disabled:bg-gray-400`}
          >
            {loading ? 'Creating...' : 'Create User'}
          </button>
        </form>
      </div>
    </div>
  );
}
