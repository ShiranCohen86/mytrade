/**
 * Single-slot coordinator for the app's "system" dialogs (update / install /
 * notification opt-in) so they never stack. Priority is enforced by call order:
 * update claims first, then install, then notifications. When the holder
 * releases, a 'mytrade:prompt-slot-free' event lets the next one appear.
 */
let holder = null;

export function claimSlot(id) {
  if (holder && holder !== id) return false;
  holder = id;
  return true;
}

export function releaseSlot(id) {
  if (holder !== id) return;
  holder = null;
  try { window.dispatchEvent(new Event('mytrade:prompt-slot-free')); } catch { /* ignore */ }
}

export function isSlotFree() {
  return holder === null;
}

export const SLOT_FREE_EVENT = 'mytrade:prompt-slot-free';
