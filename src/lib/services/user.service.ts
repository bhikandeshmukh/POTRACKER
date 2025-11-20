import { User, CreateUserForm } from '../types';
import { BaseService } from './base.service';
import { auditService } from './audit.service';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

export class UserService extends BaseService<User> {
  constructor() {
    super('users');
  }

  private emailToDocId(email: string): string {
    return email.replace(/[@.]/g, '-'); 
 }

  async createUser(
    userData: CreateUserForm,
    createdBy: { uid: string; name: string; role: string }
  ) {
    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        userData.email,
        userData.password
      );

      const docId = this.emailToDocId(userData.email);
      
      // Create user document
      const userDoc = {
        email: userData.email,
        name: userData.name,
        role: userData.role,
        uid: userCredential.user.uid
      };

      const result = await this.create(userDoc, docId);

      if (result.success) {
        // Log audit event
        await auditService.logEvent(
          createdBy.uid,
          createdBy.name,
          createdBy.role,
          'create',
          'user',
          docId,
          userData.name,
          `Created user ${userData.name} with role ${userData.role}`,
          undefined,
          {
            email: userData.email,
            role: userData.role,
            userRole: createdBy.role
          }
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'create user').message
      };
    }
  }

  async updateUser(
    id: string,
    updateData: Partial<User>,
    updatedBy: { uid: string; name: string; role: string }
  ) {
    try {
      // Get current user to track changes
      const currentResult = await this.findById(id);
      if (!currentResult.success || !currentResult.data) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      const currentUser = currentResult.data;
      const result = await this.update(id, updateData);

      if (result.success) {
        // Track changes for audit
        const changes: Record<string, { old: any; new: any }> = {};
        Object.keys(updateData).forEach(key => {
          const oldValue = (currentUser as any)[key];
          const newValue = (updateData as any)[key];
          if (oldValue !== newValue) {
            changes[key] = { old: oldValue, new: newValue };
          }
        });

        // Log audit event
        await auditService.logEvent(
          updatedBy.uid,
          updatedBy.name,
          updatedBy.role,
          'update',
          'user',
          id,
          updateData.name || currentUser.name,
          `Updated user ${updateData.name || currentUser.name}`,
          changes
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'update user').message
      };
    }
  }

  async deleteUser(
    id: string,
    deletedBy: { uid: string; name: string; role: string }
  ) {
    try {
      // Get user name before deletion
      const currentResult = await this.findById(id);
      const userName = currentResult.data?.name || 'Unknown User';

      const result = await this.delete(id);

      if (result.success) {
        // Log audit event
        await auditService.logEvent(
          deletedBy.uid,
          deletedBy.name,
          deletedBy.role,
          'delete',
          'user',
          id,
          userName,
          `Deleted user ${userName}`
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'delete user').message
      };
    }
  }

  async getUserByEmail(email: string) {
    const docId = this.emailToDocId(email);
    return this.findById(docId);
  }

  async getUsersByRole(role: User['role']) {
    return this.findMany({
      where: [{ field: 'role', operator: '==', value: role }],
      orderBy: 'name',
      orderDirection: 'asc'
    });
  }

  async searchUsers(searchTerm: string) {
    const result = await this.findMany();
    
    if (result.success && result.data) {
      const filteredUsers = result.data.data.filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );

      return {
        success: true,
        data: {
          ...result.data,
          data: filteredUsers,
          total: filteredUsers.length
        }
      };
    }

    return result;
  }
}

export const userService = new UserService();