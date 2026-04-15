import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  LayoutDashboard, 
  Package, 
  Wallet, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Plus,
  ChevronRight,
  Banknote,
  Phone,
  TrendingUp,
  DollarSign,
  Star,
  ShoppingCart,
  ArrowLeft
} from 'lucide-react';
import { AddProductForm } from '../components/AddProductForm';
import { LazyImage } from '../components/LazyImage';

interface SellerStats {
  balance: number;
  totalSalesValue: number;
  totalProducts: number;
  pendingPayouts: number;
  totalPaid: number;
  averageOrderValue: number;
  totalProductsSold: number;
  customerRatings: number;
}

interface SalesLog {
  id: string;
  productName: string;
  imageUrl: string;
  price: number;
  quantity: number;
  date: any;
  status: string;
}

export const SellerDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user, userData, isSeller, loading: authLoading } = useAuth();
  const location = useLocation();
  const [stats, setStats] = useState<SellerStats>({ balance: 0, totalSalesValue: 0, totalProducts: 0, pendingPayouts: 0, totalPaid: 0, averageOrderValue: 0, totalProductsSold: 0, customerRatings: 0 });
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [salesLogs, setSalesLogs] = useState<SalesLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [alertModal, setAlertModal] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('add') === 'true') {
      setShowAddProductModal(true);
    }
  }, [location]);

  useEffect(() => {
    if (isSeller && user) {
      fetchSellerData();
    }
  }, [isSeller, user]);

  const fetchSellerData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch products
      const productsQ = query(collection(db, 'products'), where('sellerId', '==', user.uid));
      const productsSnap = await getDocs(productsQ);
      const sellerProducts = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(sellerProducts);

      // Fetch payout requests
      const payoutQ = query(
        collection(db, 'payoutRequests'), 
        where('sellerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const payoutSnap = await getDocs(payoutQ);
      const requests = payoutSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setPayoutRequests(requests);

      // Fetch orders
      const ordersQ = query(
        collection(db, 'orders'), 
        where('sellerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const ordersSnap = await getDocs(ordersQ);
      const fetchedOrders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setOrders(fetchedOrders);
      
      let totalValue = 0;
      let totalProductsSold = 0;
      let paidOrdersCount = 0;
      const logs: SalesLog[] = [];

      fetchedOrders.forEach(order => {
        if (order.paymentStatus === 'Paid') {
          totalValue += order.price * order.quantity;
          totalProductsSold += order.quantity;
          paidOrdersCount++;
        }
        logs.push({
          id: order.id,
          productName: order.productName,
          imageUrl: order.imageUrl || '',
          price: order.price * order.quantity,
          quantity: order.quantity,
          date: order.createdAt,
          status: order.paymentStatus
        });
      });

      setSalesLogs(logs.slice(0, 10)); // Top 10 recent sales

      // Calculate stats
      const pending = requests
        .filter(r => r.status === 'Pending')
        .reduce((acc, r) => acc + r.amount, 0);
      
      const paid = requests
        .filter(r => r.status === 'Paid')
        .reduce((acc, r) => acc + r.amount, 0);

      const averageOrderValue = paidOrdersCount > 0 ? totalValue / paidOrdersCount : 0;
      const customerRatings = sellerProducts.length > 0 ? 4.8 : 0; // Mocked rating

      setStats({
        balance: userData?.balance || 0,
        totalSalesValue: totalValue,
        totalProducts: sellerProducts.length,
        pendingPayouts: pending,
        totalPaid: paid,
        averageOrderValue,
        totalProductsSold,
        customerRatings
      });
    } catch (error) {
      console.error("Error fetching seller data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData) return;
    
    const amount = Number(payoutAmount);
    if (isNaN(amount) || amount <= 0) {
      setAlertModal({ message: "Please enter a valid amount", type: 'error' });
      return;
    }
    if (amount > userData.balance) {
      setAlertModal({ message: "Insufficient balance", type: 'error' });
      return;
    }

    setRequestingPayout(true);
    try {
      await addDoc(collection(db, 'payoutRequests'), {
        sellerId: user.uid,
        sellerName: userData.displayName || user.displayName || 'Unknown Seller',
        amount: amount,
        status: 'Pending',
        paymentMethod: userData.telebirrNumber ? 'Telebirr' : 'Bank Transfer',
        paymentDetails: userData.telebirrNumber || `${userData.bankInfo?.bankName || 'Bank'} - ${userData.bankInfo?.accountNumber || 'N/A'}`,
        createdAt: serverTimestamp()
      });
      
      // We don't deduct balance here, admin does it upon approval or we can deduct it now and refund if rejected
      // User requested: "Only the Admin... can update the seller's balance"
      // So we just log the request.
      
      setShowPayoutModal(false);
      setPayoutAmount('');
      fetchSellerData();
      setAlertModal({ message: "Payout request submitted successfully!", type: 'success' });
    } catch (error) {
      console.error("Error requesting payout:", error);
      setAlertModal({ message: "Failed to submit payout request", type: 'error' });
    } finally {
      setRequestingPayout(false);
    }
  };

  const handleMarkAsSold = async (productId: string) => {
    try {
      const productRef = doc(db, 'products', productId);
      await updateDoc(productRef, { isAvailable: false, status: 'sold' });
      setAlertModal({ message: "Product marked as sold successfully!", type: 'success' });
      fetchSellerData();
    } catch (error) {
      console.error("Error marking product as sold:", error);
      setAlertModal({ message: "Failed to mark product as sold", type: 'error' });
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-900" /></div>;
  if (!isSeller) return <Navigate to="/" replace />;
  
  if (!userData?.sellerVerified) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="bg-amber-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-600">
        <Clock className="w-10 h-10" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-4">Verification Pending</h1>
      <p className="text-slate-600 mb-8">Your seller application is being reviewed. You will be able to add products once verified.</p>
      <Link 
        to="/"
        className="bg-slate-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors"
      >
        {t('common.return_to_home')}
      </Link>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <button 
        onClick={() => window.history.back()}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> {t('common.back') || 'Back'}
      </button>

      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t('common.seller_dashboard')}</h1>
          <p className="text-slate-500 mt-2">Welcome back, {userData?.displayName}. Manage your shop and earnings.</p>
        </div>
        <button 
          onClick={() => setShowAddProductModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add New Product
        </button>
      </div>

      {/* Financial Overview Section */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-xl font-bold text-slate-900">{t('seller.financial_overview') || 'Financial Overview'}</h2>
          <div className="h-px flex-1 bg-slate-200"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Available Balance - Primary Action Card */}
          <div className="bg-slate-900 p-6 rounded-2xl shadow-lg shadow-slate-900/20 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
              <Wallet className="w-24 h-24" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Wallet className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold bg-emerald-500 text-white px-2 py-1 rounded-full uppercase tracking-wider">{t('seller.ready_to_withdraw') || 'Ready to Withdraw'}</span>
              </div>
              <p className="text-sm text-slate-300 font-medium">{t('seller.available_balance')}</p>
              <h3 className="text-3xl font-bold mt-1">{stats.balance?.toLocaleString() || '0'} ETB</h3>
              <button 
                onClick={() => setShowPayoutModal(true)}
                disabled={stats.balance <= 0}
                className="mt-6 w-full py-3 bg-white text-slate-900 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Banknote className="w-4 h-4" /> {t('seller.request_payout')}
              </button>
            </div>
          </div>

          {/* Pending Payouts - Status Card */}
          <div className="bg-white p-6 rounded-2xl border-2 border-amber-100 shadow-sm relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                <Clock className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full uppercase tracking-wider animate-pulse">{t('orders.processing') || 'Processing'}</span>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t('seller.pending_payouts')}</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.pendingPayouts?.toLocaleString() || '0'} ETB</h3>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400 leading-relaxed">
                {t('seller.pending_desc') || 'These funds have been requested and are currently being verified by our finance team.'}
              </p>
            </div>
          </div>

          {/* Total Revenue - Performance Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <TrendingUp className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full uppercase tracking-wider">{t('seller.lifetime') || 'Lifetime'}</span>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t('seller.total_sales')}</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.totalSalesValue?.toLocaleString() || '0'} ETB</h3>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>

          {/* Total Paid - History Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase tracking-wider">{t('seller.received') || 'Received'}</span>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t('seller.total_paid')}</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.totalPaid?.toLocaleString() || '0'} ETB</h3>
            <p className="mt-4 text-xs text-slate-400 italic">{t('seller.paid_desc') || 'Total funds successfully transferred to you.'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Products & Activity */}
        <div className="lg:col-span-2 space-y-8">
          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                  <Package className="w-4 h-4" />
                </div>
                <p className="text-xs text-slate-500 font-medium">Active Products</p>
              </div>
              <p className="text-xl font-bold text-slate-900">{stats.totalProducts}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <p className="text-xs text-slate-500 font-medium">Items Sold</p>
              </div>
              <p className="text-xl font-bold text-slate-900">{stats.totalProductsSold}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                  <DollarSign className="w-4 h-4" />
                </div>
                <p className="text-xs text-slate-500 font-medium">Avg. Order Value</p>
              </div>
              <p className="text-xl font-bold text-slate-900">
                {Math.round(stats.averageOrderValue || 0).toLocaleString()} ETB
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-50 rounded-lg text-amber-500">
                  <Star className="w-4 h-4" />
                </div>
                <p className="text-xs text-slate-500 font-medium">Rating</p>
              </div>
              <p className="text-xl font-bold text-slate-900">
                {stats.customerRatings.toFixed(1)} <span className="text-sm font-normal text-slate-500">/ 5.0</span>
              </p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">My Products</h2>
              <Link to="/admin" className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1">
                Manage All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            {loading ? (
              <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
            ) : products.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-500">You haven't uploaded any products yet.</p>
                <Link to="/admin" className="mt-4 inline-block text-sm font-medium text-slate-900 underline">
                  Upload your first product
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Product</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Price</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map(product => (
                      <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <LazyImage 
                              src={product.imageUrl} 
                              alt={product.name} 
                              className="w-12 h-12 rounded-lg bg-slate-100"
                            />
                            <div>
                              <p className="font-medium text-slate-900 line-clamp-1">{product.name}</p>
                              <p className="text-xs text-slate-500">{product.category || 'General'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-slate-900">{product.price?.toLocaleString() || '0'} ETB</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                          <Link 
                            to={`/admin?edit=${product.id}`}
                            className="text-sm font-medium text-slate-600 hover:text-slate-900 underline"
                          >
                            Edit
                          </Link>
                          {product.status !== 'sold' && (
                            <button 
                              onClick={() => handleMarkAsSold(product.id)}
                              className="text-sm font-medium text-red-600 hover:text-red-900 underline"
                            >
                              Mark as Sold
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Orders Received */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">Orders Received</h2>
            </div>
            {loading ? (
              <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
            ) : orders.length === 0 ? (
              <div className="p-12 text-center text-slate-500">No orders received yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Product</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Buyer Phone</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Shipping Method</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.map(order => (
                      <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <LazyImage 
                              src={order.imageUrl} 
                              alt={order.productName} 
                              className="w-10 h-10 rounded-lg bg-slate-100"
                            />
                            <div>
                              <p className="text-sm font-medium text-slate-900 line-clamp-1">{order.productName}</p>
                              <p className="text-xs text-slate-500">Qty: {order.quantity}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-900">
                          {order.shippingDetails?.phone || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {order.shippingDetails?.region}, {order.shippingDetails?.city}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {order.shippingDetails?.shippingMethod || 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            order.status === 'Delivered' ? 'bg-emerald-50 text-emerald-700' : 
                            order.status === 'Shipped' ? 'bg-blue-50 text-blue-700' :
                            'bg-amber-50 text-amber-700'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => setSelectedOrder(order)}
                            className="text-sm font-medium text-slate-600 hover:text-slate-900 underline"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Payout Requests */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Payout History</h2>
            </div>
            {loading ? (
              <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
            ) : payoutRequests.length === 0 ? (
              <div className="p-12 text-center text-slate-500">No payout requests yet.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {payoutRequests.map(req => (
                  <li key={req.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{req.amount?.toLocaleString() || '0'} ETB</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {req.createdAt?.toDate().toLocaleDateString()} &middot; {req.paymentMethod}
                        </p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        req.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                        req.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Payment Info */}
        <div className="space-y-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">Payment Information</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Telebirr Number</p>
                  <p className="text-sm text-slate-500 mt-1">{userData?.telebirrNumber || 'Not set'}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Bank Account</p>
                  {userData?.bankInfo ? (
                    <div className="mt-1 text-sm text-slate-500">
                      <p>{userData.bankInfo.bankName}</p>
                      <p>{userData.bankInfo.accountNumber}</p>
                      <p className="text-xs italic">{userData.bankInfo.accountHolder}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 mt-1">Not set</p>
                  )}
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  To update your payment info, please contact support.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Request Payout</h3>
              <button onClick={() => setShowPayoutModal(false)} className="text-slate-400 hover:text-slate-600">
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleRequestPayout} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount to Withdraw (ETB)</label>
                <input 
                  required
                  type="number" 
                  min="1"
                  max={userData?.balance}
                  value={payoutAmount}
                  onChange={e => setPayoutAmount(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
                  placeholder={`Max: ${userData?.balance}`}
                />
                <p className="text-xs text-slate-500 mt-2">
                  Funds will be sent to your {userData?.telebirrNumber ? 'Telebirr' : 'Bank Account'}.
                </p>
              </div>
              <button 
                type="submit" 
                disabled={requestingPayout}
                className="w-full bg-slate-900 text-white py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {requestingPayout ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Request'}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Add Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <AddProductForm 
              onSuccess={() => {
                setShowAddProductModal(false);
                fetchSellerData();
              }}
              onCancel={() => setShowAddProductModal(false)}
            />
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Order Details</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600">
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-2">Product Information</h4>
                <div className="flex items-center gap-3">
                  <LazyImage src={selectedOrder.imageUrl} alt={selectedOrder.productName} className="w-12 h-12 rounded-lg bg-slate-100" />
                  <div>
                    <p className="font-medium text-slate-900">{selectedOrder.productName}</p>
                    <p className="text-sm text-slate-500">Qty: {selectedOrder.quantity} | Total: {selectedOrder.total?.toLocaleString() || '0'} ETB</p>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-2">Shipping Information</h4>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-sm text-slate-900 font-medium mb-1">Method: {selectedOrder.shippingDetails?.shippingMethod}</p>
                  <p className="text-sm text-slate-600">Region: {selectedOrder.shippingDetails?.region}</p>
                  <p className="text-sm text-slate-600">City: {selectedOrder.shippingDetails?.city}</p>
                  {selectedOrder.shippingDetails?.postalCode && (
                    <p className="text-sm text-slate-600">Postal Code: {selectedOrder.shippingDetails?.postalCode}</p>
                  )}
                  <p className="text-sm text-slate-600 mt-2">Phone: {selectedOrder.shippingDetails?.phone}</p>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-2">Status</h4>
                <p className="text-sm text-slate-900">
                  Payment: <span className={`font-medium ${selectedOrder.paymentStatus === 'Paid' ? 'text-emerald-600' : 'text-amber-600'}`}>{selectedOrder.paymentStatus}</span>
                </p>
                <p className="text-sm text-slate-900 mt-1">
                  Order: <span className="font-medium">{selectedOrder.status}</span>
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-2">Status History</h4>
                <div className="space-y-4">
                  {(selectedOrder.statusHistory || [{ status: selectedOrder.status, date: selectedOrder.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(), note: 'Order placed' }]).map((historyItem: any, idx: number, arr: any[]) => (
                    <div key={idx} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-2.5 h-2.5 rounded-full ${idx === arr.length - 1 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        {idx < arr.length - 1 && <div className="w-px h-full bg-slate-200 my-1 min-h-[16px]" />}
                      </div>
                      <div className="pb-2">
                        <p className="text-sm font-medium text-slate-900">{historyItem.status}</p>
                        <p className="text-xs text-slate-500">{new Date(historyItem.date).toLocaleString()}</p>
                        {historyItem.note && <p className="text-xs text-slate-600 mt-0.5">{historyItem.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-2">Estimated Delivery</h4>
                <p className="text-sm text-slate-900 font-medium">
                  {selectedOrder.estimatedDelivery?.toDate 
                    ? selectedOrder.estimatedDelivery.toDate().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                    : new Date(selectedOrder.estimatedDelivery).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100">
              <button 
                onClick={() => setSelectedOrder(null)}
                className="w-full bg-slate-900 text-white py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {alertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${alertModal.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              {alertModal.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              {alertModal.type === 'success' ? 'Success' : 'Error'}
            </h3>
            <p className="text-slate-500 mb-6">{alertModal.message}</p>
            <button 
              onClick={() => setAlertModal(null)}
              className="w-full px-4 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
