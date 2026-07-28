import { useEffect } from 'react';

/**
 * Keeps the screen awake while `enabled` is true (e.g. during an active session).
 * Re-acquires the lock when the tab becomes visible again.
 */
export function useScreenWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) {
      return;
    }

    let wakeLock: WakeLockSentinel | null = null;
    let cancelled = false;

    const requestLock = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;

      try {
        wakeLock = await navigator.wakeLock!.request('screen');
        wakeLock.addEventListener('release', () => {
          wakeLock = null;
        });
      } catch {
        wakeLock = null;
      }
    };

    const releaseLock = async () => {
      if (!wakeLock) return;
      try {
        await wakeLock.release();
      } catch {
        // Ignore release errors.
      }
      wakeLock = null;
    };

    void requestLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void requestLock();
      } else {
        void releaseLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      void releaseLock();
    };
  }, [enabled]);
}
