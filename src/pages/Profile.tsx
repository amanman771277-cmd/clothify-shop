import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Loader2, User, Mail, Phone, Building2, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LazyImage } from '../components/LazyImage';

export const Profile: React.FC = () => {
  const { t } = useTranslation();
  const { user, userData, loading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(userData?.displayName || '');
  const [phoneNumber, setPhoneNumber] = useState(userData?.phoneNumber || '');
  const [updating, setUpdating] = useState(false);

  const handleUpdate = async () => {
    if (!user) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName,
        phoneNumber
      });
      setIsEditing(false);
      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-900" /></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <button 
        onClick={() => window.history.back()}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> {t('common.back') || 'Back'}
      </button>

      <h1 className="text-3xl font-bold text-slate-900 mb-8">{t('common.my_account')}</h1>
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 mb-8">
          <LazyImage src={user?.photoURL || ''} alt={displayName} className="w-20 h-20 rounded-full border-2 border-slate-100" />
          <div>
            <h2 className="text-xl font-bold text-slate-900">{displayName}</h2>
            <p className="text-slate-500">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
            <input 
              type="text" 
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              disabled={!isEditing}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
            <input 
              type="text" 
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              disabled={!isEditing}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all disabled:bg-slate-50"
            />
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          {isEditing ? (
            <>
              <button 
                onClick={handleUpdate}
                disabled={updating}
                className="bg-slate-900 text-white px-6 py-2 rounded-xl font-medium hover:bg-slate-800 transition-colors disabled:opacity-70"
              >
                {updating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
              </button>
              <button 
                onClick={() => setIsEditing(false)}
                className="bg-slate-100 text-slate-700 px-6 py-2 rounded-xl font-medium hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <button 
              onClick={() => setIsEditing(true)}
              className="bg-slate-900 text-white px-6 py-2 rounded-xl font-medium hover:bg-slate-800 transition-colors"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
