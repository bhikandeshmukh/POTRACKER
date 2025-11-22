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
        'comment_added' | 'user_login' | 'user_logout' | 'user_created';
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
/**
* Logs an audit event with required and optional metadata and persists it to Firestore.
* @example
* sync('userId', 'Jane Doe', 'admin', 'update', 'document', 'docId', 'Doc Name')
* undefined
* @param {{string}} userId - Argument description in one line.
* @param {{string}} userName - Argument description in one line.
* @param {{string}} userRole - Argument description in one line.
* @param {{AuditLog['action']}} action - Argument description in one line.
* @param {{AuditLog['entityType']}} entityType - Argument description in one line.
* @param {{string}} entityId - Argument description in one line.
* @param {{string}} entityName - Argument description in one line.
* @param {{string=}} description - Argument description in one line.
* @param {{Record<string, { old: any; new: any }>=}} changes - Argument description in one line.
* @param {{Record<string, any>=}} metadata - Argument description in one line.
* @returns {{Promise<void>}} Return description in one line.
**/
export const logAuditEvent = async (
  userId: string,
  userName: string,
  userRole: string,
  action: AuditLog['action'],
  entityType: AuditLog['entityType'],
  entityId: string,
  entityName: string,
  description?: string,
  changes?: Record<string, { old: any; new: any }>,
  metadata?: Record<string, any>
) => {
  try {
    // Validate required parameters
    if (!userId || !userName || !userRole || !action || !entityType || !entityId || !entityName) {
      logger.error('Invalid parameters for logAuditEvent', { 
        userId, userName, userRole, action, entityType, entityId, entityName 
      });
      return;
    }

    const auditLog: Omit<AuditLog, 'id'> = {
      action,
      entityType,
      entityId,
      entityName,
      userId,
      userName,
      userRole,
      description: description || `${action} ${entityType} ${entityName}`,
      timestamp: serverTimestamp() as Timestamp
    };

    // Only add optional fields if they have values (Firestore doesn't allow undefined)
    if (changes) {
      auditLog.changes = changes;
    }
    if (metadata) {
      auditLog.metadata = metadata;
    }
    
    // Add browser info only if available (server-side rendering safe)
    if (typeof window !== 'undefined') {
      if (window.location.hostname) {
        auditLog.ipAddress = window.location.hostname;
      }
      if (navigator.userAgent) {
        auditLog.userAgent = navigator.userAgent;
      }
    }

    await addDoc(collection(db, 'auditLogs'), auditLog);
    logger.debug('Audit log created', { action, entityType, entityId });
  } catch (error) {
    logger.error('Failed to create audit log', error);
    // Don't throw error to avoid breaking main operations
  }
};

// Get audit logs with filtering
/****
* Fetches recent audit logs filtered by optional identifiers and returns them sorted by timestamp.
* @example
* sync('entityId123', undefined, undefined, 25)
* [{ id: 'log1', entityId: 'entityId123', timestamp: Timestamp.now(), ... }]
* @param {{string}} {{entityId}} - Optional identifier to filter logs by a specific entity.
* @param {{string}} {{entityType}} - Optional identifier to filter logs by entity type.
* @param {{string}} {{userId}} - Optional identifier to filter logs by the acting user.
* @param {{number}} {{limitCount}} - Number of log entries to return, defaults to 50.
* @returns {{Promise<AuditLog[]>}} Promise resolving to an array of audit log entries.
****/
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
/****
* Maps audit log entries to activity items by translating log actions into activity types and extracting relevant metadata.
* @example
* auditLogsToActivityItems(auditLogs)
* [{ id: '1', type: 'po_created', ... }]
* @param {{AuditLog[]}} {{auditLogs}} - List of audit logs to transform.
* @returns {{ActivityItem[]}} List of activity items derived from the audit logs.
****/
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
/**
 * Creates a new comment document for a purchase order and logs the creation event.
 * @example
 * sync("po123", "user456", "Jane Doe", "admin", "Looks good to me", undefined, ["user789"])
 * "newCommentId123"
 * @param {{string}} {{poId}} - Identifier of the purchase order the comment belongs to.
 * @param {{string}} {{userId}} - Identifier of the user creating the comment.
 * @param {{string}} {{userName}} - Name of the user creating the comment.
 * @param {{string}} {{userRole}} - Role of the user creating the comment.
 * @param {{string}} {{content}} - Text content of the comment.
 * @param {{string}} {{parentId}} - Optional identifier of the parent comment (for replies).
 * @param {{string[]}} {{mentions}} - Optional list of mentioned user identifiers.
 * @returns {{Promise<string>}} Returns the new comment document ID.
 **/
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
      userRole,
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

