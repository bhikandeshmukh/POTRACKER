import { User as FirebaseUser } from 'firebase/auth';
import { User } from '../types';

/**
 * Get consistent user name for comments and audit logs
 * Priority: userData.name > user.displayName > user.email > 'Unknown'
 */
export function getUserDisplayName(
  user: FirebaseUser | null, 
  userData: User | null
): string {
  if (userData?.name) {
    return userData.name;
  }
  
  if (user?.displayName) {
    return user.displayName;
  }
  
  if (user?.email) {
    return user.email;
  }
  
  return 'Unknown';
}

/**
 * Get user info object for comments and audit logs
 */
export function getUserInfo(
  user: FirebaseUser | null,
  userData: User | null
): { uid: string; name: string; role: string } {
  return {
    uid: user?.uid || '',
    name: getUserDisplayName(user, userData),
    role: userData?.role || 'User'
  };
}

/**
 * Clean metadata object by removing undefined values
 * Firestore doesn't allow undefined values
 */
export function cleanMetadata(metadata: Record<string, any>): Record<string, any> {
  const cleaned: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined && value !== null) {
      cleaned[key] = value;
    }
  }
  
  return cleaned;
}