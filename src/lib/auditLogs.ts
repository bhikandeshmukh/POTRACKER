import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './logger';

export interface AuditLog {
  id?: string;
  action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'login' | 'logout' | 'comment' | 'ship' | 'receive';
  entityType: 'user' | 'vendor' | 'po' | 'ro' | 'shipment' | 'transporter' | 'comment' | 'system';
  entityId: string;
  entityName: string;
  userId: string;
  userName: string;
  userRole: string;
  description: string;
  changes?: Record<string, { old: any; new: any }>;
  metadata?: Record<string, any>;
  timestamp: Timestamp;
  ipAddress?: string;
  userAgent?: string;
}

export interface ActivityItem {
  id: string;
  type: 'po_created' | 'po_updated' | 'po_approved' | 'po_rejected' | 'po_shipped' | 'po_received' | 
        'vendor_added' | 'vendor_updated' | 'vendor_deleted' |
        'ro_created' | 'ro_approved' | 'ro_rejected' |
        'shipment_created' | 'shipment_shipped' | 'shipment_delivered' |
        'comment_added' | 'user_login' | 'user_created';
  user: {
    id: string;
    name: string;
    role: string;
  };
  entity?: {
    type: 'po' | 'vendor' | 'ro' | 'shipment' | 'user';
    id: string;
    name: string;
  };
  description: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface Comment {
  id?: string;
  poId: string;
  userId: string;
  userName: string;
  userRole: string;
  content: string;
  timestamp: Timestamp | Date;
  parentId?: string; // For replies
  likes: string[]; // Array of user IDs who liked
  isEdited?: boolean;
  mentions?: string[]; // Array of mentioned user IDs
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Create audit log entry
export const logAuditEvent = async (
  userId: string,
  userName: string,
  action: AuditLog['action'],
  entityType: AuditLog['entityType'],
  entityId: string,
  entityName: string,
  description?: string,
  changes?: Record<string, { old: any; new: any }>,
  metadata?: Record<string, any>
) => {
  try {
    const auditLog: Omit<AuditLog, 'id'> = {
      action,
      entityType,
      entityId,
      entityName,
      userId,
      userName,
      userRole: 'Unknown', // Will be updated by the calling function
      description: description || `${action} ${entityType} ${entityName}`,
      changes,
      metadata,
      timestamp: serverTimestamp() as Timestamp,
      ipAddress: typeof window !== 'undefined' ? window.location.hostname : undefined,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined
    };

    await addDoc(collection(db, 'auditLogs'), auditLog);
    logger.debug('Audit log created', { action, entityType, entityId });
  } catch (error) {
    logger.error('Failed to create audit log', error);
    // Don't throw error to avoid breaking main operations
  }
};

// Get audit logs with filtering
export const getAuditLogs = async (
  entityId?: string,
  entityType?: string,
  userId?: string,
  limitCount: number = 50
): Promise<AuditLog[]> => {
  try {
    const logsRef = collection(db, 'auditLogs');
    let q = query(logsRef, orderBy('timestamp', 'desc'), limit(limitCount));
    
    if (entityId) {
      q = query(logsRef, where('entityId', '==', entityId), orderBy('timestamp', 'desc'), limit(limitCount));
    } else if (entityType) {
      q = query(logsRef, where('entityType', '==', entityType), orderBy('timestamp', 'desc'), limit(limitCount));
    } else if (userId) {
      q = query(logsRef, where('userId', '==', userId), orderBy('timestamp', 'desc'), limit(limitCount));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      timestamp: doc.data().timestamp || Timestamp.now()
    } as AuditLog));
  } catch (error) {
    logger.error('Failed to fetch audit logs', error);
    return [];
  }
};

// Convert audit logs to activity items for UI
export const convertAuditLogsToActivities = (auditLogs: AuditLog[]): ActivityItem[] => {
  return auditLogs.map(log => {
    let activityType: ActivityItem['type'];
    
    // Map audit log actions to activity types
    switch (`${log.action}_${log.entityType}`) {
      case 'create_po':
        activityType = 'po_created';
        break;
      case 'update_po':
        activityType = 'po_updated';
        break;
      case 'approve_po':
        activityType = 'po_approved';
        break;
      case 'reject_po':
        activityType = 'po_rejected';
        break;
      case 'ship_po':
        activityType = 'po_shipped';
        break;
      case 'receive_po':
        activityType = 'po_received';
        break;
      case 'create_vendor':
        activityType = 'vendor_added';
        break;
      case 'update_vendor':
        activityType = 'vendor_updated';
        break;
      case 'delete_vendor':
        activityType = 'vendor_deleted';
        break;
      case 'create_ro':
        activityType = 'ro_created';
        break;
      case 'approve_ro':
        activityType = 'ro_approved';
        break;
      case 'reject_ro':
        activityType = 'ro_rejected';
        break;
      case 'create_shipment':
        activityType = 'shipment_created';
        break;
      case 'ship_shipment':
        activityType = 'shipment_shipped';
        break;
      case 'receive_shipment':
        activityType = 'shipment_delivered';
        break;
      case 'create_comment':
      case 'comment_comment':
        activityType = 'comment_added';
        break;
      case 'login_system':
        activityType = 'user_login';
        break;
      case 'create_user':
        activityType = 'user_created';
        break;
      default:
        activityType = 'po_updated'; // fallback
    }

    return {
      id: log.id || '',
      type: activityType,
      user: {
        id: log.userId,
        name: log.userName,
        role: log.userRole
      },
      entity: log.entityType !== 'system' ? {
        type: log.entityType as 'po' | 'vendor' | 'ro' | 'shipment' | 'user',
        id: log.entityId,
        name: log.entityName
      } : undefined,
      description: log.description,
      timestamp: log.timestamp.toDate(),
      metadata: log.metadata
    };
  });
};

