import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, isFirebaseConfigured } from '../src/config/firebase';

export const storageService = {
  async uploadLogo(userId: string, file: File): Promise<string | null> {
    if (!storage || !isFirebaseConfigured) {
      // Fallback: return base64 for localStorage
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }

    const logoRef = ref(storage, `users/${userId}/logo`);
    await uploadBytes(logoRef, file);
    const url = await getDownloadURL(logoRef);
    return url;
  },

  async getLogoUrl(userId: string): Promise<string | null> {
    if (!storage || !isFirebaseConfigured) {
      return null;
    }

    try {
      const logoRef = ref(storage, `users/${userId}/logo`);
      return await getDownloadURL(logoRef);
    } catch {
      return null;
    }
  },
};
