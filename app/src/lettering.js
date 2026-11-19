// The lettering: GTA-genre type drawn on canvas with system heavy fonts only (no font files, nothing to
// load). A stacked white title block with a gradient numeral — the poster's masthead — and the caption in
// bold condensed capitals with a heavy dark outline, fitted to its line and wrapped when it runs long.

/** The font stack every lettering call uses: heavy display faces first, plain sans as the floor. */
export const LETTER_FONT = '"Arial Black", "Archivo Black", "Segoe UI", system-ui, sans-serif';

/** Sets ctx.font for `size` px of the lettering stack and returns the font string. */
export function letterFont(ctx, size) {
  const font = `900 ${size}px ${LETTER_FONT}`;
  ctx.font = font;
  return font;
}

/** The largest size, at or below startSize, whose rendered `text` fits maxWidth; never below minSize. */
export function fitFontSize(ctx, text, maxWidth, startSize, minSize = 10) {
  let size = startSize;
  letterFont(ctx, size);
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size = Math.max(minSize, size * 0.92);
    letterFont(ctx, size);
  }
  return size;
}

/** Splits `text` into lines that each fit maxWidth at `size`, breaking on spaces; a word wider than the line stays whole. */
export function wrapCaption(ctx, text, maxWidth, size) {
  letterFont(ctx, size);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line === '' ? word : `${line} ${word}`;
    if (line !== '' && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

/**
 * Draws one line of outlined display type, centred on cx with its baseline at y. The stroke is drawn first
 * at strokeRatio of the size, then the fill over it, so the letterforms keep a hard poster edge.
 */
export function drawOutlinedLine(ctx, text, cx, y, { size, fill = '#ffffff', stroke = '#12061f', strokeRatio = 0.16 }) {
  letterFont(ctx, size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * strokeRatio);
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, cx, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, cx, y);
}

/**
 * Draws the masthead at the top of the cover: the title's lines stacked in white, then the numeral huge
 * beneath them with a gold-to-pink gradient fill. Returns the y just below the block. `width` is the cover
 * width the block must fit inside; `top` is where its first baseline lands.
 */
export function drawTitleBlock(ctx, { cx, top, width, title, numeral }) {
  const lines = title.split('\n').map((s) => s.trim().toUpperCase()).filter(Boolean);
  let y = top;
  for (const line of lines) {
    const size = fitFontSize(ctx, line, width * 0.94, width * 0.135);
    drawOutlinedLine(ctx, line, cx, y, { size, strokeRatio: 0.13 });
    y += size * 0.98;
  }
  const num = (numeral ?? '').trim().toUpperCase();
  if (num) {
    const size = fitFontSize(ctx, num, width * 0.6, width * 0.34);
    letterFont(ctx, size);
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.1);
    ctx.strokeStyle = '#12061f';
    const grad = ctx.createLinearGradient(0, y - size * 0.72, 0, y + size * 0.12);
    grad.addColorStop(0, '#ffe9a8');
    grad.addColorStop(0.45, '#ffb347');
    grad.addColorStop(0.78, '#ff2e88');
    grad.addColorStop(1, '#b829dd');
    ctx.strokeText(num, cx, y + size * 0.82);
    ctx.fillStyle = grad;
    ctx.fillText(num, cx, y + size * 0.82);
    y += size * 0.94;
  }
  return y;
}

/**
 * Draws the caption at the foot of the cover, centred, wrapped to at most maxLines lines and shrunk until
 * they fit. `bottom` is the baseline of the last line. Returns the y of the first line's top.
 */
export function drawCaption(ctx, { cx, bottom, width, caption, maxLines = 2 }) {
  const text = (caption ?? '').trim().toUpperCase();
  if (!text) return bottom;
  let size = width * 0.105;
  let lines = wrapCaption(ctx, text, width * 0.92, size);
  while ((lines.length > maxLines || lines.some((l) => ctx.measureText(l).width > width * 0.92)) && size > 12) {
    size *= 0.92;
    lines = wrapCaption(ctx, text, width * 0.92, size);
  }
  lines = lines.slice(0, maxLines);
  const lineHeight = size * 1.04;
  lines.forEach((line, i) => {
    drawOutlinedLine(ctx, line, cx, bottom - (lines.length - 1 - i) * lineHeight, { size, strokeRatio: 0.15 });
  });
  return bottom - lines.length * lineHeight;
}
