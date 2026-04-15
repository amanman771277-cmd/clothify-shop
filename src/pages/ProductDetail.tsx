import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, orderBy, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, ShoppingBag, Truck, ShieldCheck, RefreshCcw, Loader2, Star, ZoomIn, X } from 'lucide-react';
import { LazyImage } from '../components/LazyImage';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { addViewedProduct } from '../utils/viewHistory';

import { ProductCard } from '../components/ProductCard';

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
  category?: string;
}

interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  rating: number;
  comment: string;
  createdAt: any;
}

export const ProductDetail: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [mainImage, setMainImage] = useState<string>('');
  const { addToCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');

  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomStyle, setZoomStyle] = useState<React.CSSProperties>({});
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [similarLoading, setSimilarLoading] = useState(true);

  const allImages = product ? [product.imageUrl, ...(product.imageUrls || [])] : [];

  useEffect(() => {
    const fetchSimilarProducts = async () => {
      if (!product?.category) {
        setSimilarLoading(false);
        return;
      }
      try {
        const q = query(
          collection(db, 'products'),
          where('category', '==', product.category),
          where('isAvailable', '==', true),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const similar = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Product))
          .filter(p => p.id !== product.id)
          .slice(0, 4);
        setSimilarProducts(similar);
      } catch (error) {
        console.error("Error fetching similar products:", error);
      } finally {
        setSimilarLoading(false);
      }
    };

    if (product) {
      fetchSimilarProducts();
      
      // Add to view history for AI recommendations
      addViewedProduct({
        id: product.id,
        name: product.name,
        category: product.category || 'General',
        timestamp: Date.now()
      });
    }
  }, [product?.category, product?.id, product?.name]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showLightbox) return;
      if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) => allImages.length > 0 ? (prev + 1) % allImages.length : 0);
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) => allImages.length > 0 ? (prev - 1 + allImages.length) % allImages.length : 0);
      }
      if (e.key === 'Escape') setShowLightbox(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLightbox, allImages.length]);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as Product;
          setProduct(data);
          setMainImage(data.imageUrl);
          if (data.sizes && data.sizes.length > 0) setSelectedSize(data.sizes[0]);
          if (data.colors && data.colors.length > 0) setSelectedColor(data.colors[0]);

          if (data.category) {
            try {
              const savedCategories = JSON.parse(localStorage.getItem('viewedCategories') || '[]');
              const updatedCategories = [data.category, ...savedCategories.filter((c: string) => c !== data.category)].slice(0, 3);
              localStorage.setItem('viewedCategories', JSON.stringify(updatedCategories));
            } catch (e) {
              console.error('Error saving category to localStorage', e);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchReviews = async () => {
      if (!id) return;
      try {
        const q = query(
          collection(db, 'reviews'),
          where('productId', '==', id),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        setReviews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review)));
      } catch (error) {
        console.error("Error fetching reviews:", error);
      } finally {
        setReviewsLoading(false);
      }
    };

    fetchProduct();
    fetchReviews();
  }, [id]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZoomed) return;
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomStyle({
      transformOrigin: `${x}% ${y}%`,
      transform: 'scale(2.5)'
    });
  };

  const handleMouseEnter = () => setIsZoomed(true);
  const handleMouseLeave = () => {
    setIsZoomed(false);
    setZoomStyle({});
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !product) return;
    
    setSubmittingReview(true);
    try {
      const reviewData = {
        productId: product.id,
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userPhoto: user.photoURL || '',
        rating: reviewRating,
        comment: reviewComment,
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'reviews'), reviewData);
      setReviews([{ id: docRef.id, ...reviewData, createdAt: new Date() } as Review, ...reviews]);
      setReviewComment('');
      setReviewRating(5);
    } catch (error) {
      console.error("Error submitting review:", error);
      alert("Failed to submit review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-900" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('common.no_items')}</h2>
        <p className="text-slate-500 mb-6">{t('common.error')}</p>
        <Link to="/" className="text-slate-900 font-medium hover:underline flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> {t('common.home')}
        </Link>
      </div>
    );
  }

  if (product.status === 'sold') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">This item has been sold.</h2>
        <p className="text-slate-500 mb-6">Sorry, this product is no longer available.</p>
        <Link to="/" className="text-slate-900 font-medium hover:underline flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> {t('common.home')}
        </Link>
      </div>
    );
  }

  const handleOpenLightbox = (index: number) => {
    setLightboxIndex(index);
    setShowLightbox(true);
  };

  const nextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setLightboxIndex((prev) => (prev + 1) % allImages.length);
  };

  const prevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setLightboxIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  const averageRating = reviews.length > 0 
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
    : 0;

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
  };

  const isOnSale = product.originalPrice && product.originalPrice > product.price;

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t('common.back') || 'Back'}
      </button>

      <div className="lg:grid lg:grid-cols-2 lg:gap-x-12 xl:gap-x-16 mb-16">
        {/* Product Image Gallery */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col gap-4 mb-8 lg:mb-0"
        >
          <div 
            className="aspect-[4/5] w-full rounded-3xl overflow-hidden bg-slate-100 relative group cursor-zoom-in"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
            onClick={() => handleOpenLightbox(allImages.indexOf(mainImage))}
          >
            <motion.div 
              className="w-full h-full"
              animate={isZoomed ? zoomStyle : { transform: 'scale(1)', transformOrigin: '50% 50%' }}
              transition={{ type: 'tween', ease: 'easeOut', duration: 0.2 }}
            >
              <LazyImage 
                src={mainImage} 
                alt={product.name} 
                className="w-full h-full"
                imgClassName="transition-transform duration-500 group-hover:scale-105"
              />
            </motion.div>
            
            {/* Zoom Hint */}
            <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <ZoomIn className="w-5 h-5 text-slate-700" />
            </div>

            {isOnSale && (
              <div className="absolute top-4 left-4 bg-red-500 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full z-10 shadow-lg shadow-red-500/30">
                Sale
              </div>
            )}
          </div>
          
          {allImages.length > 1 && (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {allImages.map((img, index) => (
                <button
                  key={index}
                  onClick={() => setMainImage(img)}
                  className={`aspect-square rounded-xl overflow-hidden bg-slate-100 border-2 transition-all ${
                    mainImage === img ? 'border-slate-900 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <LazyImage src={img} alt={`${product.name} view ${index + 1}`} className="w-full h-full" />
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* Product Info */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col"
        >
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-4">
            {product.name}
          </h1>
          
          {/* Rating Summary */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star 
                  key={star} 
                  className={`w-5 h-5 ${star <= Math.round(averageRating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} 
                />
              ))}
            </div>
            <span className="text-sm text-slate-500">
              ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
            </span>
          </div>

          <div className="flex items-center gap-3 mb-8">
            {isOnSale && (
              <span className="text-2xl text-slate-400 line-through">
                {product.originalPrice?.toLocaleString() || '0'} ETB
              </span>
            )}
            <span className={`text-3xl font-bold ${isOnSale ? 'text-red-500' : 'text-slate-900'}`}>
              {product.price?.toLocaleString() || '0'} ETB
            </span>
          </div>

          <div className="prose prose-slate mb-8">
            <p className="text-slate-600 leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Variations */}
          <div className="space-y-6 mb-10">
            {product.colors && product.colors.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-900 mb-3">{t('product.colors')}</h3>
                <div className="flex flex-wrap gap-3">
                  {product.colors.map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
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
                <h3 className="text-sm font-medium text-slate-900 mb-3">{t('product.sizes')}</h3>
                <div className="flex flex-wrap gap-3">
                  {product.sizes.map(size => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-medium border transition-all ${
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

          <button 
            onClick={handleAddToCart}
            className="w-full bg-slate-900 text-white px-8 py-4 rounded-2xl text-lg font-medium hover:bg-slate-800 transition-all active:scale-[0.98] shadow-xl shadow-slate-900/20 flex items-center justify-center gap-3 mb-10"
          >
            <ShoppingBag className="w-5 h-5" />
            {t('common.add_to_cart')}
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 border-t border-slate-200">
            <div className="flex items-start gap-3 text-slate-600">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-medium block text-slate-900">{t('common.free_delivery')}</span>
                <span className="text-xs text-slate-500">{t('common.estimated_delivery')}</span>
              </div>
            </div>
            <div className="flex items-start gap-3 text-slate-600">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <RefreshCcw className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-medium block text-slate-900">{t('common.returns')}</span>
                <span className="text-xs text-slate-500">{t('common.returns_desc')}</span>
              </div>
            </div>
            <div className="flex items-start gap-3 text-slate-600">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-medium block text-slate-900">{t('common.secure_checkout')}</span>
                <span className="text-xs text-slate-500">{t('common.secure_checkout_desc')}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Reviews Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className="border-t border-slate-200 pt-16"
      >
        <h2 className="text-2xl font-bold text-slate-900 mb-8">{t('product.reviews')}</h2>
        
        <div className="lg:grid lg:grid-cols-12 lg:gap-12">
          {/* Review Form */}
          <div className="lg:col-span-4 mb-12 lg:mb-0">
            <div className="bg-slate-50 rounded-3xl p-6 sm:p-8 border border-slate-100">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">{t('product.write_review')}</h3>
              {user ? (
                <form onSubmit={handleReviewSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t('product.rating')}</label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewRating(star)}
                          className="focus:outline-none"
                        >
                          <Star 
                            className={`w-8 h-8 transition-colors ${star <= reviewRating ? 'text-amber-400 fill-amber-400' : 'text-slate-300 hover:text-amber-200'}`} 
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t('product.comment')}</label>
                    <textarea
                      required
                      rows={4}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all resize-none"
                      placeholder="Share your thoughts about this product..."
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="w-full bg-slate-900 text-white px-4 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {submittingReview ? <Loader2 className="w-5 h-5 animate-spin" /> : t('product.submit_review')}
                  </button>
                </form>
              ) : (
                <div className="text-center py-6">
                  <p className="text-slate-600 mb-4">{t('product.must_login_review')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Reviews List */}
          <div className="lg:col-span-8">
            {reviewsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : reviews.length > 0 ? (
              <div className="space-y-8">
                {reviews.map((review) => (
                  <div key={review.id} className="border-b border-slate-100 pb-8 last:border-0">
                    <div className="flex items-center gap-4 mb-4">
                      {review.userPhoto ? (
                        <LazyImage src={review.userPhoto} alt={review.userName} className="w-10 h-10 rounded-full bg-slate-100" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-medium">
                          {review.userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="font-medium text-slate-900">{review.userName}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star 
                                key={star} 
                                className={`w-3.5 h-3.5 ${star <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} 
                              />
                            ))}
                          </div>
                          <span className="text-xs text-slate-500">
                            {review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString() : 'Just now'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-slate-600 leading-relaxed">{review.comment}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-50 rounded-3xl border border-slate-100">
                <Star className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-900 mb-1">{t('product.no_reviews')}</h3>
                <p className="text-slate-500">{t('product.first_review')}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Similar Products Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className="border-t border-slate-200 pt-16 mt-16"
      >
        <h2 className="text-2xl font-bold text-slate-900 mb-8">You May Also Like</h2>
        {similarLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="animate-pulse flex flex-col gap-4">
                <div className="bg-slate-200 aspect-[4/5] rounded-2xl w-full"></div>
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                <div className="h-4 bg-slate-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : similarProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {similarProducts.map(similarProduct => (
              <ProductCard
                key={similarProduct.id}
                id={similarProduct.id}
                name={similarProduct.name}
                price={similarProduct.price}
                originalPrice={similarProduct.originalPrice}
                imageUrl={similarProduct.imageUrl}
                sellerId={similarProduct.sellerId}
                sellerName={similarProduct.sellerName}
                sizes={similarProduct.sizes}
                colors={similarProduct.colors}
              />
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-center py-8">No similar products found.</p>
        )}
      </motion.div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {showLightbox && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 sm:p-8"
            onClick={() => setShowLightbox(false)}
          >
            <button 
              className="absolute top-6 right-6 z-10 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-3 rounded-full transition-all"
              onClick={() => setShowLightbox(false)}
            >
              <X className="w-6 h-6" />
            </button>

            {allImages.length > 1 && (
              <>
                <button 
                  className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 z-10 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-4 rounded-full transition-all"
                  onClick={prevImage}
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <button 
                  className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-10 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-4 rounded-full transition-all"
                  onClick={nextImage}
                >
                  <ArrowLeft className="w-6 h-6 rotate-180" />
                </button>
              </>
            )}

            <div className="relative w-full h-full flex flex-col items-center justify-center gap-6">
              <motion.div
                key={lightboxIndex}
                initial={{ opacity: 0, scale: 0.9, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: -20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative max-w-5xl max-h-[80vh] flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <LazyImage 
                  src={allImages[lightboxIndex]} 
                  alt={`${product.name} - view ${lightboxIndex + 1}`} 
                  className="max-w-full max-h-full rounded-lg shadow-2xl"
                  imgClassName="object-contain"
                />
              </motion.div>

              {/* Image Counter & Thumbnails */}
              <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
                <span className="text-white/60 text-sm font-medium">
                  {lightboxIndex + 1} / {allImages.length}
                </span>
                
                {allImages.length > 1 && (
                  <div className="flex gap-2 p-2 bg-white/5 rounded-2xl backdrop-blur-sm">
                    {allImages.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setLightboxIndex(idx)}
                        className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                          idx === lightboxIndex ? 'border-white scale-110' : 'border-transparent opacity-40 hover:opacity-100'
                        }`}
                      >
                        <LazyImage src={img} alt="thumbnail" className="w-full h-full" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
