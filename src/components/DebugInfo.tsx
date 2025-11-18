'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';

export default function DebugInfo() {
  const { user, userData, loading } = useAuth();
  const [firebaseConfig, setFirebaseConfig] = useState<any>(null);

  useEffect(() => {
    setFirebaseConfig({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'Set' : 'Missing',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? 'Set' : 'Missing',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'Set' : 'Missing',
    });
  }, []);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-4 rounded-lg text-xs max-w-sm">
      <h3 className="font-bold mb-2">Debug Info</h3>
      <div className="space-y-1">
        <p>Loading: {loading ? 'Yes' : 'No'}</p>
        <p>User: {user ? 'Authenticated' : 'Not authenticated'}</p>
        <p>UserData: {userData ? `${userData.name} (${userData.role})` : 'No data'}</p>
        <p>Firebase Config:</p>
        <ul className="ml-2">
          {firebaseConfig && Object.entries(firebaseConfig).map(([key, value]) => (
            <li key={key}>{key}: {value as string}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}