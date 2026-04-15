import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, User, LogOut, ShieldAlert, Package, Search, MoreVertical, Store, ArrowRightLeft, Bell, Check } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslation } from 'react-i18next';

export const Navbar: React.FC = () => {
  const { t } = useTranslation();
  const { user, isAdmin, isSeller, isSuperAdmin, login, logout } = useAuth();
  const { items, setIsCartOpen } = useCart();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (e) {
      console.error(e);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true })));
    } catch (e) {
      console.error(e);
    }
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/');
    }
  };

  return (
    <nav className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tighter text-slate-900">Clothify</span>
          </Link>

          <div className="flex-1 max-w-md mx-4 hidden sm:block">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                placeholder={t('common.search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-full text-sm focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 outline-none transition-all"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </form>
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <div className="relative" ref={notificationsRef}>
                <button 
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className="relative p-2 text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-500 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {isNotificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 animate-in fade-in zoom-in duration-200 z-50">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                      <h3 className="font-semibold text-slate-900">Notifications</h3>
                      {unreadCount > 0 && (
                        <button onClick={markAllAsRead} className="text-xs text-blue-600 hover:text-blue-800">
                          Mark all as read
                        </button>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-6 text-center text-slate-500 text-sm">
                          No notifications yet.
                        </div>
                      ) : (
                        notifications.map(notification => (
                          <div 
                            key={notification.id} 
                            className={`px-4 py-3 border-b border-slate-50 last:border-0 flex gap-3 ${!notification.read ? 'bg-blue-50/50' : ''}`}
                            onClick={() => !notification.read && markAsRead(notification.id)}
                          >
                            <div className="flex-1">
                              <p className={`text-sm ${!notification.read ? 'font-medium text-slate-900' : 'text-slate-600'}`}>
                                {notification.message}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                {notification.createdAt?.toDate ? new Date(notification.createdAt.toDate()).toLocaleString() : 'Just now'}
                              </p>
                            </div>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5 shrink-0" />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button 
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ShoppingBag className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-slate-900 rounded-full">
                  {itemCount}
                </span>
              )}
            </button>

            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="p-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 animate-in fade-in zoom-in duration-200">
                  <Link to="/profile" className="flex items-center gap-3 px-4 py-2 text-slate-700 hover:bg-slate-50" onClick={() => setIsDropdownOpen(false)}>
                    <User className="w-4 h-4" /> {t('common.profile')}
                  </Link>
                  <Link to="/orders" className="flex items-center gap-3 px-4 py-2 text-slate-700 hover:bg-slate-50" onClick={() => setIsDropdownOpen(false)}>
                    <Package className="w-4 h-4" /> {t('common.orders')}
                  </Link>
                  <Link to="/compare" className="flex items-center gap-3 px-4 py-2 text-slate-700 hover:bg-slate-50" onClick={() => setIsDropdownOpen(false)}>
                    <ArrowRightLeft className="w-4 h-4" /> {t('common.compare')}
                  </Link>

                  {!isAdmin && !isSeller && (
                    <Link to="/become-seller" className="flex items-center gap-3 px-4 py-2 text-slate-700 hover:bg-slate-50" onClick={() => setIsDropdownOpen(false)}>
                      <Store className="w-4 h-4" /> {t('common.become_seller')}
                    </Link>
                  )}

                  {isSuperAdmin && (
                    <Link to="/super-admin" className="flex items-center gap-3 px-4 py-2 text-emerald-700 hover:bg-emerald-50 font-medium" onClick={() => setIsDropdownOpen(false)}>
                      <ShieldAlert className="w-4 h-4" /> {t('common.super_admin')}
                    </Link>
                  )}

                  {isAdmin ? (
                    <Link to="/admin" className="flex items-center gap-3 px-4 py-2 text-emerald-700 hover:bg-emerald-50 font-medium" onClick={() => setIsDropdownOpen(false)}>
                      <ShieldAlert className="w-4 h-4" /> {t('common.admin_dashboard')}
                    </Link>
                  ) : isSeller ? (
                    <>
                      <Link to="/seller" className="flex items-center gap-3 px-4 py-2 text-blue-700 hover:bg-blue-50 font-medium" onClick={() => setIsDropdownOpen(false)}>
                        <Store className="w-4 h-4" /> {t('common.seller_dashboard')}
                      </Link>
                      <Link to="/seller?add=true" className="flex items-center gap-3 px-4 py-2 text-blue-700 hover:bg-blue-50 font-medium" onClick={() => setIsDropdownOpen(false)}>
                        <Package className="w-4 h-4" /> Add Product
                      </Link>
                    </>
                  ) : null}

                  <div className="border-t border-slate-100 my-2" />
                  {user ? (
                    <button onClick={() => { logout(); setIsDropdownOpen(false); }} className="flex w-full items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50">
                      <LogOut className="w-4 h-4" /> {t('common.logout')}
                    </button>
                  ) : (
                    <button onClick={() => { login(); setIsDropdownOpen(false); }} className="flex w-full items-center gap-3 px-4 py-2 text-slate-700 hover:bg-slate-50">
                      <User className="w-4 h-4" /> {t('common.login')}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
