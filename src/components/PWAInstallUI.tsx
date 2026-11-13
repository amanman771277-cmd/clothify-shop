import React from 'react';
import { Download, Smartphone, Share, PlusSquare, X, WifiOff } from 'lucide-react';
import { usePWAInstall } from '../contexts/PWAContext';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  if (isInstalled || (!isInstallable && !isIOS)) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => void install()}
      aria-label="Install Clothify App"
      className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
    >
      <Download className="w-4 h-4 shrink-0" />
      <span className="hidden sm:inline">Install App</span>
      <span className="sm:hidden">Install</span>
    </button>
  );
};

export const PWAInstallBanner: React.FC = () => {
  const { showInstallBanner, showIOSGuide, setShowIOSGuide, install, dismissBanner } =
    usePWAInstall();

  return (
    <>
      {showInstallBanner && (
        <div
          role="region"
          aria-label="Install Clothify App"
          className="bg-slate-900 text-white border-b border-slate-800 transition-all duration-200 ease-out"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-100 truncate">
                Install Clothify App for faster access <span className="text-slate-400 hidden sm:inline">· አፑን በስልክዎ ላይ ይጫኑ</span>
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => void install()}
                className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                Install App
              </button>
              <button
                type="button"
                onClick={dismissBanner}
                aria-label="Dismiss install banner"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {showIOSGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-install-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="ios-install-title" className="text-base font-bold text-slate-900">
                  Install Clothify on iPhone / iPad
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">በ Safari ላይ ወደ Home Screen ያክሉ</p>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                aria-label="Close guide"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ol className="mt-5 space-y-3.5 text-sm text-slate-700">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-900 font-semibold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  Tap the <Share className="w-4 h-4 inline mx-1 text-slate-900" />
                  <strong>Share</strong> button in your Safari toolbar.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-900 font-semibold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  Scroll down and tap <PlusSquare className="w-4 h-4 inline mx-1 text-slate-900" />
                  <strong>Add to Home Screen</strong>.
                </span>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-6 w-full min-h-[44px] rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              Got it / ተረድቻለሁ
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const { isOnline } = usePWAInstall();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg border border-amber-500"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Offline Mode · Cached content active</span>
    </div>
  );
};
