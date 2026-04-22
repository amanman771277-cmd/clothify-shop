import React, { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ProductCard } from '../components/ProductCard';
import { LazyImage } from '../components/LazyImage';
import { QuickViewModal } from '../components/QuickViewModal';
import { ArrowRight, Sparkles, Filter, TrendingUp, ShieldCheck, DollarSign } from 'lucide-react';
import { motion } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GoogleGenAI, Type } from '@google/genai';
import { getViewHistory } from '../utils/viewHistory';

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  category?: string;
  imageUrl: string;
  sizes?: string[];
  colors?: string[];
  sellerId: string;
  sellerName?: string;
  averageRating?: number;
  createdAt?: any;
}

const CATEGORIES = ['All', 'Men', 'Women', 'Kids', 'Shoes'];
const SORT_OPTIONS = [
  { value: 'ai-recommended', label: 'Recommended for You' },
  { value: 'newest', label: 'Newest Arrivals' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'average-rating', label: 'Average Rating' }
];

export const Home: React.FC = () => {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedSize, setSelectedSize] = useState('All');
  const [selectedColor, setSelectedColor] = useState('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  
  const [quickViewProductId, setQuickViewProductId] = useState<string | null>(null);
  const [aiSortedProductIds, setAiSortedProductIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // Fetching more products to allow client-side filtering without complex indexes
        const q = query(
          collection(db, 'products'),
          where('isAvailable', '==', true),
          orderBy('createdAt', 'desc'),
          limit(100)
        );
        const snapshot = await getDocs(q);
        const fetched = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];
        setProducts(fetched);

        // AI Recommendation Sorting
        const viewHistory = getViewHistory();
        if (viewHistory.length > 0) {
          try {
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            
            // Limit payload size to prevent proxy 500 errors (Rpc failed due to xhr error)
            const recentViews = viewHistory.slice(0, 5).map(v => v.name).join(', ');
            const productSummary = fetched.slice(0, 30).map(p => ({ id: p.id, name: p.name, category: p.category }));
            
            const prompt = `
              As an AI recommendation engine for an e-commerce clothing store.
              User recently viewed products similar to: ${recentViews}
              
              Available products:
              ${JSON.stringify(productSummary)}
              
              Sort the available product IDs so the most relevant ones are first.
              Return ONLY a valid JSON array of product ID strings.
            `;
            
            const response = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: prompt,
              config: {
                responseMimeType: "application/json"
              }
            });
            
            const sortedIds = JSON.parse(response.text.trim());
            if (Array.isArray(sortedIds) && sortedIds.length > 0) {
              setAiSortedProductIds(sortedIds);
              setSortBy('ai-recommended');
            }
          } catch (aiError) {
            console.error("AI Recommendation error:", aiError);
          }
        }
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const availableSizes = useMemo(() => {
    const sizes = new Set<string>();
    products.forEach(p => p.sizes?.forEach(s => sizes.add(s)));
    return ['All', ...Array.from(sizes).sort()];
  }, [products]);

  const availableColors = useMemo(() => {
    const colors = new Set<string>();
    products.forEach(p => p.colors?.forEach(c => colors.add(c)));
    return ['All', ...Array.from(colors).sort()];
  }, [products]);

  const filteredAndSortedProducts = useMemo(() => {
    let result = [...products];

    // Filter by search query
    if (searchQuery) {
      const queryLower = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(queryLower) || 
        (p.category && p.category.toLowerCase().includes(queryLower))
      );
    }

    // Filter by category
    if (selectedCategory !== 'All') {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Filter by size
    if (selectedSize !== 'All') {
      result = result.filter(p => p.sizes?.includes(selectedSize));
    }

    // Filter by color
    if (selectedColor !== 'All') {
      result = result.filter(p => p.colors?.includes(selectedColor));
    }

    // Filter by price range
    if (minPrice !== '') {
      result = result.filter(p => p.price >= Number(minPrice));
    }
    if (maxPrice !== '') {
      result = result.filter(p => p.price <= Number(maxPrice));
    }

    // Sort
    if (sortBy === 'ai-recommended' && aiSortedProductIds.length > 0) {
      result.sort((a, b) => {
        const indexA = aiSortedProductIds.indexOf(a.id);
        const indexB = aiSortedProductIds.indexOf(b.id);
        // If not in AI list, push to bottom
        const posA = indexA !== -1 ? indexA : 999999;
        const posB = indexB !== -1 ? indexB : 999999;
        return posA - posB;
      });
    } else if (sortBy === 'price-asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'average-rating') {
      result.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
    } else { // 'newest' or fallback
      result.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
    }

    return result;
  }, [products, selectedCategory, selectedSize, selectedColor, minPrice, maxPrice, sortBy, aiSortedProductIds]);

  const clearFilters = () => {
    setSelectedCategory('All');
    setSelectedSize('All');
    setSelectedColor('All');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('newest');
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative bg-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-32 sm:pb-40">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative z-10 max-w-2xl"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/50 text-slate-800 text-sm font-medium mb-6"
            >
              <Sparkles className="w-4 h-4" />
              <span>{t('home.new_collection')}</span>
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-5xl sm:text-7xl font-bold tracking-tight text-slate-900 mb-6 leading-[1.1]"
            >
              {t('home.hero_title')}
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-lg sm:text-xl text-slate-600 mb-10 max-w-lg"
            >
              {t('home.hero_subtitle')}
            </motion.p>
            <motion.button 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              onClick={() => {
                document.getElementById('featured-products')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-full text-lg font-medium hover:bg-slate-800 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-slate-900/20"
            >
              {t('home.shop_now')}
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </motion.div>
        </div>
        
        {/* Decorative background image for hero */}
        <motion.div 
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="absolute inset-y-0 right-0 w-1/2 hidden lg:block"
        >
          <LazyImage 
            src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop" 
            alt="Fashion model" 
            className="w-full h-full rounded-l-[4rem] shadow-2xl"
            imgClassName="object-center"
          />
        </motion.div>
      </section>

      {/* Categories Section */}
      <section className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{t('common.categories')}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {[
            { name: 'Men', emoji: '👨', color: 'bg-blue-50 text-blue-600' },
            { name: 'Women', emoji: '👩', color: 'bg-pink-50 text-pink-600' },
            { name: 'Kids', emoji: '👶', color: 'bg-yellow-50 text-yellow-600' },
            { name: 'Shoes', emoji: '👟', color: 'bg-purple-50 text-purple-600' },
          ].map((cat) => (
            <div 
              key={cat.name} 
              onClick={() => {
                setSelectedCategory(cat.name);
                document.getElementById('featured-products')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="group cursor-pointer flex flex-col items-center justify-center p-6 sm:p-8 rounded-3xl bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100"
            >
              <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full ${cat.color} flex items-center justify-center text-3xl sm:text-4xl mb-4 group-hover:scale-110 transition-transform`}>
                {cat.emoji}
              </div>
              <span className="font-medium text-slate-900">{cat.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Products & Filters */}
      <section id="featured-products" className="py-16 sm:py-24 bg-slate-50 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-10 gap-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-2">{t('common.featured_products')}</h2>
              <p className="text-slate-500">{t('home.hero_subtitle')}</p>
            </div>
            
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200">
                <Filter className="w-4 h-4 text-slate-500" />
                <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-transparent text-sm font-medium text-slate-900 outline-none cursor-pointer"
                >
                  <option value="All" disabled className="text-slate-400">{t('product.category')}</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
 
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200">
                <select 
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  className="bg-transparent text-sm font-medium text-slate-900 outline-none cursor-pointer"
                >
                  <option value="All" disabled className="text-slate-400">{t('product.size')}</option>
                  {availableSizes.map(size => (
                    <option key={size} value={size}>{size === 'All' ? 'All Sizes' : size}</option>
                  ))}
                </select>
              </div>
 
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200">
                <select 
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="bg-transparent text-sm font-medium text-slate-900 outline-none cursor-pointer"
                >
                  <option value="All" disabled className="text-slate-400">{t('product.color')}</option>
                  {availableColors.map(color => (
                    <option key={color} value={color}>{color === 'All' ? 'All Colors' : color}</option>
                  ))}
                </select>
              </div>
 
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200">
                <input 
                  type="number" 
                  placeholder={t('product.min_price')} 
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-20 bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                />
                <span className="text-slate-300">-</span>
                <input 
                  type="number" 
                  placeholder={t('product.max_price')} 
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-20 bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>
              
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200">
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent text-sm font-medium text-slate-900 outline-none cursor-pointer"
                >
                  {SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {(selectedCategory !== 'All' || selectedSize !== 'All' || selectedColor !== 'All' || minPrice !== '' || maxPrice !== '' || sortBy !== 'newest') && (
                <button 
                  onClick={clearFilters}
                  className="text-sm font-medium text-slate-500 hover:text-slate-900 px-2"
                >
                  {t('common.clear')}
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="animate-pulse flex flex-col gap-4">
                  <div className="bg-slate-200 aspect-[4/5] rounded-2xl w-full"></div>
                  <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                </div>
              ))}
            </div>
          ) : filteredAndSortedProducts.length > 0 ? (
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={{
                visible: { transition: { staggerChildren: 0.1 } },
                hidden: {}
              }}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8"
            >
              {filteredAndSortedProducts.map(product => (
                <motion.div
                  key={product.id}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
                  }}
                >
                  <ProductCard 
                    {...product} 
                    onQuickView={setQuickViewProductId}
                  />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
              <p className="text-slate-500 text-lg">{t('common.no_products_found')}</p>
              <button 
                onClick={clearFilters}
                className="mt-4 text-slate-900 font-medium hover:underline"
              >
                {t('common.clear_filters')}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Quick View Modal */}
      {quickViewProductId && (
        <QuickViewModal 
          productId={quickViewProductId} 
          onClose={() => setQuickViewProductId(null)} 
        />
      )}

      {/* Become a Seller Banner */}
      <section className="py-20 bg-slate-900 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-emerald-500/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-1/3 h-full bg-blue-500/10 blur-3xl rounded-full -translate-x-1/2 translate-y-1/2"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-10">
            <div className="max-w-xl text-center md:text-left">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">{t('home.start_selling')}</h2>
              <p className="text-slate-400 text-lg mb-8">
                {t('home.start_selling_desc')}
              </p>
              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                <button 
                  onClick={() => window.location.href = '/become-seller'}
                  className="bg-white text-slate-900 px-8 py-3 rounded-full font-bold hover:bg-slate-100 transition-all hover:scale-105 active:scale-95"
                >
                  {t('common.become_seller')}
                </button>
                <button className="text-white font-medium hover:underline px-4 py-3">
                  {t('home.learn_more')}
                </button>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-4 max-w-sm">
              <div className="space-y-4">
                <div className="bg-white/5 backdrop-blur-sm p-6 rounded-3xl border border-white/10">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500 mb-3">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <h3 className="text-white font-bold mb-1">{t('home.grow_fast')}</h3>
                  <p className="text-slate-500 text-xs">{t('home.grow_fast_desc')}</p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm p-6 rounded-3xl border border-white/10">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-500 mb-3">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-white font-bold mb-1">{t('home.secure')}</h3>
                  <p className="text-slate-500 text-xs">{t('home.secure_desc')}</p>
                </div>
              </div>
              <div className="space-y-4 pt-8">
                <div className="bg-white/5 backdrop-blur-sm p-6 rounded-3xl border border-white/10">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-500 mb-3">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <h3 className="text-white font-bold mb-1">{t('home.low_fees')}</h3>
                  <p className="text-slate-500 text-xs">{t('home.low_fees_desc')}</p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm p-6 rounded-3xl border border-white/10">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center text-orange-500 mb-3">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-white font-bold mb-1">{t('home.easy_setup')}</h3>
                  <p className="text-slate-500 text-xs">{t('home.easy_setup_desc')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
