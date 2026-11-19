// Leonida Cover Lab's editor: wires the page to the composer. A photo dropped in is composed into a
// finished cover at once; from there it is drags, sliders and one export click. Everything happens on
// this machine — photos are read as object URLs and never uploaded anywhere.

import {
  EXPORT_SIZES, LAYOUTS, coverSize, createCoverState, panelCount, panelDrawBox, panelRects, renderCover,
} from './composer.js';
import { SAMPLES, loadImage, runShotScene } from './shots.js';

const state = createCoverState();
let selectedPanel = 0;

const $ = (id) => document.getElementById(id);
const canvas = $('cover-canvas');
const status = $('status');

function say(text) {
  status.textContent = text;
}

/** Re-renders the cover with the editor's selection outline, and keeps the panel controls in step. */
function render() {
  state.highlight = selectedPanel;
  renderCover(canvas, state);
  syncPanelControls();
}

/** Adds a loaded image to the photo tray and puts it to work in the panels. */
function addPhoto(img, label) {
  state.photos.push({ img, label });
  const index = state.photos.length - 1;
  if (index === 0) {
    state.panels.forEach((p) => { p.photo = 0; });
  } else if (index < state.panels.length) {
    state.panels[index].photo = index; // a second, third, fourth photo fills its own panel
  }
  buildThumbs();
  render();
  say(`${label} loaded — drag the panels to reframe, then export.`);
}

/** The photo tray: one thumbnail per loaded photo; a click assigns it to the selected panel. */
function buildThumbs() {
  const tray = $('photo-thumbs');
  tray.replaceChildren();
  state.photos.forEach((photo, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'thumb';
    btn.title = `${photo.label} — click to put it in panel ${selectedPanel + 1}`;
    const thumb = document.createElement('img');
    thumb.src = photo.img.src;
    thumb.alt = photo.label;
    btn.appendChild(thumb);
    btn.addEventListener('click', () => {
      state.panels[selectedPanel].photo = i;
      render();
      say(`${photo.label} is in panel ${selectedPanel + 1}.`);
    });
    tray.appendChild(btn);
  });
}

/** Keeps the panel picker, its photo picker and the zoom slider matched to the layout and selection. */
let lastLayout = '';
function syncPanelControls() {
  const count = panelCount(state);
  if (selectedPanel >= count) selectedPanel = count - 1;
  if (state.layout !== lastLayout) {
    lastLayout = state.layout;
    const picker = $('panel-select');
    picker.replaceChildren();
    for (let i = 0; i < count; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `Panel ${i + 1}`;
      picker.appendChild(opt);
    }
  }
  $('panel-select').value = String(selectedPanel);
  const photoPicker = $('panel-photo');
  photoPicker.replaceChildren();
  if (state.photos.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = 'No photo yet';
    photoPicker.appendChild(opt);
    photoPicker.disabled = true;
  } else {
    photoPicker.disabled = false;
    state.photos.forEach((photo, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = photo.label;
      photoPicker.appendChild(opt);
    });
    photoPicker.value = String(state.panels[selectedPanel].photo);
  }
  $('panel-zoom').value = String(state.panels[selectedPanel].zoom);
}

/** Reads local files into the tray. The files never leave the machine: object URLs only. */
async function readFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      const img = await loadImage(URL.createObjectURL(file));
      addPhoto(img, file.name.replace(/\.[^.]+$/, ''));
    } catch {
      say(`Could not read ${file.name}.`);
    }
  }
}

$('photo-input').addEventListener('change', (e) => readFiles([...e.target.files]));
const dropZone = $('drop-zone');
for (const name of ['dragover', 'dragenter']) {
  dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.add('over'); });
}
for (const name of ['dragleave', 'drop']) {
  dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.remove('over'); });
}
dropZone.addEventListener('drop', (e) => readFiles([...e.dataTransfer.files]));

document.querySelectorAll('[data-sample]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const sample = SAMPLES.find((s) => s.name === btn.dataset.sample);
    addPhoto(await loadImage(`samples/${sample.name}.jpg`), sample.label);
  });
});

