// Short, soft vibration for moments worth a physical nudge (completing a
// bucket-list dream, saving a gasto, unlocking a gift) — pairs with the
// confetti/burst those actions already trigger. No-ops silently on devices
// or browsers without the Vibration API (iOS Safari, desktop, etc).
export function vibrateSuccess() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(40);
  }
}
