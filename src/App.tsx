import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { WishlistProvider } from './contexts/WishlistContext';
import { CompareProvider } from './contexts/CompareContext';
import { Navbar } from './components/Navbar';
import { CartDrawer } from './components/CartDrawer';
import { Home } from './pages/Home';
import { Admin } from './pages/Admin';
import { ProductDetail } from './pages/ProductDetail';
import { Wishlist } from './pages/Wishlist';
import { Compare } from './pages/Compare';
import { Profile } from './pages/Profile';
import { Checkout } from './pages/Checkout';
import { Orders } from './pages/Orders';
import { VerifyPayment } from './pages/VerifyPayment';
import { OrderConfirmation } from './pages/OrderConfirmation';
import { SellerDashboard } from './pages/SellerDashboard';
import { SuperAdmin } from './pages/SuperAdmin';
import { SellerVerification } from './pages/SellerVerification';
import { useTranslation } from 'react-i18next';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function App() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <AuthProvider>
      <WishlistProvider>
        <CompareProvider>
          <CartProvider>
            <Router>
              <ScrollToTop />
              <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-slate-200">
                <Navbar />
                <CartDrawer />
                <main>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/product/:id" element={<ProductDetail />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/wishlist" element={<Wishlist />} />
                    <Route path="/compare" element={<Compare />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/seller" element={<SellerDashboard />} />
                    <Route path="/super-admin" element={<SuperAdmin />} />
                    <Route path="/verify-payment" element={<VerifyPayment />} />
                    <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />
                    <Route path="/become-seller" element={<SellerVerification />} />
                  </Routes>
                </main>
                
                {/* Footer */}
                <footer className="bg-slate-50 border-t border-slate-200 py-12 mt-auto">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex flex-col gap-2">
                      <span className="text-xl font-bold tracking-tighter text-slate-900">Clothify</span>
                      <p className="text-slate-500 text-sm max-w-xs">
                        {t('common.footer_description')}
                      </p>
                    </div>
                    <p className="text-slate-500 text-sm">
                      &copy; {new Date().getFullYear()} Clothify. {t('common.all_rights_reserved')}
                    </p>
                  </div>
                </footer>
              </div>
            </Router>
          </CartProvider>
        </CompareProvider>
      </WishlistProvider>
    </AuthProvider>
  );
}
