import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, logout } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  userData: any | null;
  loading: boolean;
  isAdmin: boolean;
  isSeller: boolean;
  isSuperAdmin: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function formatAuthError(code: string, rawMessage: string): string {
  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completing login. Please try again. / የ Google መግቢያ መስኮቱ ተዘግቷል። እባክዎ እንደገና ይሞክሩ።';
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by your browser. Please allow popups for this site and try again. / ብራውዘርዎ የመግቢያ መስኮቱን አግዶታል። እባክዎ popup ፈቅደው እንደገና ይሞክሩ።';
    case 'auth/cancelled-popup-request':
      return 'A sign-in attempt is already in progress. Please wait a moment and try again. / የመግቢያ ጥያቄ በሂደት ላይ ነው። እባክዎ ትንሽ ቆይተው ይሞክሩ።';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for Google Sign-In in Firebase Authentication settings. / ይህ ድረ-ገጽ በ Firebase Auth ውስጥ አልተፈቀደም።';
    case 'auth/operation-not-allowed':
      return 'Google Sign-In provider is not enabled in Firebase Authentication. / Google Sign-In በ Firebase ውስጥ አልነቃም።';
    case 'auth/network-request-failed':
      return 'Network error during authentication. Please check your internet connection and try again. / የኢንተርኔት ግንኙነት ችግር አጋጥሟል። እባክዎ እንደገና ይሞክሩ።';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support. / ይህ መለያ ታግዷል።';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method. / ይህ ኢሜል በሌላ መግቢያ ዘዴ ተመዝግቧል።';
    case 'auth/invalid-api-key':
    case 'auth/app-not-authorized':
      return 'Firebase configuration error. Please verify firebase-applet-config.json settings. / የ Firebase ማዋቀር ችግር አጋጥሟል።';
    case 'permission-denied':
      return 'Firestore permission denied while loading your user profile. Please verify security rules. / የመረጃ ቋት ፍቃድ ተከልክሏል።';
    default:
      return `Authentication failed (${code}): ${rawMessage}`;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSeller, setIsSeller] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          const isSuper =
            currentUser.email?.toLowerCase() === 'amanuelyohannes929@gmail.com' ||
            currentUser.uid === 'pDS9I0dPdCOx8Eh5SVoWqqLK0V62';
          setIsSuperAdmin(isSuper);

          try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
              const data = userDoc.data();
              setUserData(data);
              setIsAdmin(isSuper || data.role === 'admin');
              setIsSeller(isSuper || data.role === 'seller');
            } else {
              const newUserData = {
                uid: currentUser.uid,
                email: currentUser.email || '',
                displayName: currentUser.displayName || 'User',
                photoURL: currentUser.photoURL || '',
                role: 'user',
                createdAt: new Date(),
              };
              await setDoc(userDocRef, newUserData);
              setUserData(newUserData);
              setIsAdmin(isSuper);
              setIsSeller(isSuper);
            }
          } catch (error: any) {
            const code = error?.code || 'firestore/unknown';
            const message = error?.message || String(error);
            console.error('AuthProvider: Failed to fetch or initialize user profile:', {
              uid: currentUser.uid,
              email: currentUser.email,
              code,
              message,
              error,
            });
            setAuthError(formatAuthError(code, message));
            setIsAdmin(isSuper);
            setIsSeller(isSuper);
          }
        } else {
          setUserData(null);
          setIsAdmin(false);
          setIsSeller(false);
          setIsSuperAdmin(false);
        }
        setLoading(false);
      },
      (error: any) => {
        const code = error?.code || 'auth/state-listener-error';
        const message = error?.message || String(error);
        console.error('AuthProvider: Auth state listener error:', {
          code,
          message,
          error,
        });
        setAuthError(formatAuthError(code, message));
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const newUser = result.user;

      const userRef = doc(db, 'users', newUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: newUser.uid,
          email: newUser.email || '',
          displayName: newUser.displayName || 'User',
          photoURL: newUser.photoURL || '',
          role: 'user',
          createdAt: new Date(),
        });
      }
      return true;
    } catch (err: any) {
      const code = err?.code || 'auth/unknown';
      const rawMessage = err?.message || 'Authentication failed';
      console.error('AuthProvider: Failed Google login attempt:', {
        code,
        message: rawMessage,
        email: err?.customData?.email,
        credential: err?.credential ? '[present]' : undefined,
        error: err,
      });
      setAuthError(formatAuthError(code, rawMessage));
      return false;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        loading,
        isAdmin,
        isSeller,
        isSuperAdmin,
        authError,
        clearAuthError,
        signInWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
