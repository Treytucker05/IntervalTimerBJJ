import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../src/config/firebase';
import { TimerConfig } from '../types';

export interface FirestoreProfile extends TimerConfig {
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const firestoreService = {
  async fetchUserProfiles(userId: string): Promise<TimerConfig[]> {
    if (!db || !isFirebaseConfigured) {
      return [];
    }

    const profilesRef = collection(db, 'users', userId, 'profiles');
    const snapshot = await getDocs(profilesRef);

    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    })) as TimerConfig[];
  },

  async saveProfile(userId: string, profile: TimerConfig): Promise<void> {
    if (!db || !isFirebaseConfigured) {
      return;
    }

    const profileRef = doc(db, 'users', userId, 'profiles', profile.id);
    await setDoc(profileRef, {
      ...profile,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteProfile(userId: string, profileId: string): Promise<void> {
    if (!db || !isFirebaseConfigured) {
      return;
    }

    const profileRef = doc(db, 'users', userId, 'profiles', profileId);
    await deleteDoc(profileRef);
  },

  async saveUserData(userId: string, data: { displayName?: string; email?: string; logoUrl?: string }): Promise<void> {
    if (!db || !isFirebaseConfigured) {
      return;
    }

    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  },
};
