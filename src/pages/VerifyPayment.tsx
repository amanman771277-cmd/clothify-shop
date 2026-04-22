import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { doc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Loader2, XCircle, CheckCircle } from 'lucide-react';

import { useTranslation } from 'react-i18next';

export const VerifyPayment: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tx_ref = searchParams.get('tx_ref');
  
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const verifyTransaction = async () => {
      if (!tx_ref) {
        setStatus('failed');
        setErrorMessage(t('payment.missing_ref'));
        return;
      }

      try {
        const response = await fetch(`/api/chapa/verify/${tx_ref}`);
        const data = await response.json();

        if (data.status === 'success' && data.data?.status === 'success') {
          // Payment successful
          const q = query(collection(db, 'orders'), where('tx_ref', '==', tx_ref));
          const snapshot = await getDocs(q);
          const updatePromises = snapshot.docs.map(async (docSnap) => {
            const orderData = docSnap.data();
            // Update order status
            await updateDoc(docSnap.ref, { paymentStatus: 'Paid' });
            // Mark product as sold
            if (orderData.productId) {
              const productRef = doc(db, 'products', orderData.productId);
              await updateDoc(productRef, { isAvailable: false, status: 'sold' });
            }

            // Add notification for Buyer
            if (orderData.buyerId) {
              await addDoc(collection(db, 'notifications'), {
                userId: orderData.buyerId,
                message: `Payment Successful! Your order for ${orderData.productName || 'the product'} has been confirmed.`,
                read: false,
                createdAt: serverTimestamp(),
                type: 'order_success'
              });
            }

            // Add notification for Seller
            if (orderData.sellerId) {
              await addDoc(collection(db, 'notifications'), {
                userId: orderData.sellerId,
                message: `New Sale! Your product ${orderData.productName || ''} has been purchased.`,
                read: false,
                createdAt: serverTimestamp(),
                type: 'new_sale'
              });
            }
          });
          await Promise.all(updatePromises);
          
          setStatus('success');
          setTimeout(() => {
            navigate(`/order-confirmation/${tx_ref}`);
          }, 2000);
        } else {
          // Payment failed or pending
          const q = query(collection(db, 'orders'), where('tx_ref', '==', tx_ref));
          const snapshot = await getDocs(q);
          const updatePromises = snapshot.docs.map(docSnap => updateDoc(docSnap.ref, { paymentStatus: 'Failed' }));
          await Promise.all(updatePromises);
          
          setStatus('failed');
          setErrorMessage(data.message || t('payment.failed'));
        }
      } catch (error) {
        console.error("Verification error:", error);
        setStatus('failed');
        setErrorMessage(t('payment.error_occurred'));
      }
    };

    verifyTransaction();
  }, [tx_ref, navigate, t]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
        {status === 'verifying' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-slate-900 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">{t('payment.verifying')}</h2>
            <p className="text-slate-500">{t('payment.verifying_desc')}</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">{t('payment.success')}</h2>
            <p className="text-slate-500">{t('payment.success_desc')}</p>
          </>
        )}

        {status === 'failed' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">{t('payment.failed')}</h2>
            <p className="text-slate-500 mb-6">{errorMessage}</p>
            <div className="space-y-3">
              <button 
                onClick={() => navigate('/checkout')}
                className="w-full bg-slate-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors"
              >
                {t('payment.try_again')}
              </button>
              <button 
                onClick={() => navigate('/orders')}
                className="w-full bg-slate-100 text-slate-700 px-6 py-3 rounded-xl font-medium hover:bg-slate-200 transition-colors"
              >
                {t('payment.view_orders')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
