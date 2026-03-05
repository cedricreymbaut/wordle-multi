// ── Haptic feedback utility (mobile) ──────────────────────────────────────
function vibrate(pattern: number | number[]) {
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  } catch { /* ignore */ }
}

export function vibrateKey() { vibrate(8); }
export function vibrateSubmit() { vibrate(15); }
export function vibrateError() { vibrate([30, 20, 30]); }
export function vibrateWin() { vibrate([50, 30, 50, 30, 80]); }
