import React from 'react';
import { X, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { Link } from 'react-router-dom';
import { LazyImage } from './LazyImage';

import { useTranslation } from 'react-i18next';

export const CartDrawer: React.FC = () => {
  const { t } = useTranslation();
  const { isCartOpen, setIsCartOpen, items, updateQuantity, removeFromCart, total } = useCart();

  if (!isCartOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            {t('cart.title')}
          </h2>
          <button 
            onClick={() => setIsCartOpen(false)}
            className="p-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <div>
                <p className="text-slate-900 font-medium">{t('cart.empty')}</p>
                <p className="text-slate-500 text-sm mt-1">{t('cart.empty_desc')}</p>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="mt-4 text-sm font-medium text-slate-900 hover:underline"
              >
                {t('order_confirmation.continue_shopping')}
              </button>
            </div>
          ) : (
            <ul className="space-y-6">
              {items.map((item) => (
                <li key={item.id} className="flex gap-4">
                  <div className="w-20 h-24 sm:w-24 sm:h-28 flex-shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                    <LazyImage src={item.imageUrl} alt={item.name} className="w-full h-full" imgClassName="object-center" />
                  </div>
                  <div className="flex flex-1 flex-col">
                    <div className="flex justify-between text-base font-medium text-slate-900">
                      <h3 className="line-clamp-2"><Link to={`/product/${item.productId}`} onClick={() => setIsCartOpen(false)}>{item.name}</Link></h3>
                      <p className="ml-4 whitespace-nowrap">{item.price?.toLocaleString() || '0'} ETB</p>
                    </div>
                    {(item.size || item.color) && (
                      <p className="mt-1 text-sm text-slate-500">
                        {item.size && <span>{t('product.size')}: {item.size}</span>}
                        {item.size && item.color && <span className="mx-2">|</span>}
                        {item.color && <span>{t('product.color')}: {item.color}</span>}
                      </p>
                    )}
                    <div className="flex flex-1 items-end justify-between text-sm mt-2">
                      <div className="flex items-center border border-gray-200 rounded-lg">
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="p-1 text-gray-500 hover:text-slate-900"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="px-3 font-medium text-slate-900">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="p-1 text-gray-500 hover:text-slate-900"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="font-medium text-red-500 hover:text-red-600"
                      >
                        {t('cart.remove')}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-gray-100 p-4 sm:p-6 bg-slate-50">
            <div className="flex justify-between text-base font-medium text-slate-900 mb-4">
              <p>{t('cart.subtotal')}</p>
              <p>{total?.toLocaleString() || '0'} ETB</p>
            </div>
            <p className="text-sm text-slate-500 mb-6">{t('cart.shipping_calc')}</p>
            <Link 
              to="/checkout"
              onClick={() => setIsCartOpen(false)}
              className="w-full bg-slate-900 text-white px-6 py-4 rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 block text-center"
            >
              {t('cart.checkout')}
            </Link>
          </div>
        )}
      </div>
    </>
  );
};