/**
* Synchronizes and retrieves comments for a purchase order sorted by timestamp.
* @example
* sync("po123")
* [ { id: "c1", text: "Approved", timestamp: 2025-11-22T12:34:56.000Z }, ... ]
* @param {{string}} {{poId}} - Purchase order identifier to filter comments.
* @returns {{Promise<Comment[]>}} Promise resolving to a list of matching comments.
**/
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

/**
* Update a comment with new content and log an audit event for the update
* @example
* sync('commentId123', 'Updated content', 'userId456', 'Jane Doe', 'admin')
* undefined
* @param {{string}} {{commentId}} - Identifier of the comment to update.
* @param {{string}} {{content}} - New content to replace the existing comment.
* @param {{string}} {{userId}} - Identifier of the user performing the update.
* @param {{string}} {{userName}} - Name of the user performing the update.
* @param {{string}} {{userRole}} - Role of the user performing the update.
* @returns {{Promise<void>}} Promise resolving when the update and audit log are complete.
**/
export const updateComment = async (
  commentId: string,
  content: string,
  userId: string,
  userName: string,
  userRole: string
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
      userRole,
      'update',
      'comment',
      commentId,
      'Comment',
      `Updated comment: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
      undefined,
      undefined
    );
  } catch (error) {
    logger.error('Failed to update comment', error);
    throw error;
  }
};

/**
 * Deletes a comment and logs the deletion audit event.
 * @example
 * sync('comment123', 'user456', 'Jane Doe', 'admin')
 * undefined
 * @param {{string}} commentId - Identifier of the comment to delete.
 * @param {{string}} userId - Identifier of the user performing the deletion.
 * @param {{string}} userName - Name of the user performing the deletion.
 * @param {{string}} userRole - Role of the user performing the deletion.
 * @returns {{Promise<void>}} Promise that resolves once the comment is deleted and the audit log is recorded.
 **/
export const deleteComment = async (
  commentId: string,
  userId: string,
  userName: string,
  userRole: string
): Promise<void> => {
  try {
    const commentRef = doc(db, 'comments', commentId);
    await deleteDoc(commentRef);

    // Log audit event
    await logAuditEvent(
      userId,
      userName,
      userRole,
      'delete',
      'comment',
      commentId,
      'Comment',
      'Deleted comment',
      undefined,
      undefined
    );
  } catch (error) {
    logger.error('Failed to delete comment', error);
    throw error;
  }
};

/**
* Syncs like/unlike status for a comment.
* @example
* sync('commentId123', 'userId456', true)
* Promise<void>
* @param {{string}} commentId - Identifier of the comment to update.
* @param {{string}} userId - Identifier of the user toggling the like.
* @param {{boolean}} isLiking - Whether the user is liking (true) or unliking (false) the comment.
* @returns {{Promise<void>}} Promise that resolves when the operation completes.
**/
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
/**
* Fetches recent activity items based on user context and provided filters.
* @example
* sync('user123', 'Employee', 5, 'po')
* [{ id: 'activity1', type: 'po' }]
* @param {{string}} {{userId}} - Optional ID of the user whose activities should be returned.
* @param {{string}} {{userRole}} - Optional role of the user to determine the scope of visible activities.
* @param {{number}} {{limitCount}} - Maximum number of activity items to return, defaults to 10.
* @param {{'all' | 'po' | 'shipment' | 'comment'}} {{filter}} - Optional filter to restrict activities to a specific entity type.
* @returns {{Promise<ActivityItem[]>}} Promise resolving to the matching activity items.
**/
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
    } else if (filter && filter !== 'all') {
      const entityTypeMap = {
        'po': 'po',
        'shipment': 'shipment',
        'comment': 'comment'
      };
      auditLogs = await getAuditLogs(undefined, entityTypeMap[filter], undefined, limitCount);
    } else {
      // Admin/Manager sees all activities
      auditLogs = await getAuditLogs(undefined, undefined, undefined, limitCount);
    }
    
    return convertAuditLogsToActivities(auditLogs);
  } catch (error) {
    logger.error('Failed to fetch recent activities', error);
    return [];
  }
};

// Log user login
/**
* Logs a successful user login into the audit trail after ensuring required information is present.
* @example
* sync('user-123', 'Jane Doe', 'admin')
* Promise<void>
* @param {{string}} {{userId}} - Unique identifier for the user logging in.
* @param {{string}} {{userName}} - Name of the user logging in.
* @param {{string}} {{userRole}} - Role assigned to the user performing the login.
* @returns {{Promise<void>}} Resolves once the audit log entry for the login has been recorded.
**/
export const logUserLogin = async (userId: string, userName: string, userRole: string) => {
  // Validate required parameters
  if (!userId || !userName || !userRole) {
    logger.error('Invalid parameters for logUserLogin', { userId, userName, userRole });
    return;
  }

  await logAuditEvent(
    userId,
    userName,
    userRole,
    'login',
    'system',
    userId,
    userName,
    `User ${userName} logged in`,
    undefined,
    { userRole, loginTime: new Date().toISOString() }
  );
};

// Log user logout
/**
* Logs a user logout audit event after validating required parameters.
* @example
* sync('12345', 'jdoe', 'admin')
* undefined
* @param {{string}} {{userId}} - Unique identifier for the user.
* @param {{string}} {{userName}} - Display name of the user.
* @param {{string}} {{userRole}} - Role of the user performing the logout.
* @returns {{Promise<void>}} Return description in one line.
**/
export const logUserLogout = async (userId: string, userName: string, userRole: string) => {
  // Validate required parameters
  if (!userId || !userName || !userRole) {
    logger.error('Invalid parameters for logUserLogout', { userId, userName, userRole });
    return;
  }

  await logAuditEvent(
    userId,
    userName,
    userRole,
    'logout',
    'system',
    userId,
    userName,
    `User ${userName} logged out`,
    undefined,
    { userRole, logoutTime: new Date().toISOString() }
  );
};

// Log PO status changes with proper audit trail
/**
 * Logs audit event whenever the PO status changes.
 * @example
 * sync('id', 'PO-123', 'Pending', 'Approved', 'user-1', 'Alice', 'approver', 'Reviewed and ok')
 * undefined
 * @param {{string}} {{poId}} - Purchase order identifier.
 * @param {{string}} {{poNumber}} - Purchase order number.
 * @param {{string}} {{oldStatus}} - Previous PO status.
 * @param {{string}} {{newStatus}} - Updated PO status.
 * @param {{string}} {{userId}} - Identifier of the acting user.
 * @param {{string}} {{userName}} - Display name of the acting user.
 * @param {{string}} {{userRole}} - Role of the acting user.
 * @param {{string}} {{reason}} - Optional reason for the status change.
 * @returns {{Promise<void>}} Promise resolving once the audit log is written.
 **/
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
    userRole,
    action,
    'po',
    poId,
    poNumber,
    `PO status changed from ${oldStatus} to ${newStatus}${reason ? ` - ${reason}` : ''}`,
    { status: { old: oldStatus, new: newStatus } },
    { reason, userRole }
  );
};