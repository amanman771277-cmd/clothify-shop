import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CheckCircle2, Truck, CreditCard, Calendar, ArrowRight } from 'lucide-react';
import { LazyImage } from '../components/LazyImage';

import { useTranslation } from 'react-i18next';

export const OrderConfirmation: React.FC = () => {
  const { t } = useTranslation();
  const { orderId: tx_ref } = useParams<{ orderId: string }>();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!tx_ref) return;
      try {
        const q = query(collection(db, 'orders'), where('tx_ref', '==', tx_ref));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [tx_ref]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('common.no_items')}</h2>
        <p className="text-slate-500 mb-6">{t('common.error')}</p>
        <Link to="/" className="text-slate-900 font-medium hover:underline">{t('common.return_to_home')}</Link>
      </div>
    );
  }

  const firstOrder = orders[0];
  const totalAmount = orders.reduce((sum, order) => sum + order.total, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">{t('order_confirmation.title')}</h1>
        <p className="text-slate-500">{t('order_confirmation.subtitle')}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500 mb-1">{t('order_confirmation.order_number')}</p>
            <p className="font-mono font-medium text-slate-900">{tx_ref}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-sm text-slate-500 mb-1">{t('orders.date') || 'Order Date'}</p>
            <p className="font-medium text-slate-900">
              {firstOrder.createdAt?.toDate().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">{t('common.order_summary')}</h2>
          <div className="space-y-4 mb-8">
            {orders.map((order: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded bg-slate-100 overflow-hidden flex-shrink-0">
                    <LazyImage src={order.imageUrl} alt={order.productName} className="w-full h-full" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 line-clamp-1">{order.productName}</p>
                    <p className="text-sm text-slate-500">{t('product.quantity') || 'Qty'}: {order.quantity} {order.size ? `| ${t('product.size')}: ${order.size}` : ''}</p>
                  </div>
                </div>
                <p className="font-medium text-slate-900">{((order.price || 0) * (order.quantity || 0)).toLocaleString()} ETB</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
            <div>
              <h3 className="text-sm font-medium text-slate-500 mb-3 flex items-center gap-2">
                <Truck className="w-4 h-4" /> {t('common.shipping')}
              </h3>
              <p className="font-medium text-slate-900">{firstOrder.shippingDetails?.shippingMethod}</p>
              <p className="text-sm text-slate-600 mt-1">
                {firstOrder.shippingDetails?.region}, {firstOrder.shippingDetails?.city}
                <br />
                {firstOrder.shippingDetails?.phone}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-500 mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> {t('common.payment_method') || 'Payment Method'}
              </h3>
              <p className="font-medium text-slate-900">{firstOrder.paymentMethod}</p>
              <p className="text-sm text-slate-600 mt-2 flex items-center gap-2">
                {t('orders.status') || 'Status'}: 
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  firstOrder.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                  firstOrder.paymentStatus === 'Failed' ? 'bg-red-100 text-red-800' :
                  'bg-amber-100 text-amber-800'
                }`}>
                  {firstOrder.paymentStatus}
                </span>
              </p>
            </div>
          </div>

          <div className="mt-8 bg-slate-50 rounded-xl p-5 flex items-start gap-4 border border-slate-100">
            <Calendar className="w-6 h-6 text-slate-400 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-slate-900">{t('order_confirmation.estimated_delivery')}</h3>
              <p className="text-slate-600 mt-1">
                {firstOrder.estimatedDelivery?.toDate().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-medium text-slate-900 mb-4">Status History</h3>
            <div className="space-y-4">
              {(firstOrder.statusHistory || [{ status: firstOrder.status, date: firstOrder.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(), note: 'Order placed' }]).map((historyItem: any, idx: number, arr: any[]) => (
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
        
        <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-lg">
            <span className="text-slate-500 mr-2">{t('common.total')}:</span>
            <span className="font-bold text-slate-900">{totalAmount?.toLocaleString() || '0'} ETB</span>
          </div>
          <Link 
            to="/orders"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors w-full sm:w-auto"
          >
            {t('order_confirmation.view_order_details')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};
