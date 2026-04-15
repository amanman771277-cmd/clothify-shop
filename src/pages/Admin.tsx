import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, query, orderBy, updateDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useSearchParams } from 'react-router-dom';
import Papa from 'papaparse';
import { AddProductForm } from '../components/AddProductForm';
import { LazyImage } from '../components/LazyImage';
import { Trash2, Plus, Image as ImageIcon, Loader2, Edit2, X, Package, Tag, Users, ShieldAlert, ShieldCheck, Clock, Truck, CheckCircle2, ChevronDown, AlertCircle, Banknote, ArrowLeft } from 'lucide-react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
};

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: string;
  imageUrl: string;
  imageUrls?: string[];
  sizes?: string[];
  colors?: string[];
  createdBy?: string;
}

interface Order {
  id: string;
  buyerId: string;
  sellerId: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  imageUrl: string;
  size?: string;
  color?: string;
  shippingDetails: {
    region: string;
    city: string;
    postalCode?: string;
    phone: string;
    shippingMethod: string;
    shippingCost: number;
  };
  total: number;
  status: 'Processing' | 'Shipped' | 'Delivered';
  paymentMethod?: string;
  paymentStatus?: string;
  tx_ref?: string;
  estimatedDelivery: any;
  createdAt: any;
}

interface UserData {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: string;
  createdAt: any;
}

const CATEGORIES = ['T-Shirts', 'Outerwear', 'Pants', 'Accessories'];

