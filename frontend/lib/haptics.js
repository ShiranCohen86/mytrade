/**
 * Tiny haptic-feedback helper (Vibration API). No-ops where unsupported (iOS
 * Safari) or when the user prefers reduced motion. Patterns are intentionally
 * short so feedback feels native, not buzzy.
 */
const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

function reducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export function haptic(pattern = 10) {
  if (!canVibrate || reducedMotion()) return;
  try { navigator.vibrate(pattern); } catch { /* ignore */ }
}

export const tapLight = () => haptic(8);
export const tapMedium = () => haptic(14);
export const tapSuccess = () => haptic([12, 40, 18]);
export const tapWarning = () => haptic([18, 50, 18]);
export const tapError = () => haptic([28, 45, 28]);

export default { haptic, tapLight, tapMedium, tapSuccess, tapWarning, tapError };
