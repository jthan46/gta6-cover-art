// Fixed scenes for screenshots, in the kit's ?shot= pattern: ?shot=cover renders one finished cover
// full-bleed, ?shot=editor renders the editor with a sample photo loaded and composed. Both are
// deterministic — the photo is a bundled sample and the caption comes from the query — and each sets
// window.__shotReady once the scene has painted, so the capture tool knows when to shoot.

/** Loads an image from a URL inside app/, resolving once it can be drawn. */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`cannot load ${src}`));
    img.src = src;
  });
}

/** The bundled samples, by the name the ?shot= and sample buttons use. */
export const SAMPLES = [
  { name: 'boulevard', label: 'Neon Boulevard' },
  { name: 'pier', label: 'The Pier' },
  { name: 'beach', label: 'Palm Beach' },
];

/**
 * Runs the scene named by the query. `applyScene` is the editor's hook: it receives the loaded sample
 * image, the caption and whether this is the full-bleed cover, and composes the cover from them.
 */
export async function runShotScene(query, applyScene) {
  const shot = query.get('shot');
  const sample = SAMPLES.some((s) => s.name === query.get('photo')) ? query.get('photo') : 'boulevard';
  const caption = query.get('caption') ?? 'Sunset Heist';
  const img = await loadImage(`samples/${sample}.jpg`);
  if (shot === 'cover') document.body.classList.add('shot-cover');
  applyScene({ shot, img, sample, caption });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}
