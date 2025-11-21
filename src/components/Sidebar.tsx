'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, FileText, Users, Settings, UserPlus, X, User, LogOut, Shield, Calendar, Activity } from 'lucide-react';
import { getThemeClasses } from '@/styles/theme';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Purchase Orders', href: '/pos', icon: FileText },
  { name: 'PO Appointments', href: '/appointments', icon: Calendar },
  { name: 'Return Orders', href: '/ros', icon: FileText },
  { name: 'Recent Activity', href: '/activity', icon: Activity },
  { name: 'Vendors', href: '/vendors', icon: Users },
  { name: 'Transporters', href: '/transporters', icon: Users },
];

const adminNavigation = [
  { name: 'Admin Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Users Management', href: '/admin/users-management', icon: UserPlus },
  { name: 'Audit Logs', href: '/audit-logs', icon: Shield },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { userData, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Close sidebar when route changes (auto-close after selection)
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById('sidebar');
      const hamburger = document.getElementById('hamburger-btn');
      
      if (isOpen && sidebar && hamburger && 
          !sidebar.contains(event.target as Node) && 
          !hamburger.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Hamburger Button - Custom 3 lines design */}
      <button
        id="hamburger-btn"
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 p-2 transition-colors"
      >
        {isOpen ? (
          <X className={`${getThemeClasses.icon('medium')} text-gray-700`} />
        ) : (
          <div className="w-5 h-3.5 flex flex-col justify-between">
            <div className="w-5 h-0.5 bg-gray-700 rounded-sm"></div>
            <div className="w-5 h-0.5 bg-gray-700 rounded-sm"></div>
            <div className="w-5 h-0.5 bg-gray-700 rounded-sm"></div>
          </div>
        )}
      </button>

      {/* Overlay for all screen sizes */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar - Always hidden by default, shows on hamburger click */}
      <div 
        id="sidebar"
        className={`
          fixed top-0 left-0 z-40 w-64 bg-white shadow-lg border-r border-gray-200 h-screen pt-4 flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header space for navbar */}
        <div className="h-16"></div>
        
        <nav className="mt-4 px-4 space-y-2 flex-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <item.icon className={getThemeClasses.icon('small')} />
              <span className={getThemeClasses.description()}>{item.name}</span>
            </Link>
          );
        })}
        
        {userData?.role === 'Admin' && (
          <>
            <div className="pt-4 pb-2">
              <h3 className={`px-4 ${getThemeClasses.smallText()} font-semibold uppercase tracking-wider`}>
                Admin Panel
              </h3>
            </div>
            {adminNavigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                    isActive
                      ? 'bg-red-50 text-red-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <item.icon className={getThemeClasses.icon('small')} />
                  <span className={getThemeClasses.description()}>{item.name}</span>
                </Link>
              );
            })}
          </>
        )}
        </nav>

        {/* User Info Section at Bottom */}
        <div className="border-t border-gray-200 p-4 flex-shrink-0">
          <div className="flex items-center space-x-3 mb-3">
            <div className="p-1.5 bg-gray-100 rounded-lg">
              <User className={`${getThemeClasses.icon('small')} text-gray-600`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`${getThemeClasses.smallText()} font-medium text-gray-900 truncate`}>{userData?.name}</p>
              <p className={getThemeClasses.smallText()}>{userData?.role}</p>
            </div>
          </div>
          
          <button
            onClick={signOut}
            className="w-full flex items-center space-x-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className={getThemeClasses.icon('small')} />
            <span className={getThemeClasses.smallText()}>Logout</span>
          </button>
        </div>
      </div>
    </>
  );
}
