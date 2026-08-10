import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  MEMBER_ACTIVITY_HEARTBEAT_INTERVAL_MS,
  isActivityHeartbeatDue,
} from '../lib/memberActivity';

const storageKeyFor = (userId: string) => `carleton-member-activity:v1:${userId}`;

const readLastRecordedAt = (key: string) => {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};

const storeLastRecordedAt = (key: string, value: number) => {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Activity tracking remains best-effort if browser storage is unavailable.
  }
};

export const MemberActivityHeartbeat = () => {
  const { user } = useAuth();
  const lastRecordedRef = useRef<number | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) {
      lastRecordedRef.current = null;
      return;
    }

    const storageKey = storageKeyFor(userId);
    lastRecordedRef.current = readLastRecordedAt(storageKey);
    let disposed = false;
    let inFlight = false;

    const recordActivity = async () => {
      if (
        disposed
        || document.visibilityState !== 'visible'
        || inFlight
      ) return;

      const now = Date.now();
      if (!isActivityHeartbeatDue(lastRecordedRef.current, now)) return;

      inFlight = true;
      try {
        const { error } = await supabase.functions.invoke('member-activity', {
          body: { action: 'heartbeat' },
        });
        if (!disposed && !error) {
          lastRecordedRef.current = now;
          storeLastRecordedAt(storageKey, now);
        }
      } catch {
        // A missed heartbeat is harmless and will be retried later.
      } finally {
        inFlight = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void recordActivity();
    };

    void recordActivity();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const intervalId = window.setInterval(
      () => void recordActivity(),
      MEMBER_ACTIVITY_HEARTBEAT_INTERVAL_MS,
    );

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [userId]);

  return null;
};
