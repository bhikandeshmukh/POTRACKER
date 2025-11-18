'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { getAuditLogs, AuditLog, formatAuditAction, getAuditActionColor } from '@/lib/auditLogs';
import { Shield, Clock, User, FileText, Filter, Calendar } from 'lucide-react';
import { getThemeClasses } from '@/styles/theme';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useToast } from '@/components/ToastContainer';

export default function AuditLogsPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const { showError } = useToast();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [filter, setFilter] = useState<{
    entityType: 'all' | 'vendor' | 'po' | 'user';
    dateRange: 'all' | 'today' | 'week' | 'month';
  }>({
    entityType: 'all',
    dateRange: 'all'
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && userData?.role === 'Admin') {
      loadAuditLogs();
    }
  }, [user, userData, filter]);

  const loadAuditLogs = async () => {
    try {
      setLoadingData(true);
      const logs = await getAuditLogs(
        filter.entityType === 'all' ? undefined : filter.entityType,
        undefined,
        200
      );
      
      // Apply date filter
      let filteredLogs = logs;
      if (filter.dateRange !== 'all') {
        const now = new Date();
        const filterDate = new Date();
        
        switch (filter.dateRange) {
          case 'today':
            filterDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            filterDate.setDate(now.getDate() - 7);
            break;
          case 'month':
            filterDate.setMonth(now.getMonth() - 1);
            break;
        }
        
        filteredLogs = logs.filter(log => 
          log.timestamp.toDate() >= filterDate
        );
      }
      
      setAuditLogs(filteredLogs);
    } catch (error: any) {
      console.error('Error loading audit logs:', error);
      showError('Failed to Load Audit Logs', error.message);
    } finally {
      setLoadingData(false);
    }
  };

  const formatTimestamp = (timestamp: any) => {
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'vendor':
        return '🏢';
      case 'po':
        return '📋';
      case 'user':
        return '👤';
      default:
        return '📄';
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading audit logs..." />
      </div>
    );
  }

  if (userData?.role !== 'Admin') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <Sidebar />
        <div className="pt-16">
          <main className={`w-full ${getThemeClasses.pagePadding()}`}>
            <div className="text-center py-12">
              <Shield className={`${getThemeClasses.icon('extraLarge')} text-red-400 mx-auto mb-4`} />
              <h1 className={`${getThemeClasses.pageTitle()} mb-2`}>Access Denied</h1>
              <p className={getThemeClasses.description()}>Only administrators can view audit logs.</p>
            </div>
          </main>
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
            <div className="flex items-center space-x-3">
              <Shield className={`${getThemeClasses.icon('extraLarge')} text-blue-600`} />
              <h1 className={getThemeClasses.pageTitle()}>Audit Logs</h1>
            </div>
            
            {/* Filters */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className={`${getThemeClasses.icon('small')} text-gray-500`} />
                <select
                  value={filter.entityType}
                  onChange={(e) => setFilter(prev => ({ ...prev, entityType: e.target.value as any }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Types</option>
                  <option value="vendor">Vendors</option>
                  <option value="po">Purchase Orders</option>
                  <option value="user">Users</option>
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <Calendar className={`${getThemeClasses.icon('small')} text-gray-500`} />
                <select
                  value={filter.dateRange}
                  onChange={(e) => setFilter(prev => ({ ...prev, dateRange: e.target.value as any }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                </select>
              </div>
            </div>
          </div>

          {/* Audit Logs List */}
          <div className={getThemeClasses.card()}>
            {auditLogs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className={`${getThemeClasses.icon('extraLarge')} text-gray-400 mx-auto mb-4`} />
                <p className={getThemeClasses.description()}>No audit logs found for the selected filters.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        <div className="text-2xl">{getEntityIcon(log.entityType)}</div>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className={`font-medium ${getAuditActionColor(log.action)}`}>
                              {formatAuditAction(log)}
                            </span>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-600 capitalize">{log.entityType}</span>
                          </div>
                          
                          <p className={`${getThemeClasses.cardTitle()} mb-1`}>
                            {log.entityName}
                          </p>
                          
                          <div className={`flex items-center space-x-4 ${getThemeClasses.description()}`}>
                            <div className="flex items-center space-x-1">
                              <User className={getThemeClasses.icon('small')} />
                              <span>{log.userEmail}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Clock className={getThemeClasses.icon('small')} />
                              <span>{formatTimestamp(log.timestamp)}</span>
                            </div>
                          </div>
                          
                          {log.changes && Object.keys(log.changes).length > 0 && (
                            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                              <p className={`${getThemeClasses.description()} font-medium text-gray-700 mb-2`}>Changes:</p>
                              <div className="space-y-1">
                                {Object.entries(log.changes).map(([field, change]) => (
                                  <div key={field} className={getThemeClasses.description()}>
                                    <span className="font-medium text-gray-600">{field}:</span>
                                    <span className="text-red-600 ml-2">"{change.old}"</span>
                                    <span className="text-gray-400 mx-2">→</span>
                                    <span className="text-green-600">"{change.new}"</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <div className={`mt-2 ${getThemeClasses.smallText()}`}>
                              <span>Additional info: {JSON.stringify(log.metadata)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className={`${getThemeClasses.smallText()} text-gray-400`}>
                          ID: {log.entityId.slice(-8)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {auditLogs.length > 0 && (
            <div className={`mt-6 text-center ${getThemeClasses.description()}`}>
              Showing {auditLogs.length} audit log entries
            </div>
          )}
        </main>
      </div>
    </div>
  );
}