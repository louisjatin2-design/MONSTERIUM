import Phaser from 'phaser';

// Fixed design resolution. The battle, main-menu and minigame scenes all lay
// their content out inside this 1280×720 space, and we scale each scene's
// camera so that space FITS the live viewport (letterboxing any leftover
// margin). Because the layout never depends on the live canvas size, the exact
// same scene stays fully on-screen and every control reachable in BOTH portrait
// and landscape — and an orientation flip simply re-fits the camera instead of
// stranding cards / buttons off-screen (which is what made fights impossible).
export const DESIGN_W = 1280;
export const DESIGN_H = 720;

/**
 * Lock a scene to the fixed design resolution and keep its camera fitted to the
 * live viewport, re-fitting automatically whenever the viewport changes size
 * (window resize / orientation flip). Returns the apply function in case the
 * caller wants to re-fit manually.
 */
export function setupFixedViewport(scene: Phaser.Scene, designW = DESIGN_W, designH = DESIGN_H) {
  const cam = scene.cameras.main;

  const apply = () => {
    const z = Math.min(scene.scale.width / designW, scene.scale.height / designH);
    cam.setZoom(z);
    // Centre the design space inside the viewport so any letterbox margin is
    // split evenly around it.
    cam.centerOn(designW / 2, designH / 2);
  };

  apply();
  scene.scale.on(Phaser.Scale.Events.RESIZE, apply);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.scale.off(Phaser.Scale.Events.RESIZE, apply);
  });

  return apply;
}
