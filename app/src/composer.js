// The cover composer: lays photos into the multi-panel GTA poster grid, grades each panel with the Vice
// City neon-sunset treatment, and letters the masthead and caption over the top. Pure canvas work — the
// editor calls renderCover on every change, and the export is the same render at full size.

import { applyHalftone, applyNeonSunset } from './grade.js';
import { drawCaption, drawOutlinedLine, drawTitleBlock } from './lettering.js';

/** The export sizes, the common post shapes: square, portrait and wide. */
export const EXPORT_SIZES = [
  { id: 'square', label: '1080 × 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: '1080 × 1350', w: 1080, h: 1350 },
  { id: 'wide', label: '1600 × 900', w: 1600, h: 900 },
];

/** Panel layouts as fractional rects [x, y, w, h] of the cover: a hero grid, a duo split, a triple strip. */
export const LAYOUTS = {
  hero: {
    label: 'Hero Grid',
    rects: [
      [0, 0, 0.58, 0.62],
      [0, 0.62, 0.58, 0.38],
      [0.58, 0, 0.42, 0.5],
      [0.58, 0.5, 0.42, 0.5],
    ],
  },
  duo: {
    label: 'Duo Split',
    rects: [
      [0, 0, 0.5, 1],
      [0.5, 0, 0.5, 1],
    ],
  },
  trio: {
    label: 'Triple Strip',
    rects: [
      [0, 0, 1 / 3, 1],
      [1 / 3, 0, 1 / 3, 1],
      [2 / 3, 0, 1 / 3, 1],
    ],
  },
};

/** The default cover: hero grid, full grade, the launch-week masthead. */
export function createCoverState() {
  return {
    layout: 'hero',
    sizeId: 'square',
    photos: [], // [{ img, label }] — loaded Image objects, in the order they were added
    panels: [0, 1, 2, 3].map(() => ({ photo: 0, zoom: 1, ox: 0.5, oy: 0.5 })),
    grade: 0.85,
    halftone: false,
    vignette: true,
    title: 'GRAND THEFT\nAUTO',
    numeral: 'VI',
    caption: 'Sunset Heist',
    highlight: -1, // editor-only: the panel outlined as selected; -1 letters no outline
  };
}

/** The size object for a state. */
export function coverSize(state) {
  return EXPORT_SIZES.find((s) => s.id === state.sizeId) ?? EXPORT_SIZES[0];
}

/** How many panels the state's layout has. */
export function panelCount(state) {
  return LAYOUTS[state.layout].rects.length;
}

/** Pixel rects for the layout at w × h, each inset by half the gutter so the dark ground reads as panel lines. */
export function panelRects(layoutId, w, h) {
  const gap = Math.max(4, Math.round(Math.min(w, h) * 0.011));
  return LAYOUTS[layoutId].rects.map(([fx, fy, fw, fh]) => ({
    x: fx * w + gap / 2,
    y: fy * h + gap / 2,
    w: fw * w - gap,
    h: fh * h - gap,
  }));
}

/**
 * Where a photo lands inside a panel: cover-fit scaled by the panel's zoom, positioned by its focal
 * point (ox/oy in 0..1 slide the crop from one edge to the other). Returns the draw box relative to the
 * panel's top-left, ready for drawImage.
 */
export function panelDrawBox(img, rect, view) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(rect.w / iw, rect.h / ih) * Math.max(1, view.zoom);
  const dw = iw * scale;
  const dh = ih * scale;
  return {
    dx: (rect.w - dw) * Math.min(1, Math.max(0, view.ox)),
    dy: (rect.h - dh) * Math.min(1, Math.max(0, view.oy)),
    dw,
    dh,
  };
}

const imageIds = new WeakMap();
let nextImageId = 1;
function imageId(img) {
  if (!imageIds.has(img)) imageIds.set(img, nextImageId++);
  return imageIds.get(img);
}

const panelCanvasCache = new Map();

