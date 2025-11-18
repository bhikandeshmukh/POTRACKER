'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { getAllUsers, getVendors, getPOs, getPOsFromOrganizedStructure } from '@/lib/firestore';
import { Users, Building2, FileText, TrendingUp, Shield, User, Settings } from 'lucide-react';
import { getThemeClasses } from '@/styles/theme';
import Link from 'next/link';

export default function AdminDashboard() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalVendors: 0,
    totalPOs: 0,
    pendingPOs: 0,
    adminUsers: 0,
    managerUsers: 0,
    employeeUsers: 0,
  });
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && (!user || userData?.role !== 'Admin')) {
      router.push('/dashboard');
    }
  }, [user, userData, loading, router]);

  useEffect(() => {
    if (user && userData?.role === 'Admin') {
      loadStats();
    }
  }, [user, userData]);

  const loadStats = async () => {
    try {
      const [users, vendors, pos] = await Promise.all([
        getAllUsers(),
        getVendors(),
        getPOsFromOrganizedStructure()
      ]);

      setStats({
        totalUsers: users.length,
        totalVendors: vendors.length,
        totalPOs: pos.length,
        pendingPOs: pos.filter(po => po.status === 'Pending').length,
        adminUsers: users.filter(u => u.role === 'Admin').length,
        managerUsers: users.filter(u => u.role === 'Manager').length,
        employeeUsers: users.filter(u => u.role === 'Employee').length,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoadingData(false);
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
        <main className="w-full p-8">
          <h1 className={getThemeClasses.pageTitle()}>Admin Dashboard</h1>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Link href="/admin/users" className={`${getThemeClasses.card()} ${getThemeClasses.cardPadding()} hover:shadow-md transition`}>
              <div className="flex items-center">
                <div className={`p-3 ${getThemeClasses.color('blue')} rounded-lg`}>
                  <Users className={getThemeClasses.icon('large')} />
                </div>
                <div className="ml-4">
                  <p className={getThemeClasses.kpiTitle()}>Total Users</p>
                  <p className={getThemeClasses.kpiValue()}>{stats.totalUsers}</p>
                </div>
              </div>
            </Link>

            <Link href="/vendors" className={`${getThemeClasses.card()} ${getThemeClasses.cardPadding()} hover:shadow-md transition`}>
              <div className="flex items-center">
                <div className={`p-3 ${getThemeClasses.color('green')} rounded-lg`}>
                  <Building2 className={getThemeClasses.icon('large')} />
                </div>
                <div className="ml-4">
                  <p className={getThemeClasses.kpiTitle()}>Total Vendors</p>
                  <p className={getThemeClasses.kpiValue()}>{stats.totalVendors}</p>
                </div>
              </div>
            </Link>

            <Link href="/pos" className={`${getThemeClasses.card()} ${getThemeClasses.cardPadding()} hover:shadow-md transition`}>
              <div className="flex items-center">
                <div className={`p-3 ${getThemeClasses.color('purple')} rounded-lg`}>
                  <FileText className={getThemeClasses.icon('large')} />
                </div>
                <div className="ml-4">
                  <p className={getThemeClasses.kpiTitle()}>Total POs</p>
                  <p className={getThemeClasses.kpiValue()}>{stats.totalPOs}</p>
                </div>
              </div>
            </Link>

            <div className={`${getThemeClasses.card()} ${getThemeClasses.cardPadding()}`}>
              <div className="flex items-center">
                <div className={`p-3 ${getThemeClasses.color('yellow')} rounded-lg`}>
                  <TrendingUp className={getThemeClasses.icon('large')} />
                </div>
                <div className="ml-4">
                  <p className={getThemeClasses.kpiTitle()}>Pending POs</p>
                  <p className={getThemeClasses.kpiValue()}>{stats.pendingPOs}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Permissions Management Section */}
          <div className={`${getThemeClasses.card()} ${getThemeClasses.sectionPadding()} mb-8`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className={getThemeClasses.sectionHeading()}>Permissions Management</h2>
                <p className="text-sm text-gray-600">
                  Control access and permissions for roles and individual users
                </p>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <div className="px-3 py-1 bg-red-50 text-red-700 rounded-full border border-red-200">
                  👑 {stats.adminUsers} Admins
                </div>
                <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                  👔 {stats.managerUsers} Managers
                </div>
                <div className="px-3 py-1 bg-green-50 text-green-700 rounded-full border border-green-200">
                  👤 {stats.employeeUsers} Employees
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                href="/admin/permissions"
                className="flex items-start space-x-4 p-5 border-2 border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition group"
              >
                <div className="p-3 bg-blue-600 rounded-lg group-hover:scale-110 transition-transform">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Role Permissions</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Manage permissions for Admin, Manager, and Employee roles
                  </p>
                  <div className="flex items-center space-x-2 text-xs text-blue-700">
                    <span className="px-2 py-1 bg-blue-100 rounded">3 Roles</span>
                    <span className="px-2 py-1 bg-blue-100 rounded">26 Permissions</span>
                    <span className="px-2 py-1 bg-blue-100 rounded">7 Categories</span>
                  </div>
                </div>
              </Link>
              
              <Link
                href="/admin/user-permissions"
                className="flex items-start space-x-4 p-5 border-2 border-purple-200 bg-purple-50 rounded-lg hover:bg-purple-100 hover:border-purple-300 transition group"
              >
                <div className="p-3 bg-purple-600 rounded-lg group-hover:scale-110 transition-transform">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">User Permissions</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Assign custom permissions to individual users
                  </p>
                  <div className="flex items-center space-x-2 text-xs text-purple-700">
                    <span className="px-2 py-1 bg-purple-100 rounded">{stats.totalUsers} Users</span>
                    <span className="px-2 py-1 bg-purple-100 rounded">Custom Access</span>
                    <span className="px-2 py-1 bg-purple-100 rounded">Override Roles</span>
                  </div>
                </div>
              </Link>
            </div>
            
            {/* Quick Info */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-start space-x-3">
                <Settings className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-700">
                  <p className="font-medium mb-1">Permission System Features:</p>
                  <ul className="space-y-1 text-gray-600">
                    <li>• <strong>Role Permissions:</strong> Set default permissions for each role (Admin, Manager, Employee)</li>
                    <li>• <strong>User Permissions:</strong> Override role permissions for specific users with custom access</li>
                    <li>• <strong>Admin Override:</strong> Admin users always have all permissions automatically</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className={`${getThemeClasses.card()} ${getThemeClasses.sectionPadding()}`}>
            <h2 className={getThemeClasses.sectionHeading()}>Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/admin/create-user"
                className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                <Users className={`${getThemeClasses.icon('medium')} text-blue-600`} />
                <span className={getThemeClasses.cardTitle()}>Create New User</span>
              </Link>
              
              <Link
                href="/vendors"
                className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                <Building2 className={`${getThemeClasses.icon('medium')} text-green-600`} />
                <span className={getThemeClasses.cardTitle()}>Manage Vendors</span>
              </Link>
              
              <Link
                href="/pos"
                className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                <FileText className={`${getThemeClasses.icon('medium')} text-purple-600`} />
                <span className={getThemeClasses.cardTitle()}>Manage Purchase Orders</span>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}