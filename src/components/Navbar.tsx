'use client';

import Link from 'next/link';
import GlobalSearch from './GlobalSearch';
import TeamNotifications from './TeamNotifications';
import { getThemeClasses } from '@/styles/theme';

export default function Navbar() {

  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-white shadow-sm border-b border-gray-200">
      <div className="h-16 relative flex items-center justify-between px-4">
        {/* PO Tracker - Fixed position relative to viewport */}
        <div className="absolute left-16 top-1/2 transform -translate-y-1/2">
          <Link href="/dashboard" className={`${getThemeClasses.pageTitle()} text-blue-600 hover:text-blue-700 transition-colors cursor-pointer`}>
            PO Tracker
          </Link>
        </div>
        
        {/* Spacer */}
        <div className="flex-1"></div>
        
        {/* Right side - Search and Notifications */}
        <div className="flex items-center space-x-3">
          <GlobalSearch />
          <TeamNotifications />
        </div>
      </div>
    </nav>
  );
}
