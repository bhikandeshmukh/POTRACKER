import { AuditLog, ActivityItem } from '../types';
import { BaseService } from './base.service';
import { logger } from '../logger';
import { serverTimestamp, Timestamp } from 'firebase/firestore';

export class AuditService extends BaseService<AuditLog> {
  constructor() {
    super('auditLogs');
  }

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
      const auditLog: Omit<AuditLog, 'id' | 'createdAt' | 'updatedAt'> = {
        action,
        entityType,
        entityId,
        entityName,
        userId,
        userName,
        userRole,
        description: description || `${action} ${entityType} ${entityName}`,
        changes,
        metadata,
        timestamp: serverTimestamp() as Timestamp,
        ipAddress: typeof window !== 'undefined' ? window.location.hostname : undefined,
        userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined
      };

      await this.create(auditLog);
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