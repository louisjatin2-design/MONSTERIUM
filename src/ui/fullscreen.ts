/**
 * MONSTERIUM — force browser fullscreen.
 *
 * Hides the browser's top chrome (address/tab bar) by entering the Fullscreen
 * API so the game owns the whole display. Browsers only grant fullscreen from
 * inside a real user gesture, so we can't just call it on load — instead we arm
 * a one-shot listener and fire on the player's very first tap/click/keypress.
 * After that gesture the request is allowed and the bar disappears.
 *
 * Notes:
 *   • iPhone Safari has no Fullscreen API; the address bar there is hidden by
 *     the `apple-mobile-web-app-capable` meta tag (Add-to-Home-Screen) and by
 *     the existing scroll-locking CSS — this module is a no-op on that browser.
 *   • If the user presses Esc / leaves fullscreen, we re-arm so the next gesture
 *     puts us back, keeping the chrome hidden for the rest of the session.
 */

type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

function fullscreenElement(): Element | null {
  const d = document as FsDocument;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

function isFullscreen(): boolean {
  return fullscreenElement() !== null;
}

function supportsFullscreen(): boolean {
  const el = document.documentElement as FsElement;
  return typeof el.requestFullscreen === 'function'
      || typeof el.webkitRequestFullscreen === 'function'
      || typeof el.msRequestFullscreen === 'function';
}

function request(): void {
  if (isFullscreen()) return;
  const el = document.documentElement as FsElement;
  // Promise rejects if the gesture was already "spent" (e.g. the click also
  // opened something) — swallow it; we'll get another shot on the next gesture.
  try {
    const p = (el.requestFullscreen?.bind(el)
            ?? el.webkitRequestFullscreen?.bind(el)
            ?? el.msRequestFullscreen?.bind(el))?.();
    if (p && typeof (p as Promise<void>).catch === 'function') {
      (p as Promise<void>).catch(() => { /* re-armed by the gesture listener */ });
    }
  } catch {
    /* ignore — try again on the next gesture */
  }
}

let installed = false;

/**
 * Arm the first-gesture fullscreen request. Safe to call more than once.
 */
export function installForceFullscreen(): void {
  if (installed || typeof window === 'undefined') return;
  if (!supportsFullscreen()) return;
  installed = true;

  const GESTURES = ['pointerdown', 'click', 'keydown', 'touchend'] as const;

  const onGesture = () => {
    if (isFullscreen()) return;
    request();
  };

  for (const ev of GESTURES) {
    // Passive so we never block the game's own input handling.
    window.addEventListener(ev, onGesture, { passive: true });
  }
}
