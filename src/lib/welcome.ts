// Shared key + helpers for the once-per-login welcome popup.
// The flag lives in sessionStorage so a page refresh within the same session
// won't re-show the popup, but signing out (or a fresh login) clears it so it
// appears again on the next successful authentication.
export const WELCOME_SEEN_KEY = "spl-welcome-seen";

export function resetWelcome() {
  try {
    sessionStorage.removeItem(WELCOME_SEEN_KEY);
  } catch {
    /* sessionStorage unavailable — ignore */
  }
}
