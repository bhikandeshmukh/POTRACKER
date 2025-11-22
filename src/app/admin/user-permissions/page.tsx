'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import UserPermissionsManager from '@/components/UserPermissionsManager';
import { User, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getThemeClasses } from '@/styles/theme';

export default function UserPermissionsPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    
    // Only admins can access this page
    if (!loading && userData?.role !== 'Admin') {
      router.push('/dashboard');
    }
  }, [user, userData, loading, router]);

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
                <User className="size-6 text-blue-600" />
              </div>
              <div>
                <h1 className={getThemeClasses.pageTitle()}>User Permissions</h1>
                <p className="text-sm text-gray-600">
                  Assign custom permissions to individual users
                </p>
              </div>
            </div>
          </div>

          {/* User Permissions Manager */}
          <UserPermissionsManager />
        </main>
      </div>
    </div>
  );
}
