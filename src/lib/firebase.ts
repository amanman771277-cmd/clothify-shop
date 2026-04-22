import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// IMPORTANT: Check for redirect results on page load
// This catches the user returning from Google after signInWithRedirect
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
  console.error("Redirect Login Error:", error);
});

export const loginWithGoogle = async () => {
  try {
    // 1. First try with Popup (works on Desktop and AI Studio Preview)
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
    console.error("Error signing in with Google:", error);
    
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
      // 2. If Popup fails (because of GitHub Pages COOP headers or Mobile Browser block)
      //    We fallback to Redirect method.
      const userAgrees = window.confirm(
        "የስልክዎ/የአሳሽዎ (Browser) Popup ስለተዘጋ በቀጥታ መግባት አልተቻለም።\n\nወደ Google Login Browser ልውሰድዎ?"
      );
      
      if (userAgrees) {
        // Redirection will change the window location to Google and return back.
        await signInWithRedirect(auth, googleProvider);
      }
    } else if (error.code === 'auth/popup-closed-by-user') {
      // User manually closed the popup, do nothing.
      console.log("User closed the popup.");
    } else {
      alert(`Login failed: ${error.message}`);
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
