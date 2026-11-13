import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';

export const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, signInWithGoogle, authError, clearAuthError } = useAuth();

  useEffect(() => {
    return () => {
      clearAuthError();
    };
  }, [clearAuthError]);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const success = await signInWithGoogle();
    setLoading(false);
    if (success) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center bg-slate-50/50 px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-md w-full space-y-8 p-8 bg-white border border-slate-200 rounded-3xl shadow-sm text-center">
        <div>
          <h2 className="mt-2 text-center text-3xl font-bold text-slate-900 tracking-tight">
            Welcome to Clothify
          </h2>
          <p className="mt-4 text-center text-sm text-slate-600">
            Please sign in to continue / ለመቀጠል እባክዎ ይግቡ
          </p>
        </div>

        {authError && (
          <div
            role="alert"
            className="bg-red-50 text-red-700 p-3.5 rounded-xl text-sm leading-relaxed border border-red-200 text-left flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
            <span>{authError}</span>
          </div>
        )}

        <div className="pt-4">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="group relative w-full flex items-center justify-center gap-3 py-3 px-4 border border-slate-200 text-sm font-semibold rounded-xl text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-70 transition-all shadow-sm"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