export const Admin: React.FC = () => {
  const { user, userData, isAdmin, isSuperAdmin, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'users' | 'payouts'>('products');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [sellerApplications, setSellerApplications] = useState<any[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [error, setError] = useState<FirestoreErrorInfo | null>(null);

  const [csvFile, setCsvFile] = useState<File | null>(null);

  const handleBulkUpload = async () => {
    if (!csvFile) return;
    setSubmitting(true);
    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const batch = writeBatch(db);
        let count = 0;
        results.data.forEach((row: any) => {
          if (!row.name || !row.price || !row.imageUrl) return; // Skip invalid rows
          
          const productRef = doc(collection(db, 'products'));
          const productData: any = {
            name: row.name,
            description: row.description || 'No description provided.',
            price: Number(row.price),
            category: row.category || CATEGORIES[0],
            imageUrl: row.imageUrl,
            isAvailable: true,
            status: 'active',
            createdAt: serverTimestamp(),
            sellerId: user?.uid || 'admin',
            sellerName: userData?.displayName || user?.displayName || 'Unknown Seller'
          };

          if (row.originalPrice) productData.originalPrice = Number(row.originalPrice);
          if (row.imageUrls) productData.imageUrls = row.imageUrls.split('|').map((u: string) => u.trim()).filter(Boolean);
          if (row.sizes) productData.sizes = row.sizes.split('|').map((s: string) => s.trim()).filter(Boolean);
          if (row.colors) productData.colors = row.colors.split('|').map((c: string) => c.trim()).filter(Boolean);

          batch.set(productRef, productData);
          count++;
        });
        try {
          if (count > 0) {
            await batch.commit();
            alert(`Successfully uploaded ${count} products.`);
            fetchProducts();
          } else {
            alert("No valid products found in CSV. Make sure name, price, and imageUrl are present.");
          }
        } catch (error) {
          console.error("Error uploading products:", error);
          alert("Failed to upload products.");
        } finally {
          setSubmitting(false);
          setCsvFile(null);
        }
      }
    });
  };

  useEffect(() => {
    if (isAdmin) {
      if (activeTab === 'products') {
        fetchProducts();
      } else if (activeTab === 'orders' && isSuperAdmin) {
        fetchOrders();
      } else if (activeTab === 'users' && isSuperAdmin) {
        fetchUsers();
      } else if (activeTab === 'payouts' && isSuperAdmin) {
        fetchPayoutRequests();
      }
      if (isSuperAdmin) {
        fetchAdminStats();
      }
    }
  }, [isAdmin, isSuperAdmin, activeTab]);

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && products.length > 0) {
      const productToEdit = products.find(p => p.id === editId);
      if (productToEdit && editingId !== editId) {
        setActiveTab('products');
        handleEdit(productToEdit);
      }
    }
  }, [searchParams, products]);

  const fetchAdminStats = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'adminStats', 'global'));
      if (docSnap.exists()) {
        setAdminStats(docSnap.data());
      }
    } catch (error) {
      console.error("Error fetching admin stats:", error);
    }
  };

  const fetchPayoutRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'payoutRequests'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setPayoutRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      setError(handleFirestoreError(error, OperationType.LIST, 'payoutRequests'));
    } finally {
      setLoading(false);
    }
  };

  const processPayout = async (requestId: string, status: 'Paid' | 'Rejected') => {
    setError(null);
    try {
      const requestRef = doc(db, 'payoutRequests', requestId);
      const requestSnap = await getDoc(requestRef);
      
      if (!requestSnap.exists()) return;
      const requestData = requestSnap.data();
      
      if (status === 'Paid') {
        // Deduct from seller's balance
        const sellerRef = doc(db, 'users', requestData.sellerId);
        const sellerSnap = await getDoc(sellerRef);
        if (sellerSnap.exists()) {
          const currentBalance = sellerSnap.data().balance || 0;
          await updateDoc(sellerRef, { balance: currentBalance - requestData.amount });
        }
      }
      
      await updateDoc(requestRef, { 
        status, 
        processedAt: serverTimestamp() 
      });
      
      fetchPayoutRequests();
    } catch (error) {
      setError(handleFirestoreError(error, OperationType.UPDATE, `payoutRequests/${requestId}`));
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
    } catch (error) {
      setError(handleFirestoreError(error, OperationType.LIST, 'products'));
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[]);
    } catch (error) {
      setError(handleFirestoreError(error, OperationType.LIST, 'orders'));
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as UserData[]);

      const appsQ = query(collection(db, 'sellerApplications'));
      const appsSnapshot = await getDocs(appsQ);
      setSellerApplications(appsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      setError(handleFirestoreError(error, OperationType.LIST, 'users'));
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: 'Processing' | 'Shipped' | 'Delivered') => {
    setError(null);
    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) return;
      const orderData = orderSnap.data();
      const newHistory = [...(orderData.statusHistory || []), {
        status: newStatus,
        date: new Date().toISOString(),
        note: `Order marked as ${newStatus}`
      }];
      await updateDoc(orderRef, { status: newStatus, statusHistory: newHistory });
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus, statusHistory: newHistory } : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus, statusHistory: newHistory });
      }
    } catch (error) {
      setError(handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`));
    }
  };

  const handleApproveApplication = async (appId: string, userId: string) => {
    setError(null);
    try {
      const app = sellerApplications.find(a => a.id === appId);
      await updateDoc(doc(db, 'sellerApplications', appId), {
        status: 'Approved',
        processedAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'users', userId), {
        role: 'seller',
        sellerVerified: true,
        sellerInfo: {
          fullName: app?.fullName || '',
          phoneNumber: app?.phoneNumber || '',
          verifiedAt: serverTimestamp()
        }
      });
      fetchUsers();
    } catch (error) {
      setError(handleFirestoreError(error, OperationType.UPDATE, `sellerApplications/${appId}`));
    }
  };

  const handleRejectApplication = async (appId: string) => {
    setError(null);
    try {
      await updateDoc(doc(db, 'sellerApplications', appId), {
        status: 'Rejected',
        processedAt: serverTimestamp()
      });
      fetchUsers();
    } catch (error) {
      setError(handleFirestoreError(error, OperationType.UPDATE, `sellerApplications/${appId}`));
    }
  };

  const toggleUserRole = async (userId: string, currentRole: string) => {
    setError(null);
    try {
      let newRole = 'user';
      if (currentRole === 'user') newRole = 'seller';
      else if (currentRole === 'seller') newRole = 'admin';
      else if (currentRole === 'admin') newRole = 'user';

      const updateData: any = { role: newRole };
      if (newRole === 'seller' && !users.find(u => u.id === userId)?.balance) {
        updateData.balance = 0;
      }

      await updateDoc(doc(db, 'users', userId), updateData);
      setUsers(users.map(u => u.id === userId ? { ...u, ...updateData } : u));
    } catch (error) {
      setError(handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`));
    }
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    if (searchParams.has('edit')) {
      searchParams.delete('edit');
      setSearchParams(searchParams);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    setError(null);
    try {
      await deleteDoc(doc(db, 'products', product.id));
      setProducts(products.filter(p => p.id !== product.id));
      if (editingId === product.id) cancelEdit();
    } catch (error) {
      setError(handleFirestoreError(error, OperationType.DELETE, `products/${product.id}`));
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-900" /></div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <button 
        onClick={() => window.history.back()}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold">Security Error</h3>
            <p className="text-sm opacity-90">{error.error}</p>
            <div className="mt-2 p-2 bg-red-100 rounded text-xs font-mono overflow-auto max-h-32">
              {JSON.stringify(error, null, 2)}
            </div>
          </div>
        </div>
      )}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500 mt-2">Manage your store products and orders.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'products' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <Tag className="w-4 h-4" /> Products
          </button>
          {isSuperAdmin && (
            <>
              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <Users className="w-4 h-4" /> Users
              </button>
              <button
                onClick={() => setActiveTab('payouts')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'payouts' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <Banknote className="w-4 h-4" /> Payouts
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'orders' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <Package className="w-4 h-4" /> Orders
              </button>
            </>
          )}
        </div>
      </div>

      {isSuperAdmin && adminStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500 font-medium">Total Platform Sales</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{adminStats.totalSales?.toLocaleString() || '0'} ETB</h3>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500">
            <p className="text-sm text-slate-500 font-medium">Total Admin Profit (5%)</p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-1">{adminStats.totalProfit?.toLocaleString() || '0'} ETB</h3>
          </div>
        </div>
      )}

      {activeTab === 'products' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Add/Edit Product Form */}
          <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-24">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                {editingId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />} 
                {editingId ? 'Edit Product' : 'Add New Product'}
              </h2>
              {editingId && (
                <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            
            <AddProductForm 
              editingProduct={editingId ? products.find(p => p.id === editingId) : null}
              onSuccess={() => {
                cancelEdit();
                fetchProducts();
              }}
              onCancel={cancelEdit}
            />

            <div className="mt-8 pt-8 border-t border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Bulk Upload (CSV)</h3>
              <input 
                type="file" 
                accept=".csv"
                onChange={e => setCsvFile(e.target.files?.[0] || null)}
                className="w-full mb-4"
              />
              <button 
                onClick={handleBulkUpload}
                disabled={!csvFile || submitting}
                className="w-full bg-slate-900 text-white px-4 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Upload CSV'}
              </button>
            </div>
          </div>
        </div>

        {/* Product List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">All Products</h2>
            </div>
            
            {loading ? (
              <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
            ) : products.length === 0 ? (
              <div className="p-12 text-center text-slate-500">No products found. Add one to get started.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {products.map(product => (
                  <li key={product.id} className={`p-4 sm:p-6 flex items-center gap-4 hover:bg-slate-50 transition-colors ${editingId === product.id ? 'bg-slate-50 ring-1 ring-inset ring-slate-200' : ''}`}>
                    <LazyImage src={product.imageUrl} alt={product.name} className="w-16 h-16 rounded-lg bg-slate-100" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-slate-900 truncate">{product.name}</h3>
                      <p className="text-sm text-slate-500 mt-1">
                        {product.originalPrice && (product.price === undefined || product.originalPrice > product.price) && (
                          <span className="line-through text-slate-400 mr-2">{product.originalPrice?.toLocaleString() || '0'} ETB</span>
                        )}
                        <span className={product.originalPrice && product.price !== undefined && product.originalPrice > product.price ? 'text-red-500 font-medium' : ''}>
                          {product.price?.toLocaleString() || '0'} ETB
                        </span> &middot; {product.category || 'Uncategorized'}
                      </p>
                      {(product.sizes?.length || product.colors?.length) && (
                        <p className="text-xs text-slate-400 mt-1">
                          {product.sizes?.length ? `Sizes: ${product.sizes.join(', ')}` : ''}
                          {product.sizes?.length && product.colors?.length ? ' | ' : ''}
                          {product.colors?.length ? `Colors: ${product.colors.join(', ')}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {(isSuperAdmin || product.sellerId === user?.uid) && (
                        <>
                          <button 
                            onClick={() => handleEdit(product)}
                            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit product"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleDelete(product)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete product"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      ) : activeTab === 'payouts' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Payout Requests</h2>
          </div>
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : payoutRequests.length === 0 ? (
            <div className="p-12 text-center text-slate-500">No payout requests found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="p-4 border-b border-slate-200 bg-slate-50 font-medium text-slate-500 text-sm">Seller</th>
                    <th className="p-4 border-b border-slate-200 bg-slate-50 font-medium text-slate-500 text-sm">Amount</th>
                    <th className="p-4 border-b border-slate-200 bg-slate-50 font-medium text-slate-500 text-sm">Method</th>
                    <th className="p-4 border-b border-slate-200 bg-slate-50 font-medium text-slate-500 text-sm">Status</th>
                    <th className="p-4 border-b border-slate-200 bg-slate-50 font-medium text-slate-500 text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payoutRequests.map(req => (
                    <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <p className="text-sm font-medium text-slate-900">{req.sellerName}</p>
                        <p className="text-xs text-slate-500">{req.createdAt?.toDate().toLocaleDateString()}</p>
                      </td>
                      <td className="p-4 text-sm font-medium text-slate-900">{req.amount?.toLocaleString() || '0'} ETB</td>
                      <td className="p-4">
                        <p className="text-sm text-slate-600">{req.paymentMethod}</p>
                        <p className="text-xs text-slate-400">{req.paymentDetails}</p>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          req.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                          req.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {req.status === 'Pending' && (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => processPayout(req.id, 'Paid')}
                              className="px-3 py-1 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                            >
                              Approve
                            </button>
                            <button 
                              onClick={() => processPayout(req.id, 'Rejected')}
                              className="px-3 py-1 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : activeTab === 'orders' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">All Orders</h2>
            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm font-medium">
              {orders.length} Total
            </span>
          </div>
          
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center text-slate-500">No orders found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="p-4 border-b border-slate-200 bg-slate-50 font-medium text-slate-500 text-sm">Order ID</th>
                    <th className="p-4 border-b border-slate-200 bg-slate-50 font-medium text-slate-500 text-sm">Date</th>
                    <th className="p-4 border-b border-slate-200 bg-slate-50 font-medium text-slate-500 text-sm">Product</th>
                    <th className="p-4 border-b border-slate-200 bg-slate-50 font-medium text-slate-500 text-sm">Buyer Phone</th>
                    <th className="p-4 border-b border-slate-200 bg-slate-50 font-medium text-slate-500 text-sm">Location</th>
                    <th className="p-4 border-b border-slate-200 bg-slate-50 font-medium text-slate-500 text-sm">Total</th>
                    <th className="p-4 border-b border-slate-200 bg-slate-50 font-medium text-slate-500 text-sm">Status</th>
                    <th className="p-4 border-b border-slate-200 bg-slate-50 font-medium text-slate-500 text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-sm font-mono text-slate-900">{order.id.slice(0, 8)}...</td>
                      <td className="p-4 text-sm text-slate-600">{order.createdAt?.toDate().toLocaleDateString()}</td>
                      <td className="p-4 text-sm text-slate-900">{order.productName} (x{order.quantity})</td>
                      <td className="p-4 text-sm text-slate-900">{order.shippingDetails?.phone || 'N/A'}</td>
                      <td className="p-4 text-sm text-slate-600">{order.shippingDetails?.region}, {order.shippingDetails?.city}</td>
                      <td className="p-4 text-sm font-medium text-slate-900">{order.total?.toLocaleString() || '0'} ETB</td>
                      <td className="p-4">
                        <div className="relative group">
                          <select
                            value={order.status}
                            onChange={(e) => updateOrderStatus(order.id, e.target.value as any)}
                            className={`appearance-none pl-10 pr-8 py-2 rounded-full text-sm font-medium border outline-none cursor-pointer transition-all hover:shadow-sm ${
                              order.status === 'Processing' ? 'bg-amber-50 text-amber-700 border-amber-200 focus:ring-amber-200' :
                              order.status === 'Shipped' ? 'bg-blue-50 text-blue-700 border-blue-200 focus:ring-blue-200' :
                              'bg-emerald-50 text-emerald-700 border-emerald-200 focus:ring-emerald-200'
                            }`}
                          >
                            <option value="Processing">Processing</option>
                            <option value="Shipped">Shipped</option>
                            <option value="Delivered">Delivered</option>
                          </select>
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            {order.status === 'Processing' && <Clock className="w-4 h-4 text-amber-500" />}
                            {order.status === 'Shipped' && <Truck className="w-4 h-4 text-blue-500" />}
                            {order.status === 'Delivered' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                          </div>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
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
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">All Users</h2>
            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm font-medium">
              {users.length} Total Users
            </span>
          </div>
          
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-slate-500">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="p-4 border-b border-slate-200 bg-slate-50 font-medium text-slate-500 text-sm">User</th>
                    <th className="p-4 border-b border-slate-200 bg-slate-50 font-medium text-slate-500 text-sm">Email</th>
                    <th className="p-4 border-b border-slate-200 bg-slate-50 font-medium text-slate-500 text-sm">Joined</th>
                    <th className="p-4 border-b border-slate-200 bg-slate-50 font-medium text-slate-500 text-sm">Role</th>
                    <th className="p-4 border-b border-slate-200 bg-slate-50 font-medium text-slate-500 text-sm">Verification Status</th>
                    <th className="p-4 border-b border-slate-200 bg-slate-50 font-medium text-slate-500 text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(u => {
                    const userApp = sellerApplications.find(app => app.userId === u.id);
                    return (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {u.photoURL ? (
                            <LazyImage src={u.photoURL} alt={u.displayName} className="w-8 h-8 rounded-full bg-slate-200" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-medium text-sm">
                              {u.displayName?.charAt(0) || u.email?.charAt(0)}
                            </div>
                          )}
                          <span className="text-sm font-medium text-slate-900">{u.displayName || 'Anonymous'}</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-slate-600">{u.email}</td>
                      <td className="p-4 text-sm text-slate-600">{u.createdAt?.toDate().toLocaleDateString()}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-800'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4">
                        {u.role === 'seller' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                            Verified
                          </span>
                        ) : userApp ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            userApp.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                            userApp.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {userApp.status}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Not Applied</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {u.email !== 'amanuelyohannes929@gmail.com' && (
                            <button
                              onClick={() => toggleUserRole(u.id, u.role)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                u.role === 'admin' 
                                  ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' 
                                  : 'text-purple-700 bg-purple-50 hover:bg-purple-100'
                              }`}
                            >
                              {u.role === 'admin' ? (
                                <><ShieldAlert className="w-4 h-4" /> Revoke Admin</>
                              ) : (
                                <><ShieldCheck className="w-4 h-4" /> Make Admin</>
                              )}
                            </button>
                          )}
                          {userApp && userApp.status === 'Pending' && (
                            <>
                              <button
                                onClick={() => handleApproveApplication(userApp.id, u.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                              >
                                <CheckCircle2 className="w-4 h-4" /> Approve
                              </button>
                              <button
                                onClick={() => handleRejectApplication(userApp.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-red-700 bg-red-50 hover:bg-red-100"
                              >
                                <X className="w-4 h-4" /> Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* View Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Order Details</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
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
    </div>
  );
};
