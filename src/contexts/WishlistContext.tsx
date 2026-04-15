import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

interface WishlistItem {
  id: string;
  productId: string;
}

interface WishlistContextType {
  wishlistItems: WishlistItem[];
  addToWishlist: (productId: string) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
  loading: boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setWishlistItems([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'wishlist'), where('userId', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        productId: doc.data().productId
      }));
      setWishlistItems(items);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching wishlist:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const addToWishlist = async (productId: string) => {
    if (!user) return;
    
    // Check if already in wishlist
    if (isInWishlist(productId)) return;

    try {
      await addDoc(collection(db, 'wishlist'), {
        userId: user.uid,
        productId,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error adding to wishlist:", error);
    }
  };

  const removeFromWishlist = async (productId: string) => {
    if (!user) return;

    const item = wishlistItems.find(item => item.productId === productId);
    if (!item) return;

    try {
      await deleteDoc(doc(db, 'wishlist', item.id));
    } catch (error) {
      console.error("Error removing from wishlist:", error);
    }
  };

  const isInWishlist = (productId: string) => {
    return wishlistItems.some(item => item.productId === productId);
  };

  return (
    <WishlistContext.Provider value={{ wishlistItems, addToWishlist, removeFromWishlist, isInWishlist, loading }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};
