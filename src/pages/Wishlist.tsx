import React, { useEffect, useState } from 'react';
import { useWishlist } from '../contexts/WishlistContext';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ProductCard } from '../components/ProductCard';
import { Loader2, Heart, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
}

export const Wishlist: React.FC = () => {
  const { wishlistItems, loading: wishlistLoading } = useWishlist();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWishlistProducts = async () => {
      if (wishlistItems.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      try {
        const productPromises = wishlistItems.map(item => getDoc(doc(db, 'products', item.productId)));
        const productDocs = await Promise.all(productPromises);
        
        const fetchedProducts = productDocs
          .filter(doc => doc.exists())
          .map(doc => ({ id: doc.id, ...doc.data() } as Product));
          
        setProducts(fetchedProducts);
      } catch (error) {
        console.error("Error fetching wishlist products:", error);
      } finally {
        setLoading(false);
      }
    };

    if (!wishlistLoading) {
      fetchWishlistProducts();
    }
  }, [wishlistItems, wishlistLoading]);

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Heart className="w-16 h-16 text-slate-200 mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Sign in to view your wishlist</h2>
        <p className="text-slate-500 mb-6 text-center max-w-md">
          Keep track of your favorite items by signing in to your account.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 min-h-screen">
      <button 
        onClick={() => window.history.back()}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center gap-3 mb-10">
        <Heart className="w-8 h-8 text-slate-900 fill-slate-900" />
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">Your Wishlist</h1>
      </div>

      {wishlistLoading || loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {products.map(product => (
            <ProductCard key={product.id} {...product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border border-slate-100">
          <Heart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Your wishlist is empty</h2>
          <p className="text-slate-500 mb-6">Save items you love to your wishlist.</p>
          <Link 
            to="/"
            className="inline-flex items-center justify-center bg-slate-900 text-white px-6 py-3 rounded-full font-medium hover:bg-slate-800 transition-colors"
          >
            Continue Shopping
          </Link>
        </div>
      )}
    </div>
  );
};
