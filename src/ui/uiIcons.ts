// ---------------------------------------------------------------------------
// UI button icons (drop-in)
//
// Lets you replace the emoji on the floating action buttons with your own image
// icons (e.g. the round neon emblems) WITHOUT touching component code.
//
//   • Drop an image into  src/assets/ui/icons/<name>.png   (png/webp/jpg/svg)
//
// The <name> is the button's icon slot (see the table in that folder's README,
// and the `iconName` passed by each button). Files are auto-discovered at build
// time via Vite's import.meta.glob; if a slot has no file, the button keeps its
// emoji fallback.
// ---------------------------------------------------------------------------
const ICON_URLS = import.meta.glob('/src/assets/ui/icons/*.{png,webp,jpg,jpeg,svg}', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;

function baseName(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.(png|webp|jpe?g|svg)$/i, '').toLowerCase();
}

const byName = new Map<string, string>(
  Object.entries(ICON_URLS).map(([p, url]) => [baseName(p), url]),
);

/** URL of the custom icon for a button slot, or undefined to use the emoji. */
export function uiIcon(name: string | undefined): string | undefined {
  if (!name) return undefined;
  return byName.get(name.toLowerCase());
}
