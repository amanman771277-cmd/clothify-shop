import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Eye, EyeOff } from 'lucide-react';

export const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleResetPassword = async () => {
    if (!email) {
      setError('Password (ፓስዎርድ) ለመቀየር እባክዎ መጀመሪያ ኢሜልዎትን ከላይ ባለው ሳጥን ውስጥ ያስገቡ።');
      return;
    }
    setResetLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg(`ወደ ${email} ኢሜል ልከንልዎታል። እባክዎ ኢሜልዎ ውስጥ ገብተው የላክንልዎትን ሊንክ በመጫን አዲስ ፓስዎርድ ይስጡት። በመቀጠል እዚህ ተመልሰው አዲሱን ፓስዎርድ በማስገባት Log in ይበሉ!`);
    } catch (err: any) {
      console.error(err);
      setError('ኢሜል መላክ አልተቻለም። እባክዎ ኢሜልዎን በትክክል ማስገባትዎን ያረጋግጡ።');
    } finally {
      setResetLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const newUser = result.user;
        
        // Ensure user is in database
        const userRef = doc(db, 'users', newUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: newUser.uid,
            email: newUser.email,
            displayName: name.trim() || 'User',
            photoURL: '',
            role: 'user',
            createdAt: new Date()
          });
        }
      }
      navigate('/');
    } catch (err: any) {
      console.error(err);
      let message = err.message || 'Authentication failed';
      
      if (err.code === 'auth/invalid-credential' || message.includes('auth/invalid-credential') || message.includes('invalid-credential')) {
        message = 'ያስገቡት ኢሜል ወይም ፓስዎርድ (Password) ትክክል አይደለም። እባክዎ በትክክል መጻፍዎን ያረጋግጡ። ከዚህ ቀደም በ Google Login ገብተው ከነበረ፣ ከታች "Forgot password? / ፓስዎርድ ረሱ?" የሚለውን ነክተው አዲስ ፓስዎርድ ማዘጋጀት ይችላሉ።';
      } else if (err.code === 'auth/email-already-in-use' || message.includes('auth/email-already-in-use')) {
        message = 'ይህ ኢሜል ከዚህ ቀደም ተመዝግቧል። እባክዎ "Log in / ይግቡ" የሚለውን መርጠው ለመግባት ይሞክሩ። ፓስዎርድ ከረሱት "Forgot password? / ፓስዎርድ ረሱ?" የሚለውን መጠቀም ይችላሉ።';
      } else if (err.code === 'auth/weak-password') {
        message = 'የመረጡት ፓስዎርድ በጣም አጭር ነው። እባክዎ ቢያንስ 6 ፊደላት/ቁጥሮች ያድርጉት።';
      } else if (err.code === 'auth/invalid-email') {
        message = 'ያስገቡት ኢሜል የተሳሳተ ቅርፅ አለው። እባክዎ በትክክል ያስገቡ።';
      }
      
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center bg-slate-50/50 px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-md w-full space-y-8 p-8 bg-white border border-slate-200 rounded-3xl shadow-sm">
        <div>
          <h2 className="mt-2 text-center text-3xl font-bold text-slate-900 tracking-tight">
            {isLogin ? 'Log in / ይግቡ' : 'Sign Up / ይመዝገቡ'}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            {isLogin ? "Don't have an account? / መለያ የለዎትም? " : "Already have an account? / መለያ አለዎት? "}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setSuccessMsg('');
              }}
              className="font-semibold text-emerald-600 hover:text-emerald-500 transition-colors underline ml-1"
            >
              {isLogin ? 'Sign up / ይመዝገቡ' : 'Log in / ይግቡ'}
            </button>
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3.5 rounded-xl text-sm leading-relaxed border border-red-100">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 text-emerald-700 p-3.5 rounded-xl text-sm leading-relaxed border border-emerald-100">
            {successMsg}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name / ሙሉ ስም</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="appearance-none relative block w-full px-4 py-2.5 border border-slate-200 rounded-xl placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 sm:text-sm transition-all"
                  placeholder="John Doe"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email address / ኢሜል</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none relative block w-full px-4 py-2.5 border border-slate-200 rounded-xl placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 sm:text-sm transition-all"
                placeholder="you@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password / ፓስዎርድ</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none relative block w-full pl-4 pr-12 py-2.5 border border-slate-200 rounded-xl placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 sm:text-sm transition-all"
                  placeholder="Min 6 characters"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end">
            {isLogin && (
              <div className="text-sm">
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={resetLoading}
                  className="font-medium text-emerald-600 hover:text-emerald-500 transition-colors disabled:opacity-70"
                >
                  {resetLoading ? 'Sending...' : 'Forgot your password? / ፓስዎርድ ረሱ?'}
                </button>
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-slate-950 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-950 disabled:opacity-70 transition-all shadow-sm"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'Log in / ይግቡ' : 'Sign up / ይመዝገቡ')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
