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

  /**
  * Creates a new user in Firebase Auth, persists the user document, and logs an audit event.
  * @example
  * createUser({ email: 'user@example.com', password: 'securePass', name: 'User Name', role: 'member' }, { uid: 'adminUid', name: 'Admin', role: 'admin' })
  * { success: true }
  * @param {{CreateUserForm}} userData - Payload containing the new user details.
  * @param {{{ uid: string; name: string; role: string }}} createdBy - Metadata about the actor creating the user.
  * @returns {{Promise<{success: boolean; error?: string}>}} Promise resolving to the operation result.
  **/
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

  /*******************************************
  * Updates a user record by id, auditing changes and logging the update event.
  * @example
  * updateUser("user-123", { name: "Jane Doe" }, { uid: "admin-1", name: "Admin", role: "administrator" })
  * { success: true, data: { ... }, error: undefined }
  * @param {{string}} {{id}} - Unique identifier of the user to update.
  * @param {{Partial<User>}} {{updateData}} - Partial user data containing fields to update.
  * @param {{{uid: string; name: string; role: string}}} {{updatedBy}} - Operator metadata for auditing the change.
  * @returns {{Promise<{success: boolean; data?: User; error?: string}>}} Result of the update operation indicating success or error details.
  *******************************************/
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

  /**
  * Deletes a user by ID, logs the action, and returns the deletion result.
  * @example
  * deleteUser('123', { uid: 'u1', name: 'Admin', role: 'admin' })
  * { success: true }
  * @param {{string}} id - ID of the user to delete.
  * @param {{{ uid: string; name: string; role: string }}} deletedBy - Metadata about who initiated the deletion.
  * @returns {{Promise<{success: boolean; error?: string}>}} Promise resolving with the deletion result.
  **/
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

  /**/ **
  * Searches users by name or email, returning the filtered subset of users.
  * @example
  * searchUsers("alice")
  * { success: true, data: { data: [{ id: 1, name: "Alice", ... }], total: 1 } }
  * @param {{string}} {{searchTerm}} - Term used to match against user name or email.
  * @returns {{Promise<{success: boolean, data: { data: Array<any>, total: number, [key: string]: any }}|{success: boolean, error?: any}>>}} Promise resolving with filtered users or the original result.
  **/*/
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