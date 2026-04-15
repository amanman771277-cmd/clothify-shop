import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';
import { useAuth } from '../contexts/AuthContext';
import { X, ShoppingBag, Loader2, Heart } from 'lucide-react';
import { LazyImage } from './LazyImage';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  imageUrls?: string[];
  sizes?: string[];
  colors?: string[];
  sellerId: string;
  sellerName?: string;
}

interface QuickViewModalProps {
  productId: string;
  onClose: () => void;
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({ productId, onClose }) => {
  const { t } = useTranslation();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [mainImage, setMainImage] = useState<string>('');
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();

  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');

  const isWishlisted = isInWishlist(productId);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const docRef = doc(db, 'products', productId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as Product;
          setProduct(data);
          setMainImage(data.imageUrl);
          if (data.sizes && data.sizes.length > 0) setSelectedSize(data.sizes[0]);
          if (data.colors && data.colors.length > 0) setSelectedColor(data.colors[0]);
        }
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  if (!productId) return null;

  const handleAddToCart = () => {
    if (!product) return;
    addToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      size: selectedSize,
      color: selectedColor,
      sellerId: product.sellerId,
      sellerName: product.sellerName
    });
    onClose();
  };

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      alert("Please sign in to add items to your wishlist.");
      return;
    }
    if (isWishlisted) {
      removeFromWishlist(productId);
    } else {
      addToWishlist(productId);
    }
  };

  const isOnSale = product?.originalPrice && product.originalPrice > product.price;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-white/80 backdrop-blur rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {loading ? (
          <div className="flex-1 flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-slate-900" />
          </div>
        ) : !product ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] text-center p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Product Not Found</h2>
            <p className="text-slate-500">This product might have been removed.</p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row overflow-y-auto">
            {/* Image Section */}
            <div className="w-full md:w-1/2 bg-slate-50 p-6 flex flex-col gap-4 relative">
              <div className="aspect-[4/5] w-full rounded-2xl overflow-hidden bg-white relative">
                <LazyImage 
                  src={mainImage} 
                  alt={product.name} 
                  className="w-full h-full"
                />
                {isOnSale && (
                  <div className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full z-10">
                    {t('common.sale')}
                  </div>
                )}
              </div>
              
              {product.imageUrls && product.imageUrls.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {[product.imageUrl, ...product.imageUrls].map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setMainImage(img)}
                      className={`aspect-square rounded-lg overflow-hidden bg-white border-2 transition-all ${
                        mainImage === img ? 'border-slate-900 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <LazyImage src={img} alt={`${product.name} view ${index + 1}`} className="w-full h-full" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details Section */}
            <div className="w-full md:w-1/2 p-6 sm:p-8 flex flex-col">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                {product.name}
              </h2>
              
              <div className="flex items-center gap-3 mb-6">
                {isOnSale && (
                  <span className="text-lg text-slate-400 line-through">
                    {product.originalPrice?.toLocaleString() || '0'} ETB
                  </span>
                )}
                <span className={`text-xl font-semibold ${isOnSale ? 'text-red-500' : 'text-slate-900'}`}>
                  {product.price?.toLocaleString() || '0'} ETB
                </span>
              </div>

              <div className="prose prose-sm prose-slate mb-8 line-clamp-4">
                <p className="text-slate-600 leading-relaxed">
                  {product.description}
                </p>
              </div>

              {/* Variations */}
              <div className="space-y-5 mb-8 flex-1">
                {product.colors && product.colors.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-900 mb-2">Color</h3>
                    <div className="flex flex-wrap gap-2">
                      {product.colors.map(color => (
                        <button
                          key={color}
                          onClick={() => setSelectedColor(color)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                            selectedColor === color 
                              ? 'border-slate-900 bg-slate-900 text-white' 
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {product.sizes && product.sizes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-900 mb-2">Size</h3>
                    <div className="flex flex-wrap gap-2">
                      {product.sizes.map(size => (
                        <button
                          key={size}
                          onClick={() => setSelectedSize(size)}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium border transition-all ${
                            selectedSize === size 
                              ? 'border-slate-900 bg-slate-900 text-white' 
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 mt-auto">
                <div className="flex gap-3">
                  <button 
                    onClick={handleAddToCart}
                    className="flex-1 bg-slate-900 text-white px-6 py-3.5 rounded-xl font-medium hover:bg-slate-800 transition-all active:scale-[0.98] shadow-lg shadow-slate-900/20 flex items-center justify-center gap-2"
                  >
                    <ShoppingBag className="w-5 h-5" />
                    {t('common.add_to_cart')}
                  </button>
                  <button
                    onClick={handleWishlistToggle}
                    className="w-14 h-14 bg-slate-100 text-slate-900 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-colors shrink-0"
                    aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                  >
                    <Heart className={`w-6 h-6 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
                  </button>
                </div>
                <Link 
                  to={`/product/${product.id}`}
                  onClick={onClose}
                  className="w-full bg-slate-100 text-slate-900 px-6 py-3.5 rounded-xl font-medium hover:bg-slate-200 transition-colors flex items-center justify-center"
                >
                  {t('product.view_full_details')}
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
