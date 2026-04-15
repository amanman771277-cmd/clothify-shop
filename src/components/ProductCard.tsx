import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Eye, Heart, ArrowRightLeft } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';
import { useAuth } from '../contexts/AuthContext';
import { LazyImage } from './LazyImage';
import { useTranslation } from 'react-i18next';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  sellerId: string;
  sellerName?: string;
  sizes?: string[];
  colors?: string[];
  onQuickView?: (id: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ id, name, price, originalPrice, imageUrl, sellerId, sellerName, sizes, colors, onQuickView }) => {
  const { t } = useTranslation();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();

  const isWishlisted = isInWishlist(id);
  const isOnSale = originalPrice && originalPrice > price;

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      alert("Please sign in to add items to your wishlist.");
      return;
    }
    if (isWishlisted) {
      removeFromWishlist(id);
    } else {
      addToWishlist(id);
    }
  };

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl bg-white transition-all hover:shadow-xl hover:shadow-slate-200/50 border border-gray-100">
      <Link to={`/product/${id}`} className="aspect-[4/5] w-full overflow-hidden bg-gray-100 relative block">
        <LazyImage 
          src={imageUrl} 
          alt={name} 
          className="h-full w-full transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
        
        {isOnSale && (
          <div className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full z-10">
            {t('common.sale')}
          </div>
        )}
      </Link>
      
      {/* Action Buttons Overlay */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <button
          onClick={handleWishlistToggle}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 backdrop-blur text-slate-900 shadow-md transition-transform hover:scale-110 hover:bg-white focus:outline-none"
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart className={`h-5 w-5 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
        </button>

        {onQuickView && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onQuickView(id);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 backdrop-blur text-slate-900 shadow-md transition-transform hover:scale-110 hover:bg-white focus:outline-none"
            aria-label="Quick view"
          >
            <Eye className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="text-sm sm:text-base font-medium text-slate-900 line-clamp-1 mb-1">
          <Link to={`/product/${id}`}>
            <span aria-hidden="true" className="absolute inset-0" />
            {name}
          </Link>
        </h3>
        <div className="mt-auto flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {isOnSale && (
              <span className="text-xs text-slate-400 line-through">{originalPrice?.toLocaleString() || '0'} ETB</span>
            )}
            <span className={`text-sm font-semibold ${isOnSale ? 'text-red-500' : 'text-slate-600'}`}>
              {price?.toLocaleString() || '0'} ETB
            </span>
          </div>
        </div>
      </div>
      <div className="absolute bottom-4 right-4 sm:bottom-5 sm:right-5 z-10">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            addToCart({ productId: id, name, price, imageUrl, sellerId, sellerName });
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full shadow-md transition-transform focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 bg-white text-slate-900 hover:scale-110 hover:bg-slate-50"
          aria-label="Add to cart"
        >
          <ShoppingBag className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
