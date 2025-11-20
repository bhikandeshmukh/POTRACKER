'use client';

import { useState, useCallback } from 'react';
import { Activity, User, FileText, Building2, CheckCircle, XCircle, MessageCircle, Clock, Filter } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { auditService } from '@/lib/services';
import { useDataFetching } from '@/hooks/useDataFetching';
import { ActivityItem } from '@/lib/types';

interface ActivityFeedProps {
  entityType?: 'all' | 'po' | 'vendor' | 'user';
  entityId?: string;
  limit?: number;
  showFilters?: boolean;
  className?: string;
}

export default function ActivityFeed({ 
  entityType = 'all', 
  entityId, 
  limit = 50,
  showFilters = true,
  className = '' 
}: ActivityFeedProps) {
  const { user, userData } = useAuth();
  const [filter, setFilter] = useState({
    type: 'all' as 'all' | 'po' | 'vendor' | 'user' | 'comment',
    timeRange: 'week' as 'today' | 'week' | 'month' | 'all'
  });

  const fetchActivities = useCallback(async () => {
    let auditLogsResult;
    
    if (entityId) {
      // Get activities for specific entity
      auditLogsResult = await auditService.getEntityHistory(entityId, limit);
    } else if (entityType !== 'all') {
      // Get activities for specific entity type
      const entityTypeMap = {
        'po': 'po',
        'vendor': 'vendor',
        'user': 'user'
      };
      auditLogsResult = await auditService.getEntityTypeActivity(entityTypeMap[entityType], limit);
    } else if (userData?.role === 'Employee' && user) {
      // Employee sees only their activities
      auditLogsResult = await auditService.getUserActivity(user.uid, limit);
    } else {
      // Admin/Manager sees all activities
      auditLogsResult = await auditService.findMany({ limit, orderBy: 'timestamp', orderDirection: 'desc' });
    }
    
    if (!auditLogsResult.success) {
      return { success: false, error: auditLogsResult.error };
    }

    let activities = auditService.convertToActivityItems(auditLogsResult.data?.data || []);

    // Apply filters
    if (filter.type !== 'all') {
      activities = activities.filter(activity => {
        if (filter.type === 'po') return activity.type.startsWith('po_');
        if (filter.type === 'vendor') return activity.type.startsWith('vendor_');
        if (filter.type === 'user') return activity.type.startsWith('user_');
        if (filter.type === 'comment') return activity.type.startsWith('comment_');
        return true;
      });
    }

    if (filter.timeRange !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      
      switch (filter.timeRange) {
        case 'today':
          cutoff.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoff.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoff.setMonth(now.getMonth() - 1);
          break;
      }
      
      activities = activities.filter(activity => 
        activity.timestamp >= cutoff
      );
    }

    return { success: true, data: activities.slice(0, limit) };
  }, [entityType, entityId, limit, userData?.role, user, filter]);

  const { data: activities, loading, error } = useDataFetching(
    fetchActivities,
    { dependencies: [filter] }
  );

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'po_created':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'po_approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'po_rejected':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'po_shipped':
        return <FileText className="w-4 h-4 text-purple-600" />;
      case 'po_received':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'vendor_added':
        return <Building2 className="w-4 h-4 text-orange-600" />;
      case 'comment_added':
        return <MessageCircle className="w-4 h-4 text-blue-600" />;
      case 'user_login':
        return <User className="w-4 h-4 text-gray-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'po_created':
        return 'bg-blue-50 border-blue-200';
      case 'po_approved':
        return 'bg-green-50 border-green-200';
      case 'po_rejected':
        return 'bg-red-50 border-red-200';
      case 'po_shipped':
        return 'bg-purple-50 border-purple-200';
      case 'po_received':
        return 'bg-green-50 border-green-200';
      case 'vendor_added':
        return 'bg-orange-50 border-orange-200';
      case 'comment_added':
        return 'bg-blue-50 border-blue-200';
      case 'user_login':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-gray-50 border-gray-200';
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

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Activity className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Activity Feed</h3>
          <span className="text-sm text-gray-500">({activities?.length || 0} activities)</span>
        </div>

        {showFilters && (
          <div className="flex items-center space-x-3">
            <select
              value={filter.type}
              onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value as any }))}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="all">All Types</option>
              <option value="po">Purchase Orders</option>
              <option value="vendor">Vendors</option>
              <option value="user">Users</option>
              <option value="comment">Comments</option>
            </select>
            
            <select
              value={filter.timeRange}
              onChange={(e) => setFilter(prev => ({ ...prev, timeRange: e.target.value as any }))}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="today">Today</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="all">All Time</option>
            </select>
          </div>
        )}
      </div>

      {/* Activity List */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-2 text-gray-600">Loading activities...</span>
          </div>
        ) : activities && activities.length > 0 ? (
          <div className="space-y-4">
            {(activities || []).map((activity, index) => (
              <div key={activity.id} className="relative">
                {/* Timeline line */}
                {index < activities.length - 1 && (
                  <div className="absolute left-6 top-8 w-0.5 h-8 bg-gray-200"></div>
                )}
                
                <div className="flex items-start space-x-4">
                  {/* Icon */}
                  <div className={`flex-shrink-0 p-2 rounded-full border ${getActivityColor(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">{activity.user.name}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          activity.user.role === 'Admin' ? 'bg-red-100 text-red-700' :
                          activity.user.role === 'Manager' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {activity.user.role}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimestamp(activity.timestamp)}</span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-700 mb-2">
                      {activity.description}
                    </p>
                    
                    {activity.entity && (
                      <div className="flex items-center space-x-2 text-xs text-gray-500 mb-2">
                        {activity.entity.type === 'po' && <FileText className="w-3 h-3" />}
                        {activity.entity.type === 'vendor' && <Building2 className="w-3 h-3" />}
                        {activity.entity.type === 'user' && <User className="w-3 h-3" />}
                        <span>{activity.entity.name}</span>
                      </div>
                    )}
                    
                    {activity.metadata && (
                      <div className="text-xs text-gray-500 space-y-1">
                        {activity.metadata.amount && (
                          <div>Amount: ₹{activity.metadata.amount.toLocaleString()}</div>
                        )}
                        {activity.metadata.reason && (
                          <div>Reason: {activity.metadata.reason}</div>
                        )}
                        {activity.metadata.comment && (
                          <div className="italic">"{activity.metadata.comment}"</div>
                        )}
                        {activity.metadata.trackingNumber && (
                          <div>Tracking: {activity.metadata.trackingNumber}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Activity className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No activities found</p>
            <p className="text-sm mt-1">Activities will appear here as team members interact with the system</p>
          </div>
        )}
      </div>
    </div>
  );
}