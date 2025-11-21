import { Comment } from '../types';
import { BaseService } from './base.service';
import { auditService } from './audit.service';
import { serverTimestamp, Timestamp, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

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
        likes: [],
        timestamp: serverTimestamp() as Timestamp,
        isEdited: false
      };

      // Only add optional fields if they have values (Firestore doesn't allow undefined)
      if (parentId) {
        commentData.parentId = parentId;
      }
      if (mentions && mentions.length > 0) {
        commentData.mentions = mentions;
      }

      const result = await this.create(commentData);

      if (result.success && result.data) {
        // Log audit event
        const auditMetadata: Record<string, any> = { poId };
        if (parentId) auditMetadata.parentId = parentId;
        if (mentions && mentions.length > 0) auditMetadata.mentions = mentions;
        
        await auditService.logEvent(
          user.uid,
          user.name,
          user.role,
          'create',
          'comment',
          result.data.id!,
          `Comment on PO ${poId}`,
          `Added comment: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
          undefined, // changes
          auditMetadata
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
    try {
      // First try with orderBy (requires composite index)
      console.log('Trying comments query with orderBy for poId:', poId);
      
      const commentsRef = collection(db, 'comments');
      const q = query(
        commentsRef,
        where('poId', '==', poId),
        orderBy('timestamp', 'asc')
      );
      
      const snapshot = await getDocs(q);
      const comments = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Comment));
      
      console.log('Query with orderBy successful, found', comments.length, 'comments');
      
      return {
        success: true,
        data: {
          data: comments,
          total: comments.length,
          page: 1,
          limit: comments.length,
          hasMore: false
        }
      };
      
    } catch (error: any) {
      console.log('Query with orderBy failed, trying fallback. Error:', error.message);
      
      // If the ordered query failed, try without orderBy and sort client-side
      try {
        const commentsRef = collection(db, 'comments');
        const q = query(commentsRef, where('poId', '==', poId));
        
        const snapshot = await getDocs(q);
        const comments = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        } as Comment));
        
        // Sort comments by timestamp on client side
        const sortedComments = comments.sort((a, b) => {
          const aTime = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp as any);
          const bTime = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp as any);
          return aTime.getTime() - bTime.getTime();
        });
        
        console.log('Fallback successful, sorted', sortedComments.length, 'comments client-side');
        
        return {
          success: true,
          data: {
            data: sortedComments,
            total: sortedComments.length,
            page: 1,
            limit: sortedComments.length,
            hasMore: false
          }
        };
        
      } catch (fallbackError: any) {
        console.log('Both attempts failed:', fallbackError.message);
        
        return {
          success: false,
          error: this.handleError(error, 'get comments for PO').message
        };
      }
    }
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