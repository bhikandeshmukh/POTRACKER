import { AuditLog, ActivityItem } from '../types';
import { BaseService } from './base.service';
import { logger } from '../logger';
import { serverTimestamp, Timestamp } from 'firebase/firestore';

export class AuditService extends BaseService<AuditLog> {
  constructor() {
    super('auditLogs');
  }

  /**/ **
  * Logs an audit event with user, entity, and optional metadata details.
  * @example
  * logEvent("user123", "Jane Doe", "admin", "CREATE", "Document", "doc456", "Project Plan", "Created new document", { title: { old: null, new: "Project Plan" } }, { ip: "127.0.0.1" })
  * Promise<void>
  * @param {{string}} userId - Identifier of the user performing the action.
  * @param {{string}} userName - Display name of the user performing the action.
  * @param {{string}} userRole - Role of the user performing the action.
  * @param {{AuditLog['action']}} action - Action being audited.
  * @param {{AuditLog['entityType']}} entityType - Type of entity the action applies to.
  * @param {{string}} entityId - Identifier of the target entity.
  * @param {{string}} entityName - Name of the target entity.
  * @param {{string}} description - Optional description for the audit entry.
  * @param {{Record<string, { old: any; new: any }}}} changes - Optional map of field changes.
  * @param {{Record<string, any>}} metadata - Optional metadata to attach to the audit entry.
  * @returns {{Promise<void>}} Promise resolving when the audit log is stored.
  **/*/
  async logEvent(
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
  ): Promise<void> {
    try {
      console.log('Audit Service - Logging event:', { 
        userId, userName, userRole, action, entityType, entityId, entityName, description 
      });
      const auditLog: Omit<AuditLog, 'id' | 'createdAt' | 'updatedAt'> = {
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

      const result = await this.create(auditLog);
      console.log('Audit Service - Log created successfully:', result);
      logger.debug('Audit log created', { action, entityType, entityId });
    } catch (error) {
      logger.error('Failed to create audit log', error);
      // Don't throw error to avoid breaking main operations
    }
  }

  async getEntityHistory(entityId: string, limitCount: number = 50) {
    return this.findMany({
      where: [{ field: 'entityId', operator: '==', value: entityId }],
      orderBy: 'timestamp',
      orderDirection: 'desc',
      limit: limitCount
    });
  }

  async getUserActivity(userId: string, limitCount: number = 50) {
    return this.findMany({
      where: [{ field: 'userId', operator: '==', value: userId }],
      orderBy: 'timestamp',
      orderDirection: 'desc',
      limit: limitCount
    });
  }

  async getEntityTypeActivity(entityType: string, limitCount: number = 50) {
    return this.findMany({
      where: [{ field: 'entityType', operator: '==', value: entityType }],
      orderBy: 'timestamp',
      orderDirection: 'desc',
      limit: limitCount
    });
  }

  /**
   * Convert audit logs into standardized activity items for display.
   * @example
   * convertToActivityItems([{ id: '1', action: 'create_po', entityType: 'po', userId: 'u1', userName: 'Alice', userRole: 'admin', entityId: 'po1', entityName: 'PO 1', description: 'Created PO', timestamp: Timestamp.now(), metadata: {} }])
   * [{ id: '1', type: 'po_created', user: { id: 'u1', name: 'Alice', role: 'admin' }, entity: { type: 'po', id: 'po1', name: 'PO 1' }, description: 'Created PO', timestamp: <Date>, metadata: {} }]
   * @param {{AuditLog[]}} auditLogs - List of audit log entries to transform.
   * @returns {{ActivityItem[]}} Converted list of activity items.
   **/
  convertToActivityItems(auditLogs: AuditLog[]): ActivityItem[] {
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
  }

  /**
  * Logs a user login event to the audit service.
  * @example
  * logUserLogin('123', 'Alice', 'admin')
  * undefined
  * @param {{string}} {{userId}} - Unique identifier of the user logging in.
  * @param {{string}} {{userName}} - Display name of the user logging in.
  * @param {{string}} {{userRole}} - Role assigned to the user logging in.
  * @returns {{Promise<void>}} Resolves when the login event has been recorded.
  **/
  async logUserLogin(userId: string, userName: string, userRole: string) {
    await this.logEvent(
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
  }

  /**
  * Logs PO status change events for audit tracking.
  * @example
  * logPOStatusChange('po1','PO-123','Pending','Approved','user1','Alice','approver','Needed review')
  * undefined
  * @param {{string}} poId - ID of the purchase order.
  * @param {{string}} poNumber - Number identifier of the purchase order.
  * @param {{string}} oldStatus - Previous status of the purchase order.
  * @param {{string}} newStatus - New status of the purchase order.
  * @param {{string}} userId - ID of the user performing the update.
  * @param {{string}} userName - Name of the user performing the update.
  * @param {{string}} userRole - Role of the user performing the update.
  * @param {{string}} [reason] - Optional reason for the status change.
  * @returns {{Promise<void>}} Promise resolving once the audit log entry is created.
  **/
  async logPOStatusChange(
    poId: string,
    poNumber: string,
    oldStatus: string,
    newStatus: string,
    userId: string,
    userName: string,
    userRole: string,
    reason?: string
  ) {
    const action = newStatus === 'Approved' ? 'approve' : 
                  newStatus === 'Rejected' ? 'reject' : 'update';
    
    await this.logEvent(
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
  }
}

export const auditService = new AuditService();