'use client';

import { useState, useEffect } from 'react';
import { Clock, User, FileText, Edit, Trash, Plus, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { getAuditLogs, AuditLog } from '@/lib/auditLogs';

interface VersionHistoryEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  userRole: string;
  action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'login' | 'logout' | 'comment' | 'ship' | 'receive';
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  description?: string;
}

interface VersionHistoryProps {
  entityId: string;
  entityType: 'po' | 'vendor' | 'user';
  onRestore?: (versionId: string) => void;
}

export default function VersionHistory({ entityId, entityType, onRestore }: VersionHistoryProps) {
  const [versions, setVersions] = useState<VersionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  useEffect(() => {
    loadVersionHistory();
  }, [entityId]);

  const loadVersionHistory = async () => {
    setLoading(true);
    
    try {
      const auditLogs = await getAuditLogs(entityId, entityType, undefined, 50);
      
      const versionEntries: VersionHistoryEntry[] = auditLogs.map(log => ({
        id: log.id || '',
        timestamp: log.timestamp.toDate(),
        userId: log.userId,
        userName: log.userName,
        userRole: log.userRole,
        action: log.action,
        changes: log.changes ? Object.entries(log.changes).map(([field, change]) => ({
          field,
          oldValue: change.old,
          newValue: change.new
        })) : [],
        description: log.description
      }));

      setVersions(versionEntries);
    } catch (error) {
      console.error('Failed to load version history:', error);
      setVersions([]);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create': return <Plus className="w-4 h-4" />;
      case 'update': return <Edit className="w-4 h-4" />;
      case 'delete': return <Trash className="w-4 h-4" />;
      case 'approve': return <CheckCircle className="w-4 h-4" />;
      case 'reject': return <Trash className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'bg-green-50 text-green-600 border-green-200';
      case 'update': return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'delete': return 'bg-red-50 text-red-600 border-red-200';
      case 'approve': return 'bg-purple-50 text-purple-600 border-purple-200';
      case 'reject': return 'bg-red-50 text-red-600 border-red-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const formatValue = (value: any) => {
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    return String(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2 text-gray-600">Loading history...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Version History</h3>
        <p className="text-sm text-gray-600 mt-1">{versions.length} changes recorded</p>
      </div>

      <div className="divide-y divide-gray-200">
        {versions.map((version, index) => (
          <div
            key={version.id}
            className={`p-4 hover:bg-gray-50 transition-colors ${
              selectedVersion === version.id ? 'bg-blue-50' : ''
            }`}
          >
            <div className="flex items-start space-x-4">
              {/* Timeline */}
              <div className="flex flex-col items-center">
                <div className={`p-2 rounded-full border ${getActionColor(version.action)}`}>
                  {getActionIcon(version.action)}
                </div>
                {index < versions.length - 1 && (
                  <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getActionColor(version.action)}`}>
                      {version.action.toUpperCase()}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{version.description}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>{format(version.timestamp, 'MMM dd, yyyy HH:mm')}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-sm text-gray-600 mb-3">
                  <User className="w-4 h-4" />
                  <span>{version.userName}</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-xs text-gray-500">{version.userRole}</span>
                </div>

                {version.changes.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    {version.changes.map((change, changeIndex) => (
                      <div key={changeIndex} className="flex items-center space-x-2 text-sm">
                        <span className="font-medium text-gray-700 min-w-[120px]">
                          {change.field}:
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded line-through">
                            {formatValue(change.oldValue)}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded font-medium">
                            {formatValue(change.newValue)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {onRestore && version.action !== 'create' && (
                  <button
                    onClick={() => onRestore(version.id)}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Restore this version
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {versions.length === 0 && (
        <div className="text-center p-8 text-gray-500">
          <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p>No version history available</p>
        </div>
      )}
    </div>
  );
}
