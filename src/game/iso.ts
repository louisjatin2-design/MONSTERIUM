// Isometric projection helpers for the MONSTERIUM island.
// Classic 2:1 diamond projection. Grid coordinates (col, row) map to
// screen-space "world" coordinates inside the Phaser camera.

export const TILE_W = 64;        // diamond width
export const TILE_H = 32;        // diamond height (2:1 ratio)
export const GRID_COLS = 20;
export const GRID_ROWS = 15;

export const LAND_THICK = 52;    // deep rocky cliff under a land tile (floating island)
export const WATER_THICK = 6;    // unused — water tiles render as open sky

// Offsets chosen so the whole island sits in positive world space with margins.
export const ORIGIN_X = 520;
export const ORIGIN_Y = 110;

// Per-island world offset. The whole archipelago is drawn in one shared world
// space; before drawing (or projecting for) a given island the scene sets this
// offset so that island's tiles land at its geographic slot. project() and the
// sprite classes that call it all pick this up automatically, so an island's
// graphics, building silhouettes and depth all bake in its offset.
let OFFSET_X = 0;
let OFFSET_Y = 0;
export function setIsoOffset(x: number, y: number): void { OFFSET_X = x; OFFSET_Y = y; }
export function getIsoOffset(): { x: number; y: number } { return { x: OFFSET_X, y: OFFSET_Y }; }

// Project a (fractional) grid coordinate to a world-space point.
export function project(fx: number, fy: number): { x: number; y: number } {
  return {
    x: ORIGIN_X + OFFSET_X + (fx - fy) * (TILE_W / 2),
    y: ORIGIN_Y + OFFSET_Y + (fx + fy) * (TILE_H / 2),
  };
}

// Inverse: world-space point → grid cell (floored col/row), using the currently
// active iso offset.
export function worldToGrid(wx: number, wy: number): { col: number; row: number } {
  return worldToGridWithOffset(wx, wy, OFFSET_X, OFFSET_Y);
}

// Inverse for a SPECIFIC island offset — used when hit-testing a world point
// against every island's grid (the active offset alone can't tell us which
// island a tap landed on).
export function worldToGridWithOffset(wx: number, wy: number, ox: number, oy: number): { col: number; row: number } {
  const a = (wx - ORIGIN_X - ox) / (TILE_W / 2);
  const b = (wy - ORIGIN_Y - oy) / (TILE_H / 2);
  const fx = (a + b) / 2;
  const fy = (b - a) / 2;
  return { col: Math.floor(fx), row: Math.floor(fy) };
}

// Depth value so further-back tiles/objects render behind nearer ones.
export function tileDepth(col: number, row: number): number {
  return col + row;
}

// The four ground corners of a building footprint, in world space.
export function footprintCorners(tileX: number, tileY: number, w: number, h: number) {
  return {
    back:  project(tileX,     tileY),
    right: project(tileX + w, tileY),
    front: project(tileX + w, tileY + h),
    left:  project(tileX,     tileY + h),
  };
}

// Ray-casting point-in-polygon test. `poly` is a flat list of {x,y}.
export function pointInPolygon(px: number, py: number, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// World-space extents of the drawn island, for camera bounds.
export const CONTENT_W = ORIGIN_X + GRID_COLS * (TILE_W / 2) + TILE_W;        // ~1232
export const CONTENT_H = ORIGIN_Y + (GRID_COLS + GRID_ROWS) * (TILE_H / 2) + 80; // ~750
export const ISLAND_CENTER = project(GRID_COLS / 2, GRID_ROWS / 2);
