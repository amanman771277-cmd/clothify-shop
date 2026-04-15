import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, doc, updateDoc, deleteDoc, getDoc, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { LazyImage } from '../components/LazyImage';
import { 
  TrendingUp, 
  Users, 
  Package, 
  DollarSign, 
  Search, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowUpRight,
  LayoutDashboard,
  ShoppingBag,
  UserCheck,
  CreditCard,
  AlertTriangle,
  ChevronRight,
  Filter,
  Loader2,
  CheckCircle,
  ArrowLeft,
  Bell,
  Send
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { format } from 'date-fns';

interface Stats {
  totalRevenue: number;
  adminCommission: number;
  totalSellers: number;
  activeOrders: number;
}

interface OrderLog {
  id: string;
  buyerName: string;
  sellerName: string;
  productName: string;
  price: number;
  commission: number;
  date: any;
  status: string;
}

interface PayoutRequest {
  id: string;
  sellerId: string;
  sellerName: string;
  amount: number;
  status: string;
  paymentMethod: string;
  paymentDetails: any;
  createdAt: any;
}

interface Product {
  id: string;
  name: string;
  price: number;
  sellerName: string;
  imageUrl: string;
  category: string;
}

interface SellerApplication {
  id: string;
  userId: string;
  userEmail: string;
  fullName: string;
  phoneNumber: string;
  idFrontUrl: string;
  idBackUrl: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: any;
}

export const SuperAdmin: React.FC = () => {
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'sales' | 'payouts' | 'products' | 'users' | 'verifications' | 'notifications'>('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0,
    adminCommission: 0,
    totalSellers: 0,
    activeOrders: 0
  });
  const [salesData, setSalesData] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderLog[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [sellerApplications, setSellerApplications] = useState<SellerApplication[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Notification Center State
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [sendingNotification, setSendingNotification] = useState(false);

  // Custom Modal States
  const [confirmModal, setConfirmModal] = useState<{ message: string, onConfirm: () => void } | null>(null);
  const [promptModal, setPromptModal] = useState<{ message: string, onConfirm: (value: string) => void } | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [alertModal, setAlertModal] = useState<string | null>(null);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchDashboardData();
    }
  }, [isSuperAdmin]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Orders for Stats and Logs
      const ordersSnap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
      const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      let revenue = 0;
      let commission = 0;
      let active = 0;
      const dailyMap: { [key: string]: number } = {};
      const logs: OrderLog[] = [];

      orders.forEach(order => {
        if (order.paymentStatus === 'Paid') {
          revenue += order.total;
          commission += order.total * 0.05;
          
          const dateStr = format(order.createdAt?.toDate() || new Date(), 'MMM dd');
          dailyMap[dateStr] = (dailyMap[dateStr] || 0) + order.total;
        }
        
        if (order.status !== 'Delivered') {
          active++;
        }

        // Map items to logs (assuming one log per order for simplicity, or we could map each item)
        if (order.items && order.items.length > 0) {
          order.items.forEach((item: any) => {
            logs.push({
              id: `${order.id}-${item.id}`,
              buyerName: order.shippingAddress.split(',')[0] || 'Customer', // Simple fallback
              sellerName: item.sellerName || 'Unknown Seller',
              productName: item.name,
              price: item.price * item.quantity,
              commission: (item.price * item.quantity) * 0.05,
              date: order.createdAt,
              status: order.paymentStatus
            });
          });
        }
      });

      // Format chart data
      const chartData = Object.keys(dailyMap).map(date => ({
        date,
        amount: dailyMap[date]
      })).reverse().slice(-7); // Last 7 days

      setSalesData(chartData);
      setRecentOrders(logs.slice(0, 10));

      // 2. Fetch Sellers and Calculate their sales
      const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'seller')));
      const sellerCount = usersSnap.size;
      
      const sellersList = usersSnap.docs.map(doc => {
        const data = doc.data();
        let sellerTotalSales = 0;
        
        // Calculate total sales for this seller from paid orders
        orders.forEach(order => {
          if (order.paymentStatus === 'Paid' && order.items) {
            order.items.forEach((item: any) => {
              if (item.sellerId === data.uid) {
                sellerTotalSales += (item.price * item.quantity);
              }
            });
          }
        });

        return {
          id: doc.id,
          ...data,
          totalSales: sellerTotalSales
        };
      });

      setSellers(sellersList);

      // 3. Fetch Payout Requests
      const payoutSnap = await getDocs(query(collection(db, 'payoutRequests'), orderBy('createdAt', 'desc')));
      setPayoutRequests(payoutSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));

      // 4. Fetch Products
      const productsSnap = await getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc')));
      setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));

      // 5. Fetch Seller Applications
      const applicationsSnap = await getDocs(query(collection(db, 'sellerApplications'), orderBy('createdAt', 'desc')));
      setSellerApplications(applicationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));

      // 6. Fetch All Users for Notifications
      const allUsersSnap = await getDocs(collection(db, 'users'));
      setAllUsers(allUsersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));

      setStats({
        totalRevenue: revenue,
        adminCommission: commission,
        totalSellers: sellerCount,
        activeOrders: active
      });

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePayout = async (request: PayoutRequest) => {
    setConfirmModal({
      message: `Confirm payment of ${request.amount} ETB to ${request.sellerName}?`,
      onConfirm: async () => {
        try {
          // 1. Update request status
          await updateDoc(doc(db, 'payoutRequests', request.id), {
            status: 'Paid',
            processedAt: new Date()
          });

          // 2. Deduct from seller balance
          const sellerRef = doc(db, 'users', request.sellerId);
          const sellerSnap = await getDoc(sellerRef);
          if (sellerSnap.exists()) {
            const currentBalance = sellerSnap.data().balance || 0;
            await updateDoc(sellerRef, {
              balance: currentBalance - request.amount
            });
          }

          setAlertModal("Payout marked as Paid successfully!");
          fetchDashboardData();
        } catch (error) {
          console.error("Error processing payout:", error);
          setAlertModal("Failed to process payout.");
        }
      }
    });
  };

  const handleDeleteProduct = async (productId: string) => {
    setConfirmModal({
      message: "Are you sure you want to delete this product? This action cannot be undone.",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'products', productId));
          setAlertModal("Product deleted successfully.");
          fetchDashboardData();
        } catch (error) {
          console.error("Error deleting product:", error);
          setAlertModal("Failed to delete product.");
        }
      }
    });
  };

  const handleApproveApplication = async (app: SellerApplication) => {
    setConfirmModal({
      message: `Approve ${app.fullName} as a seller?`,
      onConfirm: async () => {
        try {
          // 1. Update application status
          await updateDoc(doc(db, 'sellerApplications', app.id), {
            status: 'Approved',
            processedAt: new Date()
          });

          // 2. Update user role to seller
          await updateDoc(doc(db, 'users', app.userId), {
            role: 'seller',
            sellerVerified: true,
            sellerInfo: {
              fullName: app.fullName,
              phoneNumber: app.phoneNumber,
              verifiedAt: new Date()
            }
          });

          setAlertModal("Seller approved successfully!");
          fetchDashboardData();
        } catch (error) {
          console.error("Error approving seller:", error);
          setAlertModal("Failed to approve seller.");
        }
      }
    });
  };

  const handleRejectApplication = async (app: SellerApplication) => {
    setPromptValue('');
    setPromptModal({
      message: "Reason for rejection:",
      onConfirm: async (reason: string) => {
        try {
          await updateDoc(doc(db, 'sellerApplications', app.id), {
            status: 'Rejected',
            rejectionReason: reason,
            processedAt: new Date()
          });

          setAlertModal("Application rejected.");
          fetchDashboardData();
        } catch (error) {
          console.error("Error rejecting application:", error);
          setAlertModal("Failed to reject application.");
        }
      }
    });
  };

  const handleSendNotification = async () => {
    if (!notificationMessage.trim() || selectedUsers.length === 0) {
      setAlertModal("Please select at least one user and enter a message.");
      return;
    }
    setSendingNotification(true);
    try {
      const promises = selectedUsers.map(userId => 
        addDoc(collection(db, 'notifications'), {
          userId,
          message: notificationMessage.trim(),
          read: false,
          createdAt: serverTimestamp(),
          type: 'admin_broadcast'
        })
      );
      await Promise.all(promises);
      setAlertModal("Notification sent successfully!");
      setNotificationMessage('');
      setSelectedUsers([]);
    } catch (error) {
      console.error("Error sending notification:", error);
      setAlertModal("Failed to send notification.");
    } finally {
      setSendingNotification(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAllUsers = () => {
    if (selectedUsers.length === allUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(allUsers.map(u => u.id));
    }
  };

  if (authLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>;
  if (!isSuperAdmin) return <Navigate to="/" />;

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-emerald-500/30">
      {/* Sidebar Overlay for Mobile */}
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 border-r border-slate-800 bg-[#0f172a]/50 backdrop-blur-xl">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <ShoppingBag className="text-white w-6 h-6" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Clothify Admin</span>
            </div>

            <nav className="space-y-2">
              <NavItem 
                icon={<LayoutDashboard size={20} />} 
                label="Overview" 
                active={activeTab === 'overview'} 
                onClick={() => setActiveTab('overview')} 
              />
              <NavItem 
                icon={<TrendingUp size={20} />} 
                label="Sales Logs" 
                active={activeTab === 'sales'} 
                onClick={() => setActiveTab('sales')} 
              />
              <NavItem 
                icon={<CreditCard size={20} />} 
                label="Payouts" 
                active={activeTab === 'payouts'} 
                onClick={() => setActiveTab('payouts')} 
              />
              <NavItem 
                icon={<Package size={20} />} 
                label="Products" 
                active={activeTab === 'products'} 
                onClick={() => setActiveTab('products')} 
              />
              <NavItem 
                icon={<Users size={20} />} 
                label="Sellers" 
                active={activeTab === 'users'} 
                onClick={() => setActiveTab('users')} 
              />
              <NavItem 
                icon={<UserCheck size={20} />} 
                label="Verifications" 
                active={activeTab === 'verifications'} 
                onClick={() => setActiveTab('verifications')} 
                badge={sellerApplications.filter(app => app.status === 'Pending').length > 0 ? sellerApplications.filter(app => app.status === 'Pending').length : undefined}
              />
              <NavItem 
                icon={<Bell size={20} />} 
                label="Notifications" 
                active={activeTab === 'notifications'} 
                onClick={() => setActiveTab('notifications')} 
              />
            </nav>
          </div>

          <div className="mt-auto p-6 border-t border-slate-800">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold">AY</div>
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">Amanuel Yohannes</p>
                <p className="text-xs text-slate-500 truncate">Super Admin</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <button 
                onClick={() => window.history.back()}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <h1 className="text-3xl font-bold text-white">Dashboard</h1>
              <p className="text-slate-400 mt-1">Welcome back, here's what's happening today.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Search..." 
                  className="bg-slate-800/50 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all w-full md:w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button onClick={fetchDashboardData} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
                <Clock className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </header>

          {/* Mobile Navigation */}
          <div className="lg:hidden mb-6 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            <div className="flex gap-2 w-max">
              <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'overview' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'}`}>Overview</button>
              <button onClick={() => setActiveTab('sales')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'sales' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'}`}>Sales Logs</button>
              <button onClick={() => setActiveTab('payouts')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'payouts' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'}`}>Payouts</button>
              <button onClick={() => setActiveTab('products')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'products' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'}`}>Products</button>
              <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'}`}>Sellers</button>
              <button onClick={() => setActiveTab('verifications')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'verifications' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'}`}>
                Verifications
                {sellerApplications.filter(app => app.status === 'Pending').length > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {sellerApplications.filter(app => app.status === 'Pending').length}
                  </span>
                )}
              </button>
              <button onClick={() => setActiveTab('notifications')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'notifications' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'}`}>Notifications</button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <StatCard 
              title="Total Revenue" 
              value={`${stats.totalRevenue?.toLocaleString() || '0'} ETB`} 
              icon={<DollarSign className="text-emerald-500 w-5 h-5 sm:w-6 sm:h-6" />} 
              trend="+12.5%" 
              color="emerald"
            />
            <StatCard 
              title="Admin Profit (5%)" 
              value={`${stats.adminCommission?.toLocaleString() || '0'} ETB`} 
              icon={<TrendingUp className="text-blue-500 w-5 h-5 sm:w-6 sm:h-6" />} 
              trend="+8.2%" 
              color="blue"
            />
            <StatCard 
              title="Total Sellers" 
              value={stats.totalSellers.toString()} 
              icon={<UserCheck className="text-purple-500 w-5 h-5 sm:w-6 sm:h-6" />} 
              trend="+3" 
              color="purple"
            />
            <StatCard 
              title="Active Orders" 
              value={stats.activeOrders.toString()} 
              icon={<Package className="text-orange-500 w-5 h-5 sm:w-6 sm:h-6" />} 
              trend="-2" 
              color="orange"
            />
          </div>

          {/* Content Area */}
          <div className="space-y-8">
            {activeTab === 'overview' && (
              <>
                {/* Chart Section */}
                <div className="bg-slate-800/30 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">Revenue Overview</h2>
                    <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs outline-none">
                      <option>Last 7 Days</option>
                      <option>Last 30 Days</option>
                    </select>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={salesData}>
                        <defs>
                          <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val/1000}k`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                          itemStyle={{ color: '#10b981' }}
                        />
                        <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorAmt)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Recent Activity Table */}
                <div className="bg-slate-800/30 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-sm">
                  <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold">Recent Sales Activity</h2>
                    <button onClick={() => setActiveTab('sales')} className="text-emerald-500 text-sm font-medium hover:underline flex items-center gap-1">
                      View All <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4 font-semibold">Buyer</th>
                          <th className="px-6 py-4 font-semibold">Seller</th>
                          <th className="px-6 py-4 font-semibold">Product</th>
                          <th className="px-6 py-4 font-semibold">Price</th>
                          <th className="px-6 py-4 font-semibold">Comm. (5%)</th>
                          <th className="px-6 py-4 font-semibold">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {recentOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4 text-sm font-medium">{order.buyerName}</td>
                            <td className="px-6 py-4 text-sm text-slate-400">{order.sellerName}</td>
                            <td className="px-6 py-4 text-sm text-slate-400">{order.productName}</td>
                            <td className="px-6 py-4 text-sm font-semibold text-white">{order.price?.toLocaleString() || '0'} ETB</td>
                            <td className="px-6 py-4 text-sm text-emerald-500 font-medium">{order.commission?.toLocaleString() || '0'} ETB</td>
                            <td className="px-6 py-4 text-sm text-slate-500">
                              {order.date?.toDate() ? format(order.date.toDate(), 'MMM dd, HH:mm') : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'sales' && (
              <div className="bg-slate-800/30 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-sm">
                <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Full Sales Activity Logs</h2>
                  <div className="flex gap-2">
                    <button className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                      <Filter size={18} />
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Buyer</th>
                        <th className="px-6 py-4 font-semibold">Seller</th>
                        <th className="px-6 py-4 font-semibold">Product</th>
                        <th className="px-6 py-4 font-semibold">Price</th>
                        <th className="px-6 py-4 font-semibold">Commission</th>
                        <th className="px-6 py-4 font-semibold">Date</th>
                        <th className="px-6 py-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {recentOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium">{order.buyerName}</td>
                          <td className="px-6 py-4 text-sm text-slate-400">{order.sellerName}</td>
                          <td className="px-6 py-4 text-sm text-slate-400">{order.productName}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-white">{order.price?.toLocaleString() || '0'} ETB</td>
                          <td className="px-6 py-4 text-sm text-emerald-500 font-medium">{order.commission?.toLocaleString() || '0'} ETB</td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {order.date?.toDate() ? format(order.date.toDate(), 'MMM dd, HH:mm') : 'N/A'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${order.status === 'Paid' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-orange-500/20 text-orange-500'}`}>
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'payouts' && (
              <div className="bg-slate-800/30 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-sm">
                <div className="p-6 border-b border-slate-800">
                  <h2 className="text-xl font-bold">Withdrawal Requests</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Seller Name</th>
                        <th className="px-6 py-4 font-semibold">Amount</th>
                        <th className="px-6 py-4 font-semibold">Payment Method</th>
                        <th className="px-6 py-4 font-semibold">Details</th>
                        <th className="px-6 py-4 font-semibold">Status</th>
                        <th className="px-6 py-4 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {payoutRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium">{req.sellerName}</td>
                          <td className="px-6 py-4 text-sm font-bold text-white">{req.amount?.toLocaleString() || '0'} ETB</td>
                          <td className="px-6 py-4 text-sm text-slate-400">{req.paymentMethod}</td>
                          <td className="px-6 py-4 text-sm text-slate-400">
                            {req.paymentMethod === 'Telebirr' ? req.paymentDetails?.telebirrNumber : req.paymentDetails?.accountNumber}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                              req.status === 'Paid' ? 'bg-emerald-500/20 text-emerald-500' : 
                              req.status === 'Pending' ? 'bg-orange-500/20 text-orange-500' : 
                              'bg-red-500/20 text-red-500'
                            }`}>
                              {req.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {req.status === 'Pending' && (
                              <button 
                                onClick={() => handleApprovePayout(req)}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg shadow-emerald-600/20"
                              >
                                <CheckCircle2 size={14} /> Confirm Payment
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'products' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map((product) => (
                  <div key={product.id} className="bg-slate-800/30 border border-slate-800 rounded-2xl overflow-hidden group hover:border-emerald-500/50 transition-all">
                    <div className="aspect-square relative">
                      <LazyImage src={product.imageUrl} alt={product.name} className="w-full h-full" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                        <button 
                          onClick={() => handleDeleteProduct(product.id)}
                          className="p-3 bg-red-500 rounded-full text-white hover:scale-110 transition-transform"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="text-xs text-emerald-500 font-bold uppercase tracking-wider mb-1">{product.category}</p>
                      <h3 className="font-bold text-white truncate">{product.name}</h3>
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-sm text-slate-400">By {product.sellerName}</p>
                        <p className="font-bold text-emerald-500">{product.price?.toLocaleString() || '0'} ETB</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'users' && (
              <div className="bg-slate-800/30 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-sm">
                <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Registered Sellers</h2>
                  <div className="bg-slate-900/50 px-3 py-1 rounded-full border border-slate-700">
                    <span className="text-xs text-slate-400">Total: {sellers.length}</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Seller</th>
                        <th className="px-6 py-4 font-semibold">Contact</th>
                        <th className="px-6 py-4 font-semibold">Total Sales</th>
                        <th className="px-6 py-4 font-semibold">Balance</th>
                        <th className="px-6 py-4 font-semibold">Joined</th>
                        <th className="px-6 py-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {sellers.filter(s => 
                        s.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        s.email?.toLowerCase().includes(searchTerm.toLowerCase())
                      ).map((seller) => (
                        <tr key={seller.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {seller.photoURL ? (
                                <LazyImage src={seller.photoURL} alt="" className="w-8 h-8 rounded-full" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
                                  {seller.displayName?.charAt(0) || seller.email?.charAt(0)}
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-medium text-white">{seller.displayName || 'Unnamed Seller'}</p>
                                <p className="text-xs text-slate-500">{seller.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-400">
                            {seller.sellerInfo?.phoneNumber || 'N/A'}
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-emerald-500">{(seller.totalSales || 0)?.toLocaleString() || '0'} ETB</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-white">
                            {(seller.balance || 0)?.toLocaleString() || '0'} ETB
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {seller.createdAt?.toDate() ? format(seller.createdAt.toDate(), 'MMM dd, yyyy') : 'N/A'}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-500">
                              Verified
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'verifications' && (
              <div className="bg-slate-800/30 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-sm">
                <div className="p-6 border-b border-slate-800">
                  <h2 className="text-xl font-bold">Seller Verification Applications</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-900/50 text-slate-500 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Applicant</th>
                        <th className="px-6 py-4 font-semibold">Phone</th>
                        <th className="px-6 py-4 font-semibold">ID Front</th>
                        <th className="px-6 py-4 font-semibold">ID Back</th>
                        <th className="px-6 py-4 font-semibold">Status</th>
                        <th className="px-6 py-4 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {sellerApplications.map((app) => (
                        <tr key={app.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-white">{app.fullName}</p>
                            <p className="text-xs text-slate-500">{app.userEmail}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-400">{app.phoneNumber}</td>
                          <td className="px-6 py-4">
                            <a href={app.idFrontUrl} target="_blank" rel="noreferrer" className="block w-16 h-10 rounded overflow-hidden border border-slate-700">
                              <LazyImage src={app.idFrontUrl} alt="ID Front" className="w-full h-full" />
                            </a>
                          </td>
                          <td className="px-6 py-4">
                            <a href={app.idBackUrl} target="_blank" rel="noreferrer" className="block w-16 h-10 rounded overflow-hidden border border-slate-700">
                              <LazyImage src={app.idBackUrl} alt="ID Back" className="w-full h-full" />
                            </a>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                              app.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-500' : 
                              app.status === 'Pending' ? 'bg-orange-500/20 text-orange-500' : 
                              'bg-red-500/20 text-red-500'
                            }`}>
                              {app.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {app.status === 'Pending' && (
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleApproveApplication(app)}
                                  className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all"
                                  title="Approve"
                                >
                                  <CheckCircle2 size={16} />
                                </button>
                                <button 
                                  onClick={() => handleRejectApplication(app)}
                                  className="p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all"
                                  title="Reject"
                                >
                                  <XCircle size={16} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div className="bg-[#1e293b] border border-slate-800 rounded-2xl p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-white mb-4">Notification Center</h2>
                  
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-400 mb-2">Message</label>
                    <textarea 
                      value={notificationMessage}
                      onChange={(e) => setNotificationMessage(e.target.value)}
                      placeholder="Type your notification message here..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[120px] resize-y"
                    />
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Select Users</h3>
                    <button 
                      onClick={handleSelectAllUsers}
                      className="text-sm text-emerald-500 hover:text-emerald-400 font-medium"
                    >
                      {selectedUsers.length === allUsers.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="bg-slate-900 rounded-xl border border-slate-800 max-h-96 overflow-y-auto mb-6">
                    {allUsers.map(user => (
                      <label key={user.id} className="flex items-center gap-3 p-4 border-b border-slate-800 last:border-0 hover:bg-slate-800/50 cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                        />
                        <div className="flex-1">
                          <p className="text-white font-medium">{user.displayName || 'Unknown User'}</p>
                          <p className="text-sm text-slate-400">{user.email}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          user.role === 'admin' ? 'bg-emerald-500/10 text-emerald-500' :
                          user.role === 'seller' ? 'bg-blue-500/10 text-blue-500' :
                          'bg-slate-500/10 text-slate-400'
                        }`}>
                          {user.role || 'buyer'}
                        </span>
                      </label>
                    ))}
                    {allUsers.length === 0 && (
                      <div className="p-8 text-center text-slate-500">No users found.</div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button 
                      onClick={handleSendNotification}
                      disabled={sendingNotification || !notificationMessage.trim() || selectedUsers.length === 0}
                      className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sendingNotification ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      Send Notification ({selectedUsers.length})
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">Confirm Action</h3>
            <p className="text-slate-400 mb-6">{confirmModal.message}</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl text-slate-300 hover:bg-slate-800 font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {promptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">Input Required</h3>
            <p className="text-slate-400 mb-4">{promptModal.message}</p>
            <input 
              type="text" 
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white mb-6 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setPromptModal(null)}
                className="px-4 py-2 rounded-xl text-slate-300 hover:bg-slate-800 font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (promptValue.trim()) {
                    promptModal.onConfirm(promptValue);
                    setPromptModal(null);
                  }
                }}
                disabled={!promptValue.trim()}
                className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {alertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Notification</h3>
            <p className="text-slate-400 mb-6">{alertModal}</p>
            <button 
              onClick={() => setAlertModal(null)}
              className="w-full px-4 py-3 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const NavItem: React.FC<{ icon: React.ReactNode; label: string; active: boolean; onClick: () => void; badge?: number }> = ({ icon, label, active, onClick, badge }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      active 
        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`}
  >
    {icon}
    <span className="font-medium">{label}</span>
    {badge && (
      <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
        {badge}
      </span>
    )}
  </button>
);

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; trend: string; color: string }> = ({ title, value, icon, trend, color }) => {
  const colorClasses: any = {
    emerald: 'border-emerald-500/20 hover:border-emerald-500/50',
    blue: 'border-blue-500/20 hover:border-blue-500/50',
    purple: 'border-purple-500/20 hover:border-purple-500/50',
    orange: 'border-orange-500/20 hover:border-orange-500/50',
  };

  return (
    <div className={`bg-slate-800/30 border p-4 sm:p-6 rounded-2xl sm:rounded-3xl backdrop-blur-sm transition-all duration-300 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="p-2 sm:p-3 bg-slate-900/50 rounded-xl sm:rounded-2xl">
          {icon}
        </div>
        <span className={`text-[10px] sm:text-xs font-bold px-2 py-1 rounded-lg ${trend.startsWith('+') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
          {trend}
        </span>
      </div>
      <p className="text-slate-500 text-xs sm:text-sm font-medium">{title}</p>
      <h3 className="text-lg sm:text-2xl font-bold text-white mt-1">{value}</h3>
    </div>
  );
};