/** A panel rendered offscreen at its pixel size with the grade applied; cached, since drags re-render constantly. */
function gradedPanel(img, rect, view, grade, halftone) {
  const w = Math.max(2, Math.round(rect.w));
  const h = Math.max(2, Math.round(rect.h));
  const key = [imageId(img), w, h, view.zoom.toFixed(3), view.ox.toFixed(3), view.oy.toFixed(3),
    grade.toFixed(2), halftone ? 1 : 0].join('|');
  const hit = panelCanvasCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const box = panelDrawBox(img, { w, h }, view);
  ctx.drawImage(img, box.dx, box.dy, box.dw, box.dh);
  if (grade > 0 || halftone) {
    const data = ctx.getImageData(0, 0, w, h);
    if (grade > 0) applyNeonSunset(data, grade);
    if (halftone) applyHalftone(data, Math.max(4, Math.round(w / 150)));
    ctx.putImageData(data, 0, 0);
  }
  if (panelCanvasCache.size > 40) panelCanvasCache.clear();
  panelCanvasCache.set(key, c);
  return c;
}

/** An empty panel: a dusk gradient and a quiet instruction, so a fresh cover still reads as a poster. */
function drawPlaceholder(ctx, rect) {
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  grad.addColorStop(0, '#3b1154');
  grad.addColorStop(0.55, '#8c2064');
  grad.addColorStop(1, '#ff7a4d');
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  drawOutlinedLine(ctx, 'YOUR PHOTO HERE', rect.x + rect.w / 2, rect.y + rect.h / 2, {
    size: Math.min(rect.w * 0.09, 44),
    fill: 'rgba(255,255,255,0.92)',
    stroke: 'rgba(18,6,31,0.65)',
    strokeRatio: 0.1,
  });
}

/**
 * Renders the whole cover onto `canvas` at the state's export size: panels first (each graded), a soft
 * scrim under the lettering, the masthead, the caption, and the vignette last. The editor's selected
 * panel (state.highlight) gets a neon outline; shots and exports leave it at -1.
 */
export function renderCover(canvas, state) {
  const size = coverSize(state);
  if (canvas.width !== size.w) canvas.width = size.w;
  if (canvas.height !== size.h) canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  const { w, h } = size;
  ctx.fillStyle = '#0a0512';
  ctx.fillRect(0, 0, w, h);

  const rects = panelRects(state.layout, w, h);
  rects.forEach((rect, i) => {
    const view = state.panels[i] ?? { photo: 0, zoom: 1, ox: 0.5, oy: 0.5 };
    const photo = state.photos[view.photo];
    if (photo?.img) {
      ctx.drawImage(gradedPanel(photo.img, rect, view, state.grade, state.halftone), rect.x, rect.y);
    } else {
      drawPlaceholder(ctx, rect);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1.5, w * 0.0022);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    if (state.highlight === i) {
      ctx.strokeStyle = '#ff2e88';
      ctx.lineWidth = Math.max(3, w * 0.005);
      ctx.strokeRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
    }
  });

  // Legibility scrims: a dusk fall at the top for the masthead, a shade at the foot for the caption.
  const topScrim = ctx.createLinearGradient(0, 0, 0, h * 0.34);
  topScrim.addColorStop(0, 'rgba(7,2,15,0.5)');
  topScrim.addColorStop(1, 'rgba(7,2,15,0)');
  ctx.fillStyle = topScrim;
  ctx.fillRect(0, 0, w, h * 0.34);
  const footScrim = ctx.createLinearGradient(0, h * 0.78, 0, h);
  footScrim.addColorStop(0, 'rgba(7,2,15,0)');
  footScrim.addColorStop(1, 'rgba(7,2,15,0.45)');
  ctx.fillStyle = footScrim;
  ctx.fillRect(0, h * 0.78, w, h * 0.22);

  const basis = Math.min(w, h * 1.45); // on wide covers the lettering scales with the height, not the width
  drawTitleBlock(ctx, { cx: w / 2, top: h * 0.105, width: basis, title: state.title, numeral: state.numeral });
  drawCaption(ctx, { cx: w / 2, bottom: h - h * 0.045, width: basis, caption: state.caption });

  if (state.vignette) {
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.36, w / 2, h / 2, Math.max(w, h) * 0.78);
    v.addColorStop(0, 'rgba(5,2,10,0)');
    v.addColorStop(1, 'rgba(5,2,10,0.44)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
  return canvas;
}
