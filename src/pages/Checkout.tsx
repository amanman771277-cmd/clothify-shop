import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Loader2, ArrowLeft, Truck, RefreshCcw, ShieldCheck } from 'lucide-react';

const SHIPPING_OPTIONS = [
  { id: 'standard', name: 'Standard Shipping', cost: 50, days: 4, description: 'Delivery in 3-5 business days' },
  { id: 'express', name: 'Express Shipping', cost: 100, days: 2, description: 'Delivery in 1-2 business days' },
  { id: 'next_day', name: 'Next Day Delivery', cost: 150, days: 1, description: 'Delivery by tomorrow' }
];

import { useTranslation } from 'react-i18next';

export const Checkout: React.FC = () => {
  const { t } = useTranslation();
  const { items, total, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [shippingRegion, setShippingRegion] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingPostalCode, setShippingPostalCode] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [selectedShipping, setSelectedShipping] = useState(SHIPPING_OPTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">{t('nav.signin')}</h1>
        <button onClick={() => navigate('/')} className="text-slate-600 hover:text-slate-900 underline">
          {t('common.return_to_home')}
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">{t('cart.empty')}</h1>
        <button onClick={() => navigate('/')} className="text-slate-600 hover:text-slate-900 underline">
          {t('common.return_to_home')}
        </button>
      </div>
    );
  }

  const totalShipping = selectedShipping.cost * items.length;
  const finalTotal = total + totalShipping;

  const initializePayment = async (totalAmount: number, userEmail: string, tx_ref: string) => {
    const response = await fetch('/api/chapa/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: totalAmount,
        currency: 'ETB',
        email: userEmail,
        first_name: user?.displayName?.split(' ')[0] || 'Customer',
        last_name: user?.displayName?.split(' ')[1] || '',
        tx_ref,
        return_url: `${window.location.origin}/verify-payment?tx_ref=${tx_ref}`
      })
    });

    const data = await response.json();
    
    if (response.ok && data.checkoutUrl) {
      window.location.href = data.checkoutUrl; // Redirect to Chapa
    } else {
      throw new Error(data.error || 'Failed to initialize payment');
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shippingRegion.trim() || !shippingCity.trim() || !shippingPhone.trim()) {
      setError('Please fill in all required shipping details');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const estimatedDeliveryDate = new Date();
      estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + selectedShipping.days);
      const tx_ref = `clothify-tx-${Date.now()}`;

      const orderPromises = items.map(item => {
        const orderData = {
          buyerId: user.uid,
          sellerId: item.sellerId || 'admin',
          productId: item.productId || '',
          productName: item.name || 'Unknown Product',
          price: item.price || 0,
          quantity: item.quantity || 1,
          imageUrl: item.imageUrl || '',
          size: item.size || null,
          color: item.color || null,
          shippingDetails: {
            region: shippingRegion,
            city: shippingCity,
            postalCode: shippingPostalCode,
            phone: shippingPhone,
            shippingMethod: selectedShipping.name,
            shippingCost: selectedShipping.cost // Full shipping cost per item
          },
          total: (item.price * item.quantity) + selectedShipping.cost,
          status: 'Processing',
          statusHistory: [{
            status: 'Processing',
            date: new Date().toISOString(),
            note: 'Order placed'
          }],
          paymentMethod: 'Chapa',
          paymentStatus: 'Pending',
          tx_ref,
          estimatedDelivery: estimatedDeliveryDate.toISOString(),
          createdAt: serverTimestamp()
        };
        return addDoc(collection(db, 'orders'), orderData);
      });

      await Promise.all(orderPromises);
      clearCart();

      // Initialize Chapa payment
      await initializePayment(finalTotal, user.email || 'customer@clothify.com', tx_ref);
      
    } catch (err: any) {
      console.error("Error placing order:", err);
      setError(err.message || 'Failed to place order. Please try again.');
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <button 
        onClick={handleBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> {t('common.back')}
      </button>
      
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-8">{t('checkout.title')}</h1>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">{t('checkout.order_summary')}</h2>
          <ul className="space-y-4 mb-6">
            {items.map(item => (
              <li key={item.id} className="flex justify-between text-sm">
                <span className="text-slate-600">
                  {item.quantity}x {item.name} {item.size ? `(${item.size})` : ''}
                </span>
                <span className="font-medium text-slate-900">
                  {(item.price * item.quantity)?.toLocaleString() || '0'} ETB
                </span>
              </li>
            ))}
            <li className="flex justify-between text-sm pt-4 border-t border-slate-100">
              <span className="text-slate-600">{t('cart.subtotal')}</span>
              <span className="font-medium text-slate-900">{total?.toLocaleString() || '0'} ETB</span>
            </li>
            <li className="flex justify-between text-sm">
              <span className="text-slate-600">{t('common.shipping')} ({selectedShipping.name} x{items.length})</span>
              <span className="font-medium text-slate-900">{totalShipping?.toLocaleString() || '0'} ETB</span>
            </li>
          </ul>
          <div className="flex justify-between text-lg font-bold text-slate-900 pt-4 border-t border-slate-100">
            <span>{t('checkout.total')}</span>
            <span>{finalTotal?.toLocaleString() || '0'} ETB</span>
          </div>
        </div>

        <form onSubmit={handlePlaceOrder} className="p-6 sm:p-8 bg-slate-50">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">{t('checkout.shipping_address')}</h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="region" className="block text-sm font-medium text-slate-700 mb-2">
                Region / State
              </label>
              <input
                type="text"
                id="region"
                value={shippingRegion}
                onChange={(e) => setShippingRegion(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                placeholder="e.g. Addis Ababa"
                required
              />
            </div>
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-slate-700 mb-2">
                City
              </label>
              <input
                type="text"
                id="city"
                value={shippingCity}
                onChange={(e) => setShippingCity(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                placeholder="e.g. Bole"
                required
              />
            </div>
            <div>
              <label htmlFor="postalCode" className="block text-sm font-medium text-slate-700 mb-2">
                Postal Code (Optional)
              </label>
              <input
                type="text"
                id="postalCode"
                value={shippingPostalCode}
                onChange={(e) => setShippingPostalCode(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                placeholder="e.g. 1000"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                value={shippingPhone}
                onChange={(e) => setShippingPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                placeholder="e.g. +251 911 234 567"
                required
              />
            </div>
          </div>

          <div className="mb-8">
            <label className="block text-sm font-medium text-slate-700 mb-3">
              {t('checkout.shipping_method')}
            </label>
            <div className="space-y-3">
              {SHIPPING_OPTIONS.map((option) => (
                <label 
                  key={option.id}
                  className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedShipping.id === option.id 
                      ? 'border-slate-900 bg-slate-900/5 ring-1 ring-slate-900' 
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input 
                      type="radio" 
                      name="shippingMethod" 
                      value={option.id}
                      checked={selectedShipping.id === option.id}
                      onChange={() => setSelectedShipping(option)}
                      className="w-4 h-4 text-slate-900 focus:ring-slate-900 border-slate-300"
                    />
                    <div>
                      <p className="font-medium text-slate-900">{option.name}</p>
                      <p className="text-sm text-slate-500">{option.description}</p>
                    </div>
                  </div>
                  <span className="font-medium text-slate-900">
                    {option.cost === 0 ? t('common.free') || 'Free' : `${option.cost} ETB`}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="mb-8 bg-emerald-50 p-5 rounded-xl border border-emerald-100 space-y-2">
            <div className="flex items-center gap-2 text-emerald-800 font-medium">
              <ShieldCheck className="w-5 h-5" />
              <span>Secured by Chapa</span>
            </div>
            <p className="text-sm text-emerald-600">
              You will be redirected to Chapa to securely complete your payment using Telebirr, CBE Birr, or your bank card.
            </p>
          </div>

          <div className="mb-8 bg-white p-5 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <RefreshCcw className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-900">Return Policy</p>
                <p className="text-sm text-slate-500">Free returns within 30 days of delivery.</p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white px-6 py-4 rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 flex items-center justify-center disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                {t('checkout.processing')}
              </>
            ) : (
              `${t('checkout.place_order')} - ${finalTotal?.toLocaleString() || '0'} ETB`
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
