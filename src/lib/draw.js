// Drawing primitives. Everything is pure: given a context, a camera and a set of
// numbers it paints, it never stores state between frames.

import { clamp, lerp, rng, easeOut } from './math.js';

export const W = 1920;
export const H = 1080;
export const MARGIN = 112;

export const PALETTE = {
  bg: '#04060d',
  bgLift: '#0a1020',
  ink: '#eaf0fb',
  dim: '#8593ad',
  faint: '#3c475e',
  line: '#27324a',
  accent: '#ffcf5c',   // measurements, the number that matters
  cool: '#5cd0ff',     // light, time, anything that travels
  warn: '#ff7b6b',     // the one moment something does not fit
};

export const FONT_SANS = '"Inter", "DejaVu Sans", sans-serif';
export const FONT_MONO = '"JetBrains Mono", "DejaVu Sans Mono", monospace';

export const sans = (size, weight = 400) => `${weight} ${size}px ${FONT_SANS}`;
export const mono = (size, weight = 500) => `${weight} ${size}px ${FONT_MONO}`;

// ---------------------------------------------------------------- camera ----

/**
 * A camera over a world measured in metres. `scale` is pixels per metre, so a
 * zoom is a multiplication — which is why every zoom animates in log space.
 */
export function camera({ cx = 0, cy = 0, scale = 1 }) {
  return {
    cx, cy, scale,
    sx: (x) => W / 2 + (x - cx) * scale,
    sy: (y) => H / 2 - (y - cy) * scale,
    len: (m) => m * scale,
    /** Metres per pixel — handy for deciding when something is too small to draw. */
    mpp: 1 / scale,
  };
}

/** Scale that makes `metres` span `px` pixels. */
export const scaleFor = (metres, px) => px / metres;

// ------------------------------------------------------------ background ----

