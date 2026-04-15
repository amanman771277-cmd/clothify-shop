import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { 
  User, 
  Phone, 
  IdCard, 
  Upload, 
  CheckCircle2, 
  Loader2, 
  ArrowLeft,
  AlertCircle,
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { LazyImage } from '../components/LazyImage';

export const SellerVerification: React.FC = () => {
  const { t } = useTranslation();
  const { user, userData, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [existingApp, setExistingApp] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    fatherName: '',
    grandfatherName: '',
    phoneNumber: '',
  });

  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [idFrontPreview, setIdFrontPreview] = useState('');
  const [idBackPreview, setIdBackPreview] = useState('');

  React.useEffect(() => {
    const checkApplicationStatus = async () => {
      if (!user) {
        setCheckingStatus(false);
        return;
      }

      try {
        const q = query(
          collection(db, 'sellerApplications'),
          where('userId', '==', user.uid)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setExistingApp(snapshot.docs[0].data());
        }
      } catch (err) {
        console.error("Error checking application status:", err);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkApplicationStatus();
  }, [user]);

  if (authLoading || checkingStatus) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-900" /></div>;
  
  if (!user) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-slate-900 mb-4">{t('common.please_sign_in_apply')}</h1>
      <button 
        onClick={() => navigate('/')}
        className="text-slate-600 hover:text-slate-900 underline"
      >
        {t('common.return_to_home')}
      </button>
    </div>
  );

  if (userData?.role === 'seller') return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="bg-emerald-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600">
        <CheckCircle2 className="w-10 h-10" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-4">{t('seller_verification.already_seller')}</h1>
      <button 
        onClick={() => navigate('/seller')}
        className="bg-slate-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors"
      >
        {t('common.seller_dashboard')}
      </button>
    </div>
  );

  if (existingApp) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="bg-amber-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-600">
        <Clock className="w-10 h-10" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-4">{t('seller_verification.already_applied')}</h1>
      <p className="text-slate-600 mb-8">
        Status: <span className="font-bold text-slate-900">{existingApp.status}</span>
      </p>
      <button 
        onClick={() => navigate('/')}
        className="bg-slate-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors"
      >
        {t('common.return_to_home')}
      </button>
    </div>
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === 'front') {
        setIdFront(file);
        setIdFrontPreview(URL.createObjectURL(file));
      } else {
        setIdBack(file);
        setIdBackPreview(URL.createObjectURL(file));
      }
    }
  };

  const uploadToCloudinary = async (file: File, fileType: string) => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Server responded with status ${response.status}`);
      }
      const data = await response.json();
      return data.url;
    } catch (err: any) {
      throw new Error(`Failed to upload ${fileType} image: ${err.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!idFront || !idBack) {
      setError(t('seller_verification.error_both_sides'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Upload images to Cloudinary via our server
      const [frontUrl, backUrl] = await Promise.all([
        uploadToCloudinary(idFront, 'front ID'),
        uploadToCloudinary(idBack, 'back ID')
      ]);

      // Save application to Firestore
      await addDoc(collection(db, 'sellerApplications'), {
        userId: user.uid,
        userEmail: user.email,
        fullName: `${formData.firstName} ${formData.fatherName} ${formData.grandfatherName}`,
        firstName: formData.firstName,
        fatherName: formData.fatherName,
        grandfatherName: formData.grandfatherName,
        phoneNumber: formData.phoneNumber,
        idFrontUrl: frontUrl,
        idBackUrl: backUrl,
        status: 'Pending',
        createdAt: serverTimestamp()
      });

      setSuccess(true);
    } catch (err: any) {
      console.error("Seller application error:", err);
      setError(err.message || 'Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-emerald-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600"
        >
          <CheckCircle2 className="w-10 h-10" />
        </motion.div>
        <h1 className="text-3xl font-bold text-slate-900 mb-4">{t('seller_verification.success_title')}</h1>
        <p className="text-slate-600 mb-8 leading-relaxed">
          {t('seller_verification.success_message')}
        </p>
        <button 
          onClick={() => navigate('/')}
          className="bg-slate-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors"
        >
          {t('common.return_to_home')}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <button 
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> {t('common.back') || 'Back'}
      </button>

      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900">{t('seller_verification.title')}</h1>
        <p className="text-slate-500 mt-2">{t('seller_verification.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Personal Information */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
              <User className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900">{t('seller_verification.personal_info')}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t('seller_verification.first_name')}</label>
              <input 
                required
                type="text"
                value={formData.firstName}
                onChange={e => setFormData({...formData, firstName: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t('seller_verification.father_name')}</label>
              <input 
                required
                type="text"
                value={formData.fatherName}
                onChange={e => setFormData({...formData, fatherName: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
                placeholder="Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t('seller_verification.grandfather_name')}</label>
              <input 
                required
                type="text"
                value={formData.grandfatherName}
                onChange={e => setFormData({...formData, grandfatherName: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
                placeholder="Smith"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t('seller_verification.phone_number')}</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                required
                type="tel"
                value={formData.phoneNumber}
                onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
                placeholder="+251 900 000 000"
              />
            </div>
          </div>
        </div>

        {/* ID Verification */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
              <IdCard className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900">{t('seller_verification.id_verification')}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {/* Front of ID */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">{t('seller_verification.id_front')}</p>
              <div 
                className={`relative aspect-[1.6/1] rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-4 text-center ${
                  idFrontPreview ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-400'
                }`}
              >
                {idFrontPreview ? (
                  <LazyImage src={idFrontPreview} alt="ID Front" className="w-full h-full rounded-xl" />
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <p className="text-xs text-slate-500">{t('seller_verification.upload_hint')}</p>
                  </>
                )}
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={e => handleFileChange(e, 'front')}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
            </div>

            {/* Back of ID */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">{t('seller_verification.id_back')}</p>
              <div 
                className={`relative aspect-[1.6/1] rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-4 text-center ${
                  idBackPreview ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-400'
                }`}
              >
                {idBackPreview ? (
                  <LazyImage src={idBackPreview} alt="ID Back" className="w-full h-full rounded-xl" />
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <p className="text-xs text-slate-500">{t('seller_verification.upload_hint')}</p>
                  </>
                )}
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={e => handleFileChange(e, 'back')}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-slate-900 text-white py-4 rounded-2xl font-semibold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2 disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('seller_verification.submitting')}
            </>
          ) : (
            t('seller_verification.submit_button')
          )}
        </button>
      </form>
    </div>
  );
};
