import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { storageService } from '../../services/storageService';
import { firestoreService } from '../../services/firestoreService';

const STORAGE_KEY = 'bjj-timer-logo';

function loadLogoFromLocalStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveLogoToLocalStorage(logo: string | null) {
  if (logo) {
    localStorage.setItem(STORAGE_KEY, logo);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function useLogo() {
  const { user, isLoading: authLoading } = useAuth();
  const [logo, setLogo] = useState<string | null>(() => loadLogoFromLocalStorage());
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch logo from cloud when user changes
  useEffect(() => {
    if (authLoading) return;

    async function fetchLogo() {
      if (user) {
        try {
          const cloudLogo = await storageService.getLogoUrl(user.uid);
          if (cloudLogo) {
            setLogo(cloudLogo);
          } else {
            // Use local logo if exists
            const localLogo = loadLogoFromLocalStorage();
            if (localLogo) {
              setLogo(localLogo);
            }
          }
        } catch (error) {
          console.error('Failed to fetch logo:', error);
        }
      } else {
        // Not logged in - use localStorage
        setLogo(loadLogoFromLocalStorage());
      }
      setIsLoading(false);
    }

    fetchLogo();
  }, [user, authLoading]);

  // Save to localStorage when logo changes (for anonymous users)
  useEffect(() => {
    if (!user && !isLoading) {
      saveLogoToLocalStorage(logo);
    }
  }, [logo, user, isLoading]);

  const uploadLogo = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      if (user) {
        // Upload to Firebase Storage
        const url = await storageService.uploadLogo(user.uid, file);
        if (url) {
          setLogo(url);
          // Save URL to user document
          await firestoreService.saveUserData(user.uid, { logoUrl: url });
        }
      } else {
        // Save as base64 in localStorage
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setLogo(base64);
          saveLogoToLocalStorage(base64);
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      console.error('Failed to upload logo:', error);
    } finally {
      setIsUploading(false);
    }
  }, [user]);

  const clearLogo = useCallback(async () => {
    setLogo(null);
    if (!user) {
      saveLogoToLocalStorage(null);
    }
    // Note: We don't delete from Storage - just clear the reference
  }, [user]);

  return {
    logo,
    uploadLogo,
    clearLogo,
    isLoading,
    isUploading,
  };
}
