import { Comment } from '../types';
import { BaseService } from './base.service';
import { auditService } from './audit.service';
import { serverTimestamp, Timestamp } from 'firebase/firestore';

export class CommentService extends BaseService<Comment> {
  constructor() {
    super('comments');
  }

  private extractMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }
    return mentions;
  }

  async addComment(
    poId: string,
    user: { uid: string; name: string; role: string },
    content: string,
    parentId?: string
  ) {
    try {
      const mentions = this.extractMentions(content);
      
      const commentData: Omit<Comment, 'id' | 'createdAt' | 'updatedAt'> = {
        poId,
        userId: user.uid,
        userName: user.name,
        userRole: user.role,
        content,
        parentId,
        likes: [],
        mentions,
        timestamp: serverTimestamp() as Timestamp,
        isEdited: false
      };

      const result = await this.create(commentData);

      if (result.success && result.data) {
        // Log audit event
        await auditService.logEvent(
          user.uid,
          user.name,
          user.role,
          'create',
          'comment',
          result.data.id!,
          `Comment on PO ${poId}`,
          `Added comment: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
          undefined,
          { poId, parentId, mentions }
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'add comment').message
      };
    }
  }

  async getCommentsForPO(poId: string) {
    return this.findMany({
      where: [{ field: 'poId', operator: '==', value: poId }],
      orderBy: 'timestamp',
      orderDirection: 'asc'
    });
  }

  async updateComment(
    commentId: string,
    content: string,
    user: { uid: string; name: string; role: string }
  ) {
    try {
      const result = await this.update(commentId, {
        content,
        isEdited: true
      });

      if (result.success) {
        // Log audit event
        await auditService.logEvent(
          user.uid,
          user.name,
          user.role,
          'update',
          'comment',
          commentId,
          'Comment',
          `Updated comment: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'update comment').message
      };
    }
  }

  async deleteComment(
    commentId: string,
    user: { uid: string; name: string; role: string }
  ) {
    try {
      const result = await this.delete(commentId);

      if (result.success) {
        // Log audit event
        await auditService.logEvent(
          user.uid,
          user.name,
          user.role,
          'delete',
          'comment',
          commentId,
          'Comment',
          'Deleted comment'
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'delete comment').message
      };
    }
  }

  async likeComment(commentId: string, userId: string, isLiking: boolean) {
    try {
      const currentResult = await this.findById(commentId);
      if (!currentResult.success || !currentResult.data) {
        return {
          success: false,
          error: 'Comment not found'
        };
      }

      const comment = currentResult.data;
      let likes = comment.likes || [];
      
      if (isLiking && !likes.includes(userId)) {
        likes.push(userId);
      } else if (!isLiking && likes.includes(userId)) {
        likes = likes.filter(id => id !== userId);
      }

      return this.update(commentId, { likes });
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'like comment').message
      };
    }
  }
}

export const commentService = new CommentService();