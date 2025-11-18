'use client';

import { useState, useEffect } from 'react';
import { Bell, X, Check, User, MessageCircle, FileText, AlertCircle, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ToastContainer';

interface Notification {
  id: string;
  type: 'mention' | 'approval' | 'comment' | 'po_update' | 'system';
  title: string;
  message: string;
  fromUser?: {
    id: string;
    name: string;
    role: string;
  };
  entityType?: 'po' | 'vendor' | 'user';
  entityId?: string;
  entityName?: string;
  timestamp: Date;
  isRead: boolean;
  actionUrl?: string;
}

interface TeamNotificationsProps {
  className?: string;
}

export default function TeamNotifications({ className = '' }: TeamNotificationsProps) {
  const { user, userData } = useAuth();
  const { showSuccess } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Mock notifications - in real app, fetch from Firestore
  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  const loadNotifications = async () => {
    setLoading(true);
    
    // Mock data - replace with actual Firestore query
    const mockNotifications: Notification[] = [
      {
        id: '1',
        type: 'mention',
        title: 'You were mentioned',
        message: '@you mentioned you in PO-2024-001 comments',
        fromUser: {
          id: 'user1',
          name: 'Rajesh Kumar',
          role: 'Manager'
        },
        entityType: 'po',
        entityId: 'po1',
        entityName: 'PO-2024-001',
        timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        isRead: false,
        actionUrl: '/pos/po1'
      },
      {
        id: '2',
        type: 'approval',
        title: 'Approval Required',
        message: 'PO-2024-002 requires your approval (₹2,50,000)',
        fromUser: {
          id: 'user2',
          name: 'Priya Sharma',
          role: 'Employee'
        },
        entityType: 'po',
        entityId: 'po2',
        entityName: 'PO-2024-002',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        isRead: false,
        actionUrl: '/pos/po2'
      },
      {
        id: '3',
        type: 'comment',
        title: 'New Comment',
        message: 'New comment added to PO-2024-001',
        fromUser: {
          id: 'user3',
          name: 'Amit Singh',
          role: 'Employee'
        },
        entityType: 'po',
        entityId: 'po1',
        entityName: 'PO-2024-001',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        isRead: true,
        actionUrl: '/pos/po1'
      },
      {
        id: '4',
        type: 'po_update',
        title: 'PO Status Updated',
        message: 'PO-2024-003 has been approved and is ready for shipping',
        entityType: 'po',
        entityId: 'po3',
        entityName: 'PO-2024-003',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        isRead: true,
        actionUrl: '/pos/po3'
      },
      {
        id: '5',
        type: 'system',
        title: 'System Maintenance',
        message: 'Scheduled maintenance completed successfully',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        isRead: true
      }
    ];

    setNotifications(mockNotifications);
    setLoading(false);
  };

  const markAsRead = async (notificationId: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId 
          ? { ...notif, isRead: true }
          : notif
      )
    );
  };

  const markAllAsRead = async () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, isRead: true }))
    );
    showSuccess('Notifications', 'All notifications marked as read');
  };

  const deleteNotification = async (notificationId: string) => {
    setNotifications(prev => 
      prev.filter(notif => notif.id !== notificationId)
    );
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
    
    setIsOpen(false);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'mention':
        return <MessageCircle className="w-4 h-4 text-blue-600" />;
      case 'approval':
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-green-600" />;
      case 'po_update':
        return <FileText className="w-4 h-4 text-purple-600" />;
      case 'system':
        return <Bell className="w-4 h-4 text-gray-600" />;
      default:
        return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return timestamp.toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">
                Notifications ({unreadCount} unread)
              </h3>
              
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="ml-2 text-gray-600">Loading...</span>
                </div>
              ) : notifications.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !notification.isRead ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          {getNotificationIcon(notification.type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className={`text-sm font-medium ${
                              !notification.isRead ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {notification.title}
                            </p>
                            
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-500">
                                {formatTimestamp(notification.timestamp)}
                              </span>
                              
                              {!notification.isRead && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              )}
                            </div>
                          </div>
                          
                          <p className="text-sm text-gray-600 mb-2">
                            {notification.message}
                          </p>
                          
                          {notification.fromUser && (
                            <div className="flex items-center space-x-2 text-xs text-gray-500">
                              <User className="w-3 h-3" />
                              <span>{notification.fromUser.name}</span>
                              <span>•</span>
                              <span>{notification.fromUser.role}</span>
                            </div>
                          )}
                          
                          {notification.entityName && (
                            <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                              <FileText className="w-3 h-3" />
                              <span>{notification.entityName}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 rounded"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 text-gray-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>No notifications</p>
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    // Navigate to full notifications page
                    window.location.href = '/notifications';
                  }}
                  className="w-full text-center text-sm text-blue-600 hover:text-blue-800"
                >
                  View all notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}