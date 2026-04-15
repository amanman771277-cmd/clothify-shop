import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, loginWithGoogle, logout } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  userData: any | null;
  loading: boolean;
  isAdmin: boolean;
  isSeller: boolean;
  isSuperAdmin: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSeller, setIsSeller] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const isSuper = currentUser.email?.toLowerCase() === 'amanuelyohannes929@gmail.com' || currentUser.uid === 'pDS9I0dPdCOx8Eh5SVoWqqLK0V62';
        setIsSuperAdmin(isSuper);
        
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData(data);
            setIsAdmin(isSuper || data.role === 'admin');
            setIsSeller(isSuper || data.role === 'seller');
          } else {
            setUserData(null);
            setIsAdmin(isSuper);
            setIsSeller(isSuper);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
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
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading, isAdmin, isSeller, isSuperAdmin, login: loginWithGoogle, logout }}>
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
