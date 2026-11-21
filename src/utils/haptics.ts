import {Haptics, ImpactStyle, NotificationType} from '@capacitor/haptics';

let hapticsEnabledGlobal = true;

export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabledGlobal = enabled;
}

export async function triggerLightHaptic(): Promise<void> {
  if (!hapticsEnabledGlobal) return;
  try {
    await Haptics.impact({style: ImpactStyle.Light});
    return;
  } catch {
    // Web fallback when not inside Capacitor native shell
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(8);
    } catch {
      // ignore unsupported vibrate calls
    }
  }
}

export async function triggerSuccessHaptic(): Promise<void> {
  if (!hapticsEnabledGlobal) return;
  try {
    await Haptics.notification({type: NotificationType.Success});
    return;
  } catch {
    // Web fallback
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([10, 30, 12]);
    } catch {
      // ignore
    }
  }
}