// Comments system
export const addComment = async (
  poId: string,
  userId: string,
  userName: string,
  userRole: string,
  content: string,
  parentId?: string,
  mentions?: string[]
): Promise<string> => {
  try {
    const comment: Omit<Comment, 'id'> = {
      poId,
      userId,
      userName,
      userRole,
      content,
      parentId,
      likes: [],
      mentions: mentions || [],
      timestamp: serverTimestamp() as Timestamp,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp
    };

    const docRef = await addDoc(collection(db, 'comments'), comment);
    
    // Log audit event
    await logAuditEvent(
      userId,
      userName,
      'create',
      'comment',
      docRef.id,
      `Comment on PO ${poId}`,
      `Added comment: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
      undefined,
      { poId, parentId, mentions }
    );

    return docRef.id;
  } catch (error) {
    logger.error('Failed to add comment', error);
    throw error;
  }
};

export const getComments = async (poId: string): Promise<Comment[]> => {
  try {
    const commentsRef = collection(db, 'comments');
    const q = query(
      commentsRef, 
      where('poId', '==', poId), 
      orderBy('timestamp', 'asc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      timestamp: doc.data().timestamp || Timestamp.now()
    } as Comment));
  } catch (error) {
    logger.error('Failed to fetch comments', error);
    return [];
  }
};

export const updateComment = async (
  commentId: string,
  content: string,
  userId: string,
  userName: string
): Promise<void> => {
  try {
    const commentRef = doc(db, 'comments', commentId);
    await updateDoc(commentRef, {
      content,
      isEdited: true,
      updatedAt: serverTimestamp()
    });

    // Log audit event
    await logAuditEvent(
      userId,
      userName,
      'update',
      'comment',
      commentId,
      'Comment',
      `Updated comment: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`
    );
  } catch (error) {
    logger.error('Failed to update comment', error);
    throw error;
  }
};

export const deleteComment = async (
  commentId: string,
  userId: string,
  userName: string
): Promise<void> => {
  try {
    const commentRef = doc(db, 'comments', commentId);
    await deleteDoc(commentRef);

    // Log audit event
    await logAuditEvent(
      userId,
      userName,
      'delete',
      'comment',
      commentId,
      'Comment',
      'Deleted comment'
    );
  } catch (error) {
    logger.error('Failed to delete comment', error);
    throw error;
  }
};

export const likeComment = async (
  commentId: string,
  userId: string,
  isLiking: boolean
): Promise<void> => {
  try {
    const commentRef = doc(db, 'comments', commentId);
    const commentDoc = await getDoc(commentRef);
    
    if (commentDoc.exists()) {
      const comment = commentDoc.data() as Comment;
      let likes = comment.likes || [];
      
      if (isLiking && !likes.includes(userId)) {
        likes.push(userId);
      } else if (!isLiking && likes.includes(userId)) {
        likes = likes.filter(id => id !== userId);
      }
      
      await updateDoc(commentRef, { likes });
    }
  } catch (error) {
    logger.error('Failed to like/unlike comment', error);
    throw error;
  }
};

// Get recent activities for dashboard
export const getRecentActivities = async (
  userId?: string,
  userRole?: string,
  limitCount: number = 10,
  filter?: 'all' | 'po' | 'shipment' | 'comment'
): Promise<ActivityItem[]> => {
  try {
    let auditLogs: AuditLog[] = [];
    
    if (userRole === 'Employee' && userId) {
      // Employee sees only their activities
      auditLogs = await getAuditLogs(undefined, undefined, userId, limitCount);
    } else {
      // Admin/Manager sees all activities
      if (filter && filter !== 'all') {
        const entityTypeMap = {
          'po': 'po',
          'shipment': 'shipment',
          'comment': 'comment'
        };
        auditLogs = await getAuditLogs(undefined, entityTypeMap[filter], undefined, limitCount);
      } else {
        auditLogs = await getAuditLogs(undefined, undefined, undefined, limitCount);
      }
    }
    
    return convertAuditLogsToActivities(auditLogs);
  } catch (error) {
    logger.error('Failed to fetch recent activities', error);
    return [];
  }
};

// Log user login
export const logUserLogin = async (userId: string, userName: string, userRole: string) => {
  await logAuditEvent(
    userId,
    userName,
    'login',
    'system',
    userId,
    userName,
    `User ${userName} logged in`,
    undefined,
    { userRole, loginTime: new Date().toISOString() }
  );
};

// Log PO status changes with proper audit trail
export const logPOStatusChange = async (
  poId: string,
  poNumber: string,
  oldStatus: string,
  newStatus: string,
  userId: string,
  userName: string,
  userRole: string,
  reason?: string
) => {
  const action = newStatus === 'Approved' ? 'approve' : 
                newStatus === 'Rejected' ? 'reject' : 'update';
  
  await logAuditEvent(
    userId,
    userName,
    action,
    'po',
    poId,
    poNumber,
    `PO status changed from ${oldStatus} to ${newStatus}${reason ? ` - ${reason}` : ''}`,
    { status: { old: oldStatus, new: newStatus } },
    { reason, userRole }
  );
};