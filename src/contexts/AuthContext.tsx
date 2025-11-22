'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUser, getUserByEmail, createUser, User } from '@/lib/firestore';
import { logUserLogin, logUserLogout } from '@/lib/auditLogs';

interface AuthContextType {
  user: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, role: 'Admin' | 'Manager' | 'Employee') => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

/**
* Provides authentication context to descendants, managing user state and auth operations.
* @example
* AuthProvider({ children: <App /> })
* <AuthContext.Provider value={{ user, userData, loading, signIn, signUp, signOut }}>
* @param {{React.ReactNode}} {{children}} - Child elements that consume authentication context.
* @returns {{JSX.Element}} JSX element wrapping children with the AuthContext provider.
**/
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user && user.email) {
        try {
          // Try email-based lookup first (faster)
          let data = await getUserByEmail(user.email);
          
          // If not found, try UID-based lookup (backward compatibility)
          if (!data) {
            data = await getUser(user.uid);
          }
          
          setUserData(data);
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUserData(null);
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  /**
  * Signs in a user with email and password and logs login activity if available.
  * @example
  * sync('user@example.com', 'p@ssw0rd')
  * undefined
  * @param {{string}} {{email}} - User email address.
  * @param {{string}} {{password}} - User password.
  * @returns {{Promise<void>}} Promise that resolves when sync is complete.
  **/
  const signIn = async (email: string, password: string) => {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    
    // Log user login immediately after successful sign in
    if (user && user.email) {
      try {
        let data = await getUserByEmail(user.email);
        if (!data) {
          data = await getUser(user.uid);
        }
        
        if (data) {
          await logUserLogin(user.uid, data.name, data.role);
        }
      } catch (error) {
        console.error('Error logging user login:', error);
        // Don't throw error to avoid breaking the login flow
      }
    }
  };

  /**
  * Creates a new authenticated user and saves their profile to Firestore
  * @example
  * sync('user@example.com', 'securePass123', 'John Doe', 'Admin')
  * undefined
  * @param {{string}} {{email}} - User email for authentication.
  * @param {{string}} {{password}} - User password for authentication.
  * @param {{string}} {{name}} - Full name to store in the user profile.
  * @param {{'Admin' | 'Manager' | 'Employee'}} {{role}} - Role assigned to the new user.
  * @returns {{Promise<void>}} Performs the creation of the user and their Firestore document.
  **/
  const signUp = async (email: string, password: string, name: string, role: 'Admin' | 'Manager' | 'Employee') => {
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user document in Firestore
      await createUser(user.uid, {
        email,
        name,
        role
      });
    } catch (error: any) {
      throw error;
    }
  };

  /**
  * Logs the current user’s logout and signs them out of Firebase.
  * @example
  * sync()
  * undefined
  * @param {{}} {} - No parameters.
  * @returns {{Promise<void>}} Resolves once the logout and sign-out operations complete.
  **/
  const signOut = async () => {
    // Log user logout before signing out
    if (user && userData) {
      try {
        await logUserLogout(user.uid, userData.name, userData.role);
      } catch (error) {
        console.error('Error logging user logout:', error);
        // Don't throw error to avoid breaking the logout flow
      }
    }
    
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
