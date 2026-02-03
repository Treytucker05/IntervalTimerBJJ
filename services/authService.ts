import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../src/config/firebase';

const googleProvider = new GoogleAuthProvider();

export const authService = {
  async signInWithGoogle(): Promise<User | null> {
    if (!auth || !isFirebaseConfigured) {
      console.warn('Firebase not configured - auth disabled');
      return null;
    }
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  },

  async signInWithEmail(email: string, password: string): Promise<User | null> {
    if (!auth || !isFirebaseConfigured) {
      console.warn('Firebase not configured - auth disabled');
      return null;
    }
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  },

  async signUpWithEmail(email: string, password: string): Promise<User | null> {
    if (!auth || !isFirebaseConfigured) {
      console.warn('Firebase not configured - auth disabled');
      return null;
    }
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  },

  async signOut(): Promise<void> {
    if (!auth || !isFirebaseConfigured) {
      return;
    }
    await firebaseSignOut(auth);
  },

  getCurrentUser(): User | null {
    if (!auth || !isFirebaseConfigured) {
      return null;
    }
    return auth.currentUser;
  },
};
