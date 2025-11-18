'use client';

import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';

export interface AuditLog {
  id?: string;
  userId: string;
  userEmail: string;
  action: string;
  entityType: 'vendor' | 'po' | 'user' | 'transporter' | 'ro';
  entityId: string;
  entityName: string;
  changes?: Record<string, { old: any; new: any }>;
  metadata?: Record<string, any>;
  timestamp: Timestamp;
  ipAddress?: string;
}

export async function logAuditEvent(
  userId: string,
  userEmail: string,
  action: string,
  entityType: AuditLog['entityType'],
  entityId: string,
  entityName: string,
  changes?: Record<string, { old: any; new: any }>,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const auditLog: Omit<AuditLog, 'id'> = {
      userId,
      userEmail,
      action,
      entityType,
      entityId,
      entityName,
      changes,
      metadata,
      timestamp: Timestamp.now(),
      ipAddress: 'unknown' // In a real app, you'd get this from the request
    };

    await addDoc(collection(db, 'auditLogs'), auditLog);
  } catch (error) {
    // Silent fail - audit logging shouldn't break the main operation
  }
}

export async function getAuditLogs(
  entityType?: AuditLog['entityType'],
  entityId?: string,
  limitCount: number = 100
): Promise<AuditLog[]> {
  try {
    let q = query(
      collection(db, 'auditLogs'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    if (entityType && entityId) {
      q = query(
        collection(db, 'auditLogs'),
        where('entityType', '==', entityType),
        where('entityId', '==', entityId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
    } else if (entityType) {
      q = query(
        collection(db, 'auditLogs'),
        where('entityType', '==', entityType),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AuditLog));
  } catch (error) {
    return [];
  }
}

export async function getUserAuditLogs(
  userId: string,
  limitCount: number = 50
): Promise<AuditLog[]> {
  try {
    const q = query(
      collection(db, 'auditLogs'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AuditLog));
  } catch (error) {
    return [];
  }
}

// Helper function to format audit log actions
export function formatAuditAction(log: AuditLog): string {
  const actionMap: Record<string, string> = {
    'create': 'Created',
    'update': 'Updated',
    'delete': 'Deleted',
    'bulk_delete': 'Bulk Deleted',
    'bulk_archive': 'Bulk Archived',
    'bulk_export': 'Bulk Exported',
    'login': 'Logged In',
    'logout': 'Logged Out',
    'password_change': 'Changed Password',
    'role_change': 'Role Changed'
  };

  return actionMap[log.action] || log.action;
}

// Helper function to get action color
export function getAuditActionColor(action: string): string {
  const colorMap: Record<string, string> = {
    'create': 'text-green-600',
    'update': 'text-blue-600',
    'delete': 'text-red-600',
    'bulk_delete': 'text-red-600',
    'bulk_archive': 'text-yellow-600',
    'bulk_export': 'text-purple-600',
    'login': 'text-green-600',
    'logout': 'text-gray-600',
    'password_change': 'text-orange-600',
    'role_change': 'text-purple-600'
  };

  return colorMap[action] || 'text-gray-600';
}