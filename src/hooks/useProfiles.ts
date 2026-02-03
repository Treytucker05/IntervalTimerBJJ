import { useState, useEffect, useCallback } from 'react';
import { TimerConfig, DEFAULT_CONFIG, ROLL_CONFIG, HIIT_CONFIG } from '../../types';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService } from '../../services/firestoreService';

const STORAGE_KEY = 'bjj-timer-profiles';
const DEFAULT_PROFILES = [DEFAULT_CONFIG, ROLL_CONFIG, HIIT_CONFIG];

function loadFromLocalStorage(): TimerConfig[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Corrupted data - fall through to defaults
  }
  return DEFAULT_PROFILES;
}

function saveToLocalStorage(profiles: TimerConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

function clearLocalStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

function mergeProfiles(local: TimerConfig[], cloud: TimerConfig[]): TimerConfig[] {
  const merged = new Map<string, TimerConfig>();

  // Add cloud profiles first (they take precedence)
  cloud.forEach(p => merged.set(p.id, p));

  // Add local profiles that don't exist in cloud
  local.forEach(p => {
    if (!merged.has(p.id)) {
      merged.set(p.id, p);
    }
  });

  return Array.from(merged.values());
}

export function useProfiles() {
  const { user, isLoading: authLoading } = useAuth();
  const [profiles, setProfiles] = useState<TimerConfig[]>(() => loadFromLocalStorage());
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // Sync with Firestore when user changes
  useEffect(() => {
    if (authLoading) return;

    async function syncProfiles() {
      if (user) {
        setIsSyncing(true);
        try {
          // Fetch cloud profiles
          const cloudProfiles = await firestoreService.fetchUserProfiles(user.uid);

          // Get local profiles
          const localProfiles = loadFromLocalStorage();

          // Merge them
          const merged = mergeProfiles(localProfiles, cloudProfiles);
          setProfiles(merged);

          // Sync merged profiles back to cloud
          for (const profile of merged) {
            await firestoreService.saveProfile(user.uid, profile);
          }

          // Clear local storage after successful sync
          clearLocalStorage();
          setLastSynced(new Date());
        } catch (error) {
          console.error('Failed to sync profiles:', error);
        } finally {
          setIsSyncing(false);
          setIsLoading(false);
        }
      } else {
        // Not logged in - use localStorage
        setProfiles(loadFromLocalStorage());
        setIsLoading(false);
      }
    }

    syncProfiles();
  }, [user, authLoading]);

  // Save to localStorage when profiles change (for anonymous users)
  useEffect(() => {
    if (!user && !isLoading) {
      saveToLocalStorage(profiles);
    }
  }, [profiles, user, isLoading]);

  const save = useCallback(async (profile: TimerConfig) => {
    // Update local state
    setProfiles(prev => {
      const exists = prev.some(p => p.id === profile.id);
      if (exists) {
        return prev.map(p => p.id === profile.id ? profile : p);
      }
      return [...prev, profile];
    });

    // Sync to cloud if logged in
    if (user) {
      setIsSyncing(true);
      try {
        await firestoreService.saveProfile(user.uid, profile);
        setLastSynced(new Date());
      } catch (error) {
        console.error('Failed to save profile to cloud:', error);
      } finally {
        setIsSyncing(false);
      }
    }
  }, [user]);

  const remove = useCallback(async (profileId: string) => {
    // Update local state
    setProfiles(prev => prev.filter(p => p.id !== profileId));

    // Sync to cloud if logged in
    if (user) {
      setIsSyncing(true);
      try {
        await firestoreService.deleteProfile(user.uid, profileId);
        setLastSynced(new Date());
      } catch (error) {
        console.error('Failed to delete profile from cloud:', error);
      } finally {
        setIsSyncing(false);
      }
    }
  }, [user]);

  return {
    profiles,
    save,
    remove,
    isLoading,
    isSyncing,
    lastSynced,
  };
}
