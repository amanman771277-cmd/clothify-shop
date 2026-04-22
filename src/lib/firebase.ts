import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize provider with custom parameters if needed
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Handle redirect result seamlessly when the page loads after a redirect
getRedirectResult(auth).then(async (result) => {
  if (result?.user) {
    const user = result.user;
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'User',
        photoURL: user.photoURL || '',
        role: 'user',
        createdAt: new Date()
      });
    }
  }
}).catch((error) => {
  console.error("Redirect result error:", error);
  // We only alert if it's a real failure, not just an empty state
  if (error && error.code !== 'auth/redirect-cancelled-by-user') {
    alert(`Login redirection failed: ${error.message}`);
  }
});

let isLoggingIn = false;

export const loginWithGoogle = async () => {
  if (isLoggingIn) return;
  isLoggingIn = true;
  
  try {
    const isIframe = window !== window.parent;
    
    // For AI Studio Preview (iframe), use popup. For actual website deployed/Phone, use redirect.
    if (isIframe) {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'User',
          photoURL: user.photoURL || '',
          role: 'user',
          createdAt: new Date()
        });
      }
    } else {
      // Unconditional redirect for actual deployment to avoid popup blocks on mobile
      await signInWithRedirect(auth, googleProvider);
    }
  } catch (error: any) {
    console.error("Error signing in with Google", error);
    if (error.code === 'auth/popup-blocked') {
      alert('The login popup was blocked by your browser. Please allow popups for this site.');
    } else if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      // Ignored for UX
    } else {
      alert(`Login failed: ${error.message}`);
    }
  } finally {
    isLoggingIn = false;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
  }
};