export function clear(ctx, { glow = 0.6 } = {}) {
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, W, H);
  if (glow > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, `rgba(18,30,58,${0.55 * glow})`);
    g.addColorStop(1, 'rgba(4,6,13,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

/**
 * Screen-space starfield. `depth` slides the field slowly so a long zoom does
 * not look frozen; it is not physically meaningful and stays very dim.
 */
export function stars(ctx, { seed = 7, count = 320, alpha = 1, depth = 0 } = {}) {
  const r = rng(seed);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const bx = r() * W, by = r() * H;
    const layer = 0.3 + r() * 0.7;
    const x = (bx + depth * layer * 90) % W;
    const y = by;
    const s = (0.5 + r() * 1.4) * layer;
    ctx.globalAlpha = alpha * (0.12 + r() * 0.5) * layer;
    ctx.fillStyle = '#cfe0ff';
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function vignette(ctx, strength = 0.5) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export function fade(ctx, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ----------------------------------------------------------------- bodies ---

/**
 * Draw a sphere at world position (x, y) with world radius r.
 *
 * When the body is smaller than a couple of pixels we stop pretending and draw
 * an honest marker instead — a dot plus a ring — and report it back so the
 * scene can caption it ("shown as a marker"). Silently rounding a sub-pixel
 * planet up to 4px would be a lie about scale, which is the one thing this film
 * cannot afford.
 */
export function body(ctx, cam, opts) {
  const {
    x = 0, y = 0, r, color = '#888', color2 = '#ccc',
    lightFrom = -1,        // -1 lit from the left, +1 from the right, 0 flat
    alpha = 1, glow = 0, ring = 0, minMarker = true,
    emissive = false,      // a light source has no terminator and no dark rim
  } = opts;

  const px = cam.sx(x), py = cam.sy(y), pr = cam.len(r);
  if (px + pr < -400 || px - pr > W + 400) return { px, py, pr, visible: false, marked: false };
  if (alpha <= 0) return { px, py, pr, visible: false, marked: false };

  ctx.save();
  ctx.globalAlpha = alpha;

  if (pr < 2.2) {
    if (minMarker) {
      ctx.fillStyle = color2;
      ctx.beginPath();
      ctx.arc(px, py, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha * 0.5;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 13, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    return { px, py, pr, visible: true, marked: true };
  }

  if (glow > 0) {
    const g = ctx.createRadialGradient(px, py, pr * 0.9, px, py, pr * (1 + 2.4 * glow));
    g.addColorStop(0, hexA(color2, 0.32 * glow));
    g.addColorStop(1, hexA(color2, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, pr * (1 + 2.4 * glow), 0, Math.PI * 2);
    ctx.fill();
  }

  const lx = px + (emissive ? 0 : lightFrom * pr * 0.45);
  const ly = py - (emissive ? 0 : pr * 0.35);
  const grad = ctx.createRadialGradient(lx, ly, pr * 0.05, px, py, pr * 1.12);
  if (emissive) {
    grad.addColorStop(0, color2);
    grad.addColorStop(0.7, color);
    grad.addColorStop(1, shade(color, 0.1));
  } else {
    grad.addColorStop(0, color2);
    grad.addColorStop(0.55, color);
    grad.addColorStop(1, shade(color, -0.5));
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fill();

  if (ring > 0) {
    ctx.strokeStyle = hexA(color2, 0.5 * ring);
    ctx.lineWidth = Math.max(1, pr * 0.02);
    ctx.beginPath();
    ctx.arc(px, py, pr * 1.035, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
  return { px, py, pr, visible: true, marked: false };
}

// ------------------------------------------------------------ annotation ----

/** Rounded rect path. */
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * A dimension line between two screen x positions.
 * `grow` 0..1 opens it from the centre outwards, so it reads as a measurement
 * being taken rather than a label appearing.
 */
export function measure(ctx, { x0, x1, y, label, sub, alpha = 1, grow = 1, color = PALETTE.accent, tick = 26 }) {
  if (alpha <= 0) return;
  const mid = (x0 + x1) / 2;
  const g = easeOut(clamp(grow));
  const a0 = lerp(mid, x0, g), a1 = lerp(mid, x1, g);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(a0, y); ctx.lineTo(a1, y);
  ctx.moveTo(a0, y - tick / 2); ctx.lineTo(a0, y + tick / 2);
  ctx.moveTo(a1, y - tick / 2); ctx.lineTo(a1, y + tick / 2);
  ctx.stroke();

  if (label) {
    ctx.font = mono(44, 600);
    const wLabel = ctx.measureText(label).width;
    ctx.font = sans(24, 500);
    const wSub = sub ? ctx.measureText(sub).width : 0;
    const boxW = Math.max(wLabel, wSub) + 56;
    const boxH = sub ? 116 : 76;
    const bx = mid - boxW / 2, by = y - boxH / 2;

    ctx.globalAlpha = alpha * clamp((g - 0.55) / 0.45);
    ctx.fillStyle = PALETTE.bg;
    roundRect(ctx, bx, by, boxW, boxH, 10);
    ctx.fill();
    ctx.strokeStyle = hexA(color, 0.35);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = mono(44, 600);
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(label, mid, sub ? by + 50 : by + 52);
    if (sub) {
      ctx.fillStyle = PALETTE.dim;
      ctx.font = sans(24, 500);
      ctx.fillText(sub, mid, by + 88);
    }
  }
  ctx.restore();
}

/** Small name tag with a leader line pointing at (tx, ty). */
export function tag(ctx, { tx, ty, dx = 0, dy = -90, text, alpha = 1, color = PALETTE.ink, align = 'center' }) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = hexA(color, 0.4);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx + dx, ty + dy);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = sans(26, 600);
  ctx.textAlign = align;
  ctx.textBaseline = 'bottom';
  ctx.fillText(text, tx + dx, ty + dy - 12);
  ctx.restore();
}

/**
 * The lower-left text block: an all-caps kicker, a headline, and a body line.
 * `rise` slides it up a few pixels as it fades in.
 */
export function caption(ctx, { kicker, title, body: bodyText, alpha = 1, x = MARGIN, y = H - MARGIN, accent = PALETTE.accent, maxWidth = W - MARGIN * 2, scrim = true }) {
  if (alpha <= 0) return;
  const a = clamp(alpha);
  const oy = (1 - a) * 18;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Captions land on top of planets and lit limbs — without a scrim the body
  // copy disappears exactly when the picture is most interesting.
  if (scrim) {
    ctx.globalAlpha = a;
    const top = H - 560;
    const g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0.00, 'rgba(3,5,11,0)');
    g.addColorStop(0.25, 'rgba(3,5,11,0.10)');
    g.addColorStop(0.50, 'rgba(3,5,11,0.38)');
    g.addColorStop(0.75, 'rgba(3,5,11,0.70)');
    g.addColorStop(1.00, 'rgba(3,5,11,0.92)');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, H - top);
  }

  ctx.globalAlpha = a;
  let cursor = y + oy;
  if (bodyText) {
    const lines = wrap(ctx, bodyText, sans(32, 400), maxWidth);
    ctx.font = sans(32, 400);
    ctx.fillStyle = PALETTE.dim;
    for (let i = lines.length - 1; i >= 0; i--) {
      ctx.fillText(lines[i], x, cursor);
      cursor -= 44;
    }
    cursor -= 24;
  }
  if (title) {
    ctx.font = sans(64, 700);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText(title, x, cursor);
    cursor -= 74;
  }
  if (kicker) {
    ctx.font = sans(22, 600);
    ctx.fillStyle = accent;
    ctx.letterSpacing = '0.22em';
    ctx.fillText(kicker.toUpperCase(), x, cursor);
    ctx.letterSpacing = '0px';
  }
  ctx.restore();
}

/**
 * Top-centre disclosure pill — for the moments where the frame deliberately
 * cheats (faked separation, schematic body sizes) and has to say so.
 */
export function disclosure(ctx, { text, alpha = 1, color = PALETTE.warn, y = MARGIN - 12 }) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha) * 0.92;
  ctx.font = sans(22, 500);
  const w = ctx.measureText(text).width + 44;
  const x = W / 2 - w / 2;
  ctx.fillStyle = hexA(color, 0.1);
  roundRect(ctx, x, y, w, 46, 23);
  ctx.fill();
  ctx.strokeStyle = hexA(color, 0.45);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, y + 24);
  ctx.restore();
}

/** Big number in the top-right, for counters and totals. */
export function readout(ctx, { value, unit, note, alpha = 1, x = W - MARGIN, y = MARGIN + 40, color = PALETTE.accent }) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  let right = x;
  if (unit) {
    ctx.font = sans(30, 500);
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText(unit, x, y);
    right = x - ctx.measureText(unit).width - 16;
  }
  ctx.font = mono(84, 600);
  ctx.fillStyle = color;
  ctx.fillText(value, right, y);
  if (note) {
    ctx.font = sans(24, 400);
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText(note, x, y + 40);
  }
  ctx.restore();
}

/** Scene number + name, top-left, always quiet. */
export function sceneTag(ctx, { index, title, alpha = 1 }) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha) * 0.85;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = mono(22, 600);
  ctx.fillStyle = PALETTE.accent;
  ctx.fillText(String(index).padStart(2, '0'), MARGIN, MARGIN);
  ctx.font = sans(22, 500);
  ctx.fillStyle = PALETTE.dim;
  ctx.letterSpacing = '0.18em';
  ctx.fillText(title.toUpperCase(), MARGIN + 50, MARGIN);
  ctx.letterSpacing = '0px';
  ctx.restore();
}

/** Greedy word wrap against a font. */
export function wrap(ctx, text, font, maxWidth) {
  ctx.save();
  ctx.font = font;
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const probe = line ? `${line} ${w}` : w;
    if (ctx.measureText(probe).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = probe;
  }
  if (line) lines.push(line);
  ctx.restore();
  return lines;
}

// -------------------------------------------------------------- colour ------

export function hexA(hex, a) {
  const { r, g, b } = parse(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function shade(hex, amount) {
  const { r, g, b } = parse(hex);
  const f = (v) => Math.round(clamp(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount, 0, 255));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function parse(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}
