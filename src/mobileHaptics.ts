const HAPTICS_STORAGE_KEY = 'terra16_haptics_v1';

export function loadHapticsPreference(): boolean {
  try {
    const saved = localStorage.getItem(HAPTICS_STORAGE_KEY);
    if (saved === null) return true;
    return saved !== '0';
  } catch {
    return true;
  }
}

export function saveHapticsPreference(enabled: boolean): void {
  try {
    localStorage.setItem(HAPTICS_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // Ignore storage quota restrictions
  }
}

export function isVibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function triggerHapticPattern(enabled: boolean, pattern: number | number[]): boolean {
  if (!enabled || !isVibrationSupported()) return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

/** Short crisp confirmation tap when toggling a field setting */
export function vibrateToggleTap(enabled = true): boolean {
  return triggerHapticPattern(enabled, 28);
}

/** Double compass pulse when walking near an undiscovered '?' seal (<= 135 m) */
export function vibrateMysterySealNearby(enabled: boolean): boolean {
  return triggerHapticPattern(enabled, [45, 45, 80]);
}

/** Triple whisper pulse when entering the vicinity of an active NPC rumor lead (<= 150 m) */
export function vibrateRumorLeadNearby(enabled: boolean): boolean {
  return triggerHapticPattern(enabled, [35, 35, 35, 35, 70]);
}

/** Telluric detector pulse when entering the 160 m halo of a buried chest or player geocache */
export function vibrateBuriedTreasureWarm(enabled: boolean): boolean {
  return triggerHapticPattern(enabled, [55, 55, 95]);
}

/** Rapid heartbeat pulse when within 55 m of a buried Archivist Chest or Explorer Capsule */
export function vibrateBuriedTreasureHot(enabled: boolean): boolean {
  return triggerHapticPattern(enabled, [70, 35, 70, 35, 125]);
}

/** Celebratory pulse when unlocking a discovery, unsealing a chest, or earning a 16-bit trophy */
export function vibrateUnlockCelebration(enabled: boolean): boolean {
  return triggerHapticPattern(enabled, [85, 45, 130]);
}
