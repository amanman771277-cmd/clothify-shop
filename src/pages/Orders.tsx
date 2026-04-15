import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Package, Truck, CheckCircle2, Clock, ChevronDown, ArrowLeft } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LazyImage } from '../components/LazyImage';

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

import { useTranslation } from 'react-i18next';

export const Orders: React.FC = () => {
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const location = useLocation();
  const showSuccessMessage = location.state?.success;

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;
      try {
        const q = query(
          collection(db, 'orders'),
          where('buyerId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">{t('nav.signin')}</h1>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Processing': return <Clock className="w-5 h-5 text-amber-500" />;
      case 'Shipped': return <Truck className="w-5 h-5 text-blue-500" />;
      case 'Delivered': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      default: return <Package className="w-5 h-5 text-slate-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Processing': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Shipped': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Delivered': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: 'Processing' | 'Shipped' | 'Delivered') => {
    setUpdatingId(orderId);
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch (error) {
      console.error("Error updating order status:", error);
    } finally {
      setUpdatingId(null);
    }
  };

  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <button 
        onClick={handleBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> {t('common.back') || 'Back'}
      </button>

      {showSuccessMessage && (
        <div className="mb-8 p-4 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5" />
          <p className="font-medium">{t('order_confirmation.order_placed_success')}</p>
        </div>
      )}

      <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-8">{t('nav.orders')}</h1>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-slate-900" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border border-slate-100">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">{t('orders.no_orders') || 'No orders yet'}</h2>
          <p className="text-slate-500 mb-6">{t('orders.no_orders_desc') || 'When you place an order, it will appear here.'}</p>
          <Link 
            to="/" 
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-slate-900 hover:bg-slate-800 transition-colors"
          >
            {t('order_confirmation.continue_shopping')}
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map(order => (
            <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">
                    {t('orders.date') || 'Order Placed'}: <span className="font-medium text-slate-900">{order.createdAt?.toDate().toLocaleDateString()}</span>
                  </p>
                  <p className="text-sm text-slate-500">
                    {t('order_confirmation.order_number')}: <span className="font-mono text-slate-900">{order.id}</span>
                  </p>
                </div>
                <div className="flex flex-col sm:items-end gap-2">
                  {isAdmin ? (
                    <div className="relative">
                      <select
                        value={order.status}
                        disabled={updatingId === order.id}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value as any)}
                        className={`appearance-none pl-10 pr-8 py-1.5 rounded-full text-sm font-medium border outline-none cursor-pointer transition-all hover:shadow-sm disabled:opacity-50 ${getStatusColor(order.status)}`}
                      >
                        <option value="Processing">{t('orders.processing') || 'Processing'}</option>
                        <option value="Shipped">{t('orders.shipped') || 'Shipped'}</option>
                        <option value="Delivered">{t('orders.delivered') || 'Delivered'}</option>
                      </select>
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        {updatingId === order.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                        ) : (
                          getStatusIcon(order.status)
                        )}
                      </div>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <ChevronDown className="w-4 h-4 opacity-50" />
                      </div>
                    </div>
                  ) : (
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)}
                      {t(`orders.${order.status.toLowerCase()}`) || order.status}
                    </div>
                  )}
                  <p className="text-sm font-medium text-slate-900">
                    {t('common.total')}: {order.total?.toLocaleString() || '0'} ETB
                  </p>
                </div>
              </div>
              
              <div className="p-6">
                <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-slate-900 mb-2">{t('order_confirmation.estimated_delivery')}</h3>
                    <p className="text-slate-600">
                      {order.estimatedDelivery && (order.estimatedDelivery as any).toDate 
                        ? (order.estimatedDelivery as any).toDate().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                        : new Date(order.estimatedDelivery).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  {order.shippingDetails && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-900 mb-2">{t('checkout.shipping_method')}</h3>
                      <p className="text-slate-600">
                        {order.shippingDetails.shippingMethod} ({order.shippingDetails.shippingCost === 0 ? t('common.free') || 'Free' : `${order.shippingDetails.shippingCost} ETB`})
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        {order.shippingDetails.region}, {order.shippingDetails.city}
                      </p>
                    </div>
                  )}
                  {order.paymentMethod && (
                    <div className="sm:text-right">
                      <h3 className="text-sm font-medium text-slate-900 mb-2">{t('checkout.payment_method')}</h3>
                      <div className="space-y-1">
                        <p className="text-slate-600">
                          {order.paymentMethod}
                          {order.paymentStatus && (
                            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              order.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                              order.paymentStatus === 'Failed' ? 'bg-red-100 text-red-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {t(`orders.${order.paymentStatus.toLowerCase()}`) || order.paymentStatus}
                            </span>
                          )}
                        </p>
                        {order.paymentStatus !== 'Paid' && order.tx_ref && (
                          <p className="text-[10px] text-slate-400 font-mono">
                            Ref: {order.tx_ref}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4 py-4 border-t border-slate-100 first:border-0 first:pt-0">
                    <div className="w-20 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100">
                      <LazyImage src={order.imageUrl} alt={order.productName} className="w-full h-full" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <h4 className="font-medium text-slate-900 line-clamp-1">
                        <Link to={`/product/${order.productId}`} className="hover:underline">{order.productName}</Link>
                      </h4>
                      <p className="text-sm text-slate-500 mt-1">
                        {t('product.quantity') || 'Qty'}: {order.quantity}
                        {order.size && <span className="mx-2">|</span>}
                        {order.size && `${t('product.size')}: ${order.size}`}
                        {order.color && <span className="mx-2">|</span>}
                        {order.color && `${t('product.color')}: ${order.color}`}
                      </p>
                      <p className="font-medium text-slate-900 mt-2">
                        {order.price?.toLocaleString() || '0'} ETB
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-100">
                  <h3 className="text-sm font-medium text-slate-900 mb-4">Status History</h3>
                  <div className="space-y-4">
                    {((order as any).statusHistory || [{ status: order.status, date: order.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(), note: 'Order placed' }]).map((historyItem: any, idx: number, arr: any[]) => (
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
