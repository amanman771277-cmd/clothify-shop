import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Handle redirect result if falling back to signInWithRedirect
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
}).catch(console.error);

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Save user to Firestore
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
  } catch (error: any) {
    console.error("Error signing in with Google", error);
    
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
      const isIframe = window !== window.parent;
      if (!isIframe) {
         // Silently fallback to redirect for mobile devices / standard browsing if popup fails
         await signInWithRedirect(auth, googleProvider);
      } else if (error.code === 'auth/popup-blocked') {
         alert('The login popup was blocked by your browser. Please allow popups for this site.');
      }
    } else if (error.code === 'auth/popup-closed-by-user') {
      // User closed the popup, no need to alert
    } else {
      // Use standard alert without crashing
      if (!error.message.includes('auth/cancelled-popup-request')) {
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
