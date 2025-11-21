'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import RecentActivity from '@/components/RecentActivity';
import { getThemeClasses } from '@/styles/theme';

export default function ActivityPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
        <main className="w-full px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className={getThemeClasses.sectionMargin()}>
            <h1 className={getThemeClasses.pageTitle()}>Recent Activity</h1>
            <p className={getThemeClasses.description()}>
              Track all system activities and recent changes
            </p>
          </div>

          {/* Activity Feed */}
          <div className={`${getThemeClasses.card()} ${getThemeClasses.cardPadding()}`}>
            <RecentActivity userId={user?.uid} limit={50} showFilters={true} />
          </div>
        </main>
      </div>
    </div>
  );
}