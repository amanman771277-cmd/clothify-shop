import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { registerSW } from 'virtual:pwa-register';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PWAContextType {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  showInstallBanner: boolean;
  showIOSGuide: boolean;
  isOnline: boolean;
  setShowIOSGuide: (open: boolean) => void;
  install: () => Promise<boolean>;
  dismissBanner: () => void;
}

const DISMISS_STORAGE_KEY = 'clothify_pwa_banner_dismissed_at';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DWELL_DELAY_MS = 10_000; // 10 seconds

const PWAContext = createContext<PWAContextType | undefined>(undefined);

export const PWAProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [hasDwelled10s, setHasDwelled10s] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY);
      if (!raw) return false;
      const dismissedAt = Number(raw);
      return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
    } catch {
      return false;
    }
  });
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Register Service Worker
  useEffect(() => {
    registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        if (registration) {
          registration.update().catch(() => {});
        }
      },
      onRegisterError(error) {
        console.warn('Service Worker registration error:', error);
      },
    });
  }, []);

  // Detect standalone mode, iOS Safari, beforeinstallprompt, appinstalled, and online/offline
  useEffect(() => {
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    const checkStandalone = () => {
      const standalone =
        standaloneQuery.matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsInstalled(standalone);
    };

    checkStandalone();

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(userAgent) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowIOSGuide(false);
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    standaloneQuery.addEventListener?.('change', checkStandalone);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      standaloneQuery.removeEventListener?.('change', checkStandalone);
    };
  }, []);

  // 10-second dwell timer before surfacing the install banner
  useEffect(() => {
    if (isInstalled || isBannerDismissed) return;
    const timer = window.setTimeout(() => {
      setHasDwelled10s(true);
    }, DWELL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isInstalled, isBannerDismissed]);

  const dismissBanner = useCallback(() => {
    setIsBannerDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return true;
      }
      return false;
    }

    if (isIOS && !isInstalled) {
      setShowIOSGuide(true);
    }
    return false;
  }, [deferredPrompt, isIOS, isInstalled]);

  const isInstallable = !!deferredPrompt;
  const showInstallBanner =
    hasDwelled10s && !isBannerDismissed && !isInstalled && (isInstallable || isIOS);

  return (
    <PWAContext.Provider
      value={{
        isInstallable,
        isInstalled,
        isIOS,
        showInstallBanner,
        showIOSGuide,
        isOnline,
        setShowIOSGuide,
        install,
        dismissBanner,
      }}
    >
      {children}
    </PWAContext.Provider>
  );
};

export const usePWAInstall = () => {
  const ctx = useContext(PWAContext);
  if (!ctx) {
    throw new Error('usePWAInstall must be used within a PWAProvider');
  }
  return ctx;
};
