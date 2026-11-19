// The Vice City grade: pure per-pixel colour work on ImageData, no DOM, so it can be tested headlessly.
// applyNeonSunset remaps a photo through a neon-sunset gradient (deep violet shadows, magenta midtones,
// coral, orange, pale-gold highlights) while keeping the photo's own luminance detail, then blends the
// result with the original by `strength`. applyHalftone re-inks an image as print dots, GTA-poster style.

/** Gradient stops of the neon-sunset ramp: [luminance 0..1, r, g, b]. */
const SUNSET_STOPS = [
  [0.0, 26, 9, 48],
  [0.3, 96, 24, 102],
  [0.52, 198, 44, 116],
  [0.7, 244, 92, 102],
  [0.86, 255, 152, 82],
  [1.0, 255, 224, 164],
];

/** The ramp's colour at luminance t (0..1), as [r, g, b]. */
export function sunsetRamp(t) {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < SUNSET_STOPS.length; i++) {
    const [p1, r1, g1, b1] = SUNSET_STOPS[i];
    if (x <= p1) {
      const [p0, r0, g0, b0] = SUNSET_STOPS[i - 1];
      const f = (x - p0) / (p1 - p0);
      return [r0 + (r1 - r0) * f, g0 + (g1 - g0) * f, b0 + (b1 - b0) * f];
    }
  }
  const [, r, g, b] = SUNSET_STOPS[SUNSET_STOPS.length - 1];
  return [r, g, b];
}

/**
 * Grades imageData in place. strength 0 leaves the photo untouched, 1 is the full neon-sunset remap.
 * The remap multiplies the ramp colour by the photo's own luminance so faces and detail survive the grade.
 */
export function applyNeonSunset(imageData, strength) {
  const s = Math.min(1, Math.max(0, strength));
  if (s <= 0) return imageData;
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const [gr, gg, gb] = sunsetRamp(lum);
    const keep = 0.3 + 0.95 * lum; // detail factor: ramp colour scaled by the pixel's own brightness
    d[i] = r + (gr * keep - r) * s;
    d[i + 1] = g + (gg * keep - g) * s;
    d[i + 2] = b + (gb * keep - b) * s;
  }
  return imageData;
}

/**
 * Re-inks imageData in place as halftone dots: each cell of `cell` pixels is filled with its average colour
 * lightened toward paper, and a dot of the average colour darkened toward ink is stamped in the middle,
 * its radius growing as the cell gets darker. Run after applyNeonSunset for the full poster treatment.
 */
export function applyHalftone(imageData, cell) {
  const { width, height, data } = imageData;
  const step = Math.max(3, Math.round(cell));
  for (let cy = 0; cy < height; cy += step) {
    for (let cx = 0; cx < width; cx += step) {
      const x1 = Math.min(width, cx + step);
      const y1 = Math.min(height, cy + step);
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let y = cy; y < y1; y++) {
        for (let x = cx; x < x1; x++) {
          const i = (y * width + x) * 4;
          sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; n++;
        }
      }
      const ar = sr / n, ag = sg / n, ab = sb / n;
      const lum = (0.2126 * ar + 0.7152 * ag + 0.0722 * ab) / 255;
      const paper = [Math.min(255, ar * 1.25 + 26), Math.min(255, ag * 1.25 + 26), Math.min(255, ab * 1.25 + 26)];
      const ink = [ar * 0.45, ag * 0.45, ab * 0.45];
      const radius = (1 - lum) * step * 0.72;
      const midX = (cx + x1 - 1) / 2, midY = (cy + y1 - 1) / 2;
      for (let y = cy; y < y1; y++) {
        for (let x = cx; x < x1; x++) {
          const i = (y * width + x) * 4;
          const inDot = (x - midX) * (x - midX) + (y - midY) * (y - midY) <= radius * radius;
          const c = inDot ? ink : paper;
          data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2];
        }
      }
    }
  }
  return imageData;
}
