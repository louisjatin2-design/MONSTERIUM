/**
 * MONSTERIUM — unified responsive display system.
 *
 * This single module replaces the old pile of per-device `@media` breakpoints
 * (scale(0.85) here, scale(0.66) there, nudge the rails down by 14px …). Instead
 * of reacting to a handful of fixed cut-offs, it measures the live viewport and
 * derives ONE continuous scale factor that the whole floating UI — the top HUD
 * and the two vertical action rails — multiplies its transform by.
 *
 * The factor is published to the document root as the `--ui-scale` CSS custom
 * property (CSS falls back to 1 before this runs, so the first paint is already
 * at the authored size). It is recomputed on every resize, orientation flip and
 * mobile address-bar show/hide, so the layout fits any display continuously.
 *
 * Design goals:
 *   • The tall 7-button left action rail always fits the screen height.
 *   • Buttons never shrink below a comfortably tappable size (MIN_SCALE floor).
 *   • Large monitors get slightly bigger, easier-to-hit controls (MAX_SCALE).
 *   • Identical behaviour in portrait and landscape — it only looks at height.
 */

// Reference viewport height (px) at which the chrome renders at its authored
// size (≈ a typical phone in portrait). Taller screens scale the controls up a
// touch, shorter ones down, so everything stays on-screen and tappable.
const REF_H = 667;

// Clamp so controls stay readable/pressable on short screens and don't balloon
// on tall ones. The floor keeps the left rail tappable even on a short landscape
// phone; the ceiling keeps the HUD from overflowing a wide desktop.
const MIN_SCALE = 0.66;
const MAX_SCALE = 1.1;

function viewport() {
  const vv = window.visualViewport;
  return {
    w: (vv && vv.width)  || window.innerWidth,
    h: (vv && vv.height) || window.innerHeight,
  };
}

function apply() {
  const { w, h } = viewport();
  const root = document.documentElement.style;

  // iOS Safari "100vh" fix (tracks the address bar) + expose the width for any
  // fluid layout that wants it. Panels already read --vh via var(--vh, 1vh).
  root.setProperty('--vh', h * 0.01 + 'px');
  root.setProperty('--vw', w * 0.01 + 'px');

  // Height is the binding constraint for the vertical rails, so scale off it.
  const raw = h / REF_H;
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, raw));
  root.setProperty('--ui-scale', scale.toFixed(3));
}

let installed = false;

/**
 * Start tracking the viewport and keeping `--ui-scale` / `--vh` / `--vw` in
 * sync. Safe to call more than once. Call before React renders so the very
 * first frame is already fitted.
 */
export function installResponsiveScaling() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  apply();
  window.addEventListener('resize', apply);
  // Orientation flips report the new size a beat late on iOS — re-fit shortly
  // after so portrait/landscape both land correctly.
  window.addEventListener('orientationchange', () => setTimeout(apply, 200));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', apply);
}
