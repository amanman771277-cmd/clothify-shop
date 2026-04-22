import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Catch the user returning from Google after signInWithRedirect
// We no longer need to save the user to Firestore here, as AuthContext handles it via onAuthStateChanged
getRedirectResult(auth).catch((error) => {
  console.error("Redirect Login Error:", error);
});

export const loginWithGoogle = async () => {
  const isIframe = window !== window.parent;
  
  // 1. If in an iframe (e.g., AI Studio Preview), always try Popup because Redirect might be blocked.
  if (isIframe) {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch(err: any) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        alert(`Login failed (Preview): ${err.message}`);
      }
    }
    return;
  }

  // 2. Outside iframe (Online Website). Mobile browsers commonly block popups or open "about:blank"
  //    so we explicitly use Direct Redirect for them without trying Popup first.
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (isMobile) {
    // Navigate directly without showing about:blank
    await signInWithRedirect(auth, googleProvider);
  } else {
    // Desktop Online Website - Try Popup first
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Error signing in with Google:", error);
      
      // If popup fails or is blocked on desktop too, fallback to Redirect
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request' || error.message?.includes('about:blank')) {
        await signInWithRedirect(auth, googleProvider);
      } else if (error.code !== 'auth/popup-closed-by-user') {
        alert(`Login failed: ${error.message}`);
      }
    }
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
  }
};
