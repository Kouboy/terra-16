import { useCallback, useEffect, useRef, useState } from 'react';

const WAKE_LOCK_STORAGE_KEY = 'terra16_wake_lock_v1';

interface WakeLockSentinelLike extends EventTarget {
  readonly released?: boolean;
  release(): Promise<void>;
}

type NavigatorMaybeWakeLock = {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinelLike>;
  };
};

function getWakeLockApi(): NavigatorMaybeWakeLock['wakeLock'] | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as unknown as NavigatorMaybeWakeLock).wakeLock;
}

function loadWakeLockWanted(): boolean {
  try {
    return localStorage.getItem(WAKE_LOCK_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveWakeLockWanted(wanted: boolean): void {
  try {
    localStorage.setItem(WAKE_LOCK_STORAGE_KEY, wanted ? '1' : '0');
  } catch {
    // Ignore storage quota restrictions
  }
}

/**
 * Resilient Screen Wake Lock hook for outdoor Android / mobile walking sessions.
 * Automatically re-acquires the sentinel after tab/app switches (`visibilitychange`)
 * and after user gestures if initial acquisition was deferred by browser policy.
 */
export function useScreenWakeLock() {
  const [wakeLockSupported] = useState<boolean>(() => Boolean(getWakeLockApi()?.request));
  const [wakeLockWanted, setWakeLockWanted] = useState<boolean>(() => loadWakeLockWanted());
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const wantedRef = useRef<boolean>(wakeLockWanted);
  wantedRef.current = wakeLockWanted;

  const releaseCurrentLock = useCallback(async () => {
    const current = sentinelRef.current;
    sentinelRef.current = null;
    setWakeLockActive(false);
    if (current) {
      try {
        await current.release();
      } catch {
        // Ignore already-released sentinel
      }
    }
  }, []);

  const acquireLock = useCallback(async (): Promise<boolean> => {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return false;
    const wakeLockApi = getWakeLockApi();
    if (!wakeLockApi?.request) return false;

    if (sentinelRef.current && !sentinelRef.current.released) {
      setWakeLockActive(true);
      return true;
    }

    try {
      const sentinel = await wakeLockApi.request('screen');
      if (!wantedRef.current) {
        sentinel.release().catch(() => {});
        return false;
      }
      sentinelRef.current = sentinel;
      setWakeLockActive(true);

      const handleRelease = () => {
        if (sentinelRef.current === sentinel) {
          sentinelRef.current = null;
          setWakeLockActive(false);
        }
      };
      sentinel.addEventListener('release', handleRelease, { once: true });
      return true;
    } catch {
      // Blocked by iframe permissions policy, low battery saver, or awaiting user gesture
      setWakeLockActive(false);
      return false;
    }
  }, []);

  useEffect(() => {
    saveWakeLockWanted(wakeLockWanted);
    if (!wakeLockWanted) {
      releaseCurrentLock();
      return;
    }

    acquireLock();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wantedRef.current) {
        acquireLock();
      }
    };

    const onUserGesture = () => {
      if (wantedRef.current && !sentinelRef.current) {
        acquireLock();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pointerdown', onUserGesture, { passive: true });

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pointerdown', onUserGesture);
    };
  }, [wakeLockWanted, acquireLock, releaseCurrentLock]);

  useEffect(() => {
    return () => {
      if (sentinelRef.current) {
        sentinelRef.current.release().catch(() => {});
        sentinelRef.current = null;
      }
    };
  }, []);

  const toggleWakeLock = useCallback(async (): Promise<boolean> => {
    const next = !wantedRef.current;
    wantedRef.current = next;
    setWakeLockWanted(next);
    if (next) {
      return acquireLock();
    }
    await releaseCurrentLock();
    return false;
  }, [acquireLock, releaseCurrentLock]);

  return {
    wakeLockSupported,
    wakeLockWanted,
    wakeLockActive,
    setWakeLockWanted,
    toggleWakeLock,
  };
}
