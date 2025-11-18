'use client';

import { useState, useEffect } from 'react';
import { Clock, FileText, User, Package, CheckCircle, XCircle, Truck, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

interface Activity {
  id: string;
  type: 'po_created' | 'po_updated' | 'po_approved' | 'po_rejected' | 'shipment_created' | 'comment_added';
  title: string;
  description: string;
  timestamp: Date;
  entityId?: string;
  entityType?: 'po' | 'vendor' | 'shipment';
  metadata?: Record<string, any>;
}

interface RecentActivityProps {
  userId?: string;
  limit?: number;
  showFilters?: boolean;
}

export default function RecentActivity({ userId, limit = 10, showFilters = true }: RecentActivityProps) {
  const { user, userData } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'po' | 'shipment' | 'comment'>('all');

  useEffect(() => {
    loadActivities();
  }, [userId, filter]);

  const loadActivities = async () => {
    setLoading(true);

    // TODO: Fetch real activities from Firestore audit logs
    const mockActivities: Activity[] = [];

    // Filter activities
    let filtered = mockActivities;
    if (filter !== 'all') {
      filtered = mockActivities.filter(activity => {
        if (filter === 'po') return activity.type.startsWith('po_');
        if (filter === 'shipment') return activity.type === 'shipment_created';
        if (filter === 'comment') return activity.type === 'comment_added';
        return true;
      });
    }

    setActivities(filtered.slice(0, limit));
    setLoading(false);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'po_created': return <FileText className="w-4 h-4" />;
      case 'po_updated': return <FileText className="w-4 h-4" />;
      case 'po_approved': return <CheckCircle className="w-4 h-4" />;
      case 'po_rejected': return <XCircle className="w-4 h-4" />;
      case 'shipment_created': return <Truck className="w-4 h-4" />;
      case 'comment_added': return <MessageCircle className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'po_created': return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'po_updated': return 'bg-yellow-50 text-yellow-600 border-yellow-200';
      case 'po_approved': return 'bg-green-50 text-green-600 border-green-200';
      case 'po_rejected': return 'bg-red-50 text-red-600 border-red-200';
      case 'shipment_created': return 'bg-purple-50 text-purple-600 border-purple-200';
      case 'comment_added': return 'bg-gray-50 text-gray-600 border-gray-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
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
    return format(timestamp, 'MMM dd, yyyy');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2 text-gray-600">Loading activities...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <p className="text-sm text-gray-600 mt-1">Your recent actions and updates</p>
          </div>

          {showFilters && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('po')}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  filter === 'po' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                POs
              </button>
              <button
                onClick={() => setFilter('shipment')}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  filter === 'shipment' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Shipments
              </button>
              <button
                onClick={() => setFilter('comment')}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  filter === 'comment' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Comments
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
        {activities.map((activity, index) => (
          <div
            key={activity.id}
            className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={() => {
              if (activity.entityId && activity.entityType === 'po') {
                window.location.href = `/pos/${activity.entityId}`;
              }
            }}
          >
            <div className="flex items-start space-x-3">
              <div className={`p-2 rounded-full border ${getActivityColor(activity.type)}`}>
                {getActivityIcon(activity.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                  <span className="text-xs text-gray-500">{formatTimestamp(activity.timestamp)}</span>
                </div>
                <p className="text-sm text-gray-600">{activity.description}</p>
                
                {activity.metadata && (
                  <div className="flex items-center space-x-2 mt-2">
                    {activity.metadata.poNumber && (
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                        {activity.metadata.poNumber}
                      </span>
                    )}
                    {activity.metadata.amount && (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                        ₹{activity.metadata.amount.toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {activities.length === 0 && (
        <div className="text-center p-8 text-gray-500">
          <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p>No recent activity</p>
        </div>
      )}

      {activities.length > 0 && (
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => window.location.href = '/activity'}
            className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View all activity
          </button>
        </div>
      )}
    </div>
  );
}