document.querySelectorAll('#layout-seg button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#layout-seg button').forEach((b) => b.classList.toggle('on', b === btn));
    state.layout = btn.dataset.layout;
    render();
    say(`${LAYOUTS[state.layout].label} — ${panelCount(state)} panels.`);
  });
});

$('panel-select').addEventListener('change', (e) => {
  selectedPanel = Number(e.target.value);
  buildThumbs();
  render();
});
$('panel-photo').addEventListener('change', (e) => {
  state.panels[selectedPanel].photo = Number(e.target.value);
  render();
});
$('panel-zoom').addEventListener('input', (e) => {
  state.panels[selectedPanel].zoom = Number(e.target.value);
  render();
});

$('grade-range').addEventListener('input', (e) => {
  state.grade = Number(e.target.value);
  render();
});
$('halftone-check').addEventListener('change', (e) => {
  state.halftone = e.target.checked;
  render();
});
$('vignette-check').addEventListener('change', (e) => {
  state.vignette = e.target.checked;
  render();
});
$('title-input').addEventListener('input', (e) => {
  state.title = e.target.value;
  render();
});
$('numeral-input').addEventListener('input', (e) => {
  state.numeral = e.target.value;
  render();
});
$('caption-input').addEventListener('input', (e) => {
  state.caption = e.target.value;
  render();
});

document.querySelectorAll('#size-seg button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#size-seg button').forEach((b) => b.classList.toggle('on', b === btn));
    state.sizeId = btn.dataset.size;
    render();
    const s = coverSize(state);
    say(`Export size ${s.label}.`);
  });
});

$('export-btn').addEventListener('click', () => {
  state.highlight = -1; // the PNG is the clean cover, never the editor's selection outline
  renderCover(canvas, state);
  const size = coverSize(state);
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `leonida-cover-${size.w}x${size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    say(`Saved leonida-cover-${size.w}x${size.h}.png`);
    render();
  }, 'image/png');
});

// Direct manipulation: drag a panel to reframe its photo, wheel over it to zoom.
let drag = null;
function canvasPoint(e) {
  const box = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - box.left) * (canvas.width / box.width),
    y: (e.clientY - box.top) * (canvas.height / box.height),
  };
}
function panelAt(point) {
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  return rects.findIndex((r) => point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h);
}
canvas.addEventListener('pointerdown', (e) => {
  const point = canvasPoint(e);
  const index = panelAt(point);
  if (index < 0) return;
  selectedPanel = index;
  buildThumbs();
  drag = { index, x: point.x, y: point.y };
  canvas.setPointerCapture(e.pointerId);
  render();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const point = canvasPoint(e);
  const rect = panelRects(state.layout, canvas.width, canvas.height)[drag.index];
  const view = state.panels[drag.index];
  const photo = state.photos[view.photo];
  if (photo?.img) {
    const box = panelDrawBox(photo.img, rect, view);
    if (box.dw > rect.w) view.ox = Math.min(1, Math.max(0, view.ox - (point.x - drag.x) / (box.dw - rect.w)));
    if (box.dh > rect.h) view.oy = Math.min(1, Math.max(0, view.oy - (point.y - drag.y) / (box.dh - rect.h)));
  }
  drag.x = point.x;
  drag.y = point.y;
  render();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  const index = panelAt(canvasPoint(e));
  if (index < 0) return;
  e.preventDefault();
  selectedPanel = index;
  const view = state.panels[index];
  view.zoom = Math.min(3.5, Math.max(1, view.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  render();
}, { passive: false });

// Open on a finished cover: the first sample composes itself, so the first thing anyone sees is the
// poster, not an empty form. A ?shot= scene takes over instead when one is in the query.
const query = new URLSearchParams(location.search);
if (query.has('shot')) {
  runShotScene(query, ({ img, sample, caption }) => {
    state.photos = [{ img, label: SAMPLES.find((s) => s.name === sample).label }];
    state.panels.forEach((p) => { p.photo = 0; p.zoom = 1; p.ox = 0.5; p.oy = 0.5; });
    state.caption = caption;
    buildThumbs();
    render();
  }).catch((err) => say(String(err)));
} else {
  loadImage('samples/boulevard.jpg').then((img) => {
    addPhoto(img, 'Neon Boulevard');
    say('A finished cover, straight away — swap in your own photo to make it yours.');
  });
}
