// Nested bars: one thing fills the width, press →, and it shrinks into a sliver
// at the left of the next thing up the ladder. No camera to drive — the only
// state is which rung you are on and a tween between rungs. The sizes come
// from the same LADDER the explorer draws, so the two can never disagree.

import { LADDER } from './data.js';
import { lengthStr } from './units.js';

const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, u) => a + (b - a) * u;
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

const PALETTE = { bg: '#04060d', ink: '#eaf0fb', dim: '#8593ad', faint: '#4a5670', accent: '#ffcf5c' };

// A glyph per rung, so the medallion says something before you read the label.
const GLYPH = {
  'Proton': '•', 'Hydrogen atom': '⚛', 'DNA helix': '🧬', 'Coronavirus': '🦠', 'Red blood cell': '🩸',
  'Human hair': '〰', 'Grain of sand': '⏳', 'Ant': '🐜', 'Human': '🧍', 'Blue whale': '🐋',
  'Football pitch': '⚽', 'Burj Khalifa': '🏙', 'Mount Everest': '🏔', 'Greater London': '🌆',
  'Earth': '🌍', 'Jupiter': '🪐', 'The Sun': '☀', "Earth's orbit": '◎', "Neptune's orbit": '◎',
  'One light-year': '✦', 'Proxima Centauri': '⭐', 'The Milky Way': '🌌', 'Local Group': '🌀',
  'Observable universe': '🔭',
};

// LADDER keeps honest half-sizes; a bar wants the whole extent.
const RUNGS = LADDER.map((it) => ({ name: it.name, d: it.r * 2, note: it.note, color: it.color, glyph: GLYPH[it.name] ?? '•' }));

// ----------------------------------------------------------------------------

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d', { alpha: false });
const el = (id) => document.getElementById(id);

let w = 0, h = 0;
let k = RUNGS.findIndex((r) => r.name === 'Human');
// `pos` is the fractional rung the view sits at; the bar of rung `pos` is
// exactly full width. Between rungs it is interpolated in log size.
let pos = k;
let tween = null;

const logD = (i) => Math.log10(RUNGS[i].d);
/** log10 of the size that currently fills the full bar width. */
function fullLog() {
  const i = Math.floor(pos), f = pos - i;
  if (f === 0 || i + 1 >= RUNGS.length) return logD(i);
  return lerp(logD(i), logD(i + 1), f);
}

function go(target, instant = false) {
  target = clamp(target, 0, RUNGS.length - 1);
  if (target === k && !tween) return;
  k = target;
  if (instant) { pos = k; tween = null; render(); return; }
  const from = pos;
  // One rung is a beat; a long jump takes a bit longer but not proportionally.
  const dur = 900 + 260 * Math.min(3, Math.abs(k - from) - 1);
  tween = { from, to: k, t0: performance.now(), dur };
  requestAnimationFrame(frame);
  syncChrome();
}

function frame(now) {
  if (tween) {
    const u = clamp((now - tween.t0) / tween.dur);
    pos = lerp(tween.from, tween.to, easeInOut(u));
    if (u >= 1) { tween = null; pos = k; }
  }
  render();
  if (tween) requestAnimationFrame(frame);
}

// ----------------------------------------------------------------------------

function resize() {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  w = window.innerWidth;
  h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}

const sans = (px, wt = 500) => `${wt} ${px}px 'Inter', ui-sans-serif, system-ui, sans-serif`;
const mono = (px, wt = 500) => `${wt} ${px}px 'JetBrains Mono', ui-monospace, Menlo, monospace`;
const compact = () => w < 560;

function render() {
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, w, h);

  const full = w - Math.max(28, Math.round(w * 0.12));   // the bar that is "this big"
  const barH = compact() ? 34 : 46;
  const y = Math.round(h * 0.58);
  const ppm = full / Math.pow(10, fullLog());             // pixels per metre right now

  // Which rungs are worth drawing: the two below the one filling the width
  // (any further down is a sub-pixel tick on top of a sub-pixel tick) and the
  // one above, which is sliding in from beyond the right edge.
  const lo = Math.max(0, Math.floor(pos) - 2);
  const hi = Math.min(RUNGS.length - 1, Math.floor(pos) + 1);
  const bars = [];
  for (let i = lo; i <= hi; i++) {
    const trueW = RUNGS[i].d * ppm;
    bars.push({ i, trueW, drawW: Math.max(3, trueW) });
  }

  // Biggest first so the smaller ones nest on top, like the red on the yellow.
  bars.sort((a, b) => b.drawW - a.drawW);
  const frac = pos - Math.floor(pos);
  for (const b of bars) {
    // A bar still wider than the frame is the one arriving: it fades in with
    // the tween and is invisible at rest, however close the ratio.
    const alpha = b.trueW > full * 1.01 ? clamp(frac * 1.6) : 1;
    if (alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = RUNGS[b.i].color;
    roundRect(0, y - barH / 2, Math.min(b.drawW, w + 40), barH, b.drawW > 8 ? 4 : 1.5);
    ctx.fill();
    ctx.restore();
  }

  // Medallions, smallest bar first so the big label paints over the sliver's.
  bars.sort((a, b) => a.drawW - b.drawW);
  const placed = [];
  for (const b of bars) {
    const over = Math.log10(b.trueW / full);
    if (over > 0.05) continue;                         // still arriving: no label yet
    if (b.i < Math.floor(pos) - 1 + (frac > 0 ? 1 : 0) && b.i < Math.round(pos) - 1) continue;
    // Full size when this bar fills the width, small once it is a tenth of it.
    const s = clamp(1 + over / 1.0);
    const alpha = clamp(1 + over / 2.4, 0.35, 1);
    const x = clamp(b.drawW, 54, full);
    placed.push({ b, x, s, alpha });
  }
  // The sliver's label and the current label fight for the same corner only
  // when the ratio is small; nudge the smaller one left when they overlap.
  for (let n = placed.length - 1; n > 0; n--) {
    const a = placed[n - 1], c = placed[n];
    const need = 70 * a.s + 70 * c.s + 12;
    if (c.x - a.x < need) a.x = Math.max(54, c.x - need);
  }
  for (const p of placed) drawMedallion(p.b, p.x, y - barH / 2, p.s, p.alpha);

  drawRatio(bars, y, barH, full, ppm);
}

function drawMedallion(b, x, barTop, s, alpha) {
  const r = RUNGS[b.i];
  const big = !compact();
  const R = lerp(big ? 24 : 20, big ? 46 : 36, s);
  const chipFont = lerp(12, big ? 17 : 15, s);
  const sizeFont = lerp(11, big ? 14 : 13, s);
  const showNote = s > 0.6 && r.note;

  // Stacked upward from the bar: a short stalk, the size (and what was
  // measured), the name chip, then the disc — nothing sits on the stalk.
  const stalk = 12;
  const textH = sizeFont + 4 + (showNote ? sizeFont + 1 : 0);
  const textTop = barTop - stalk - textH;
  const ch = chipFont + 14;
  const cyChip = textTop - 6 - ch / 2;
  const cy = cyChip - ch / 2 - 4 - R;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';

  ctx.strokeStyle = r.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, barTop - 1);
  ctx.lineTo(x, barTop - stalk + 2);
  ctx.stroke();

  ctx.font = sans(chipFont, 600);
  const cw = ctx.measureText(r.name).width + 24;
  const cx = clamp(x, cw / 2 + 8, w - cw / 2 - 8);

  ctx.textBaseline = 'top';
  ctx.font = mono(sizeFont, 600);
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText(lengthStr(r.d), cx, textTop);
  if (showNote) {
    ctx.font = sans(sizeFont - 1, 400);
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText(r.note, cx, textTop + sizeFont + 4);
  }

  ctx.fillStyle = r.color;
  roundRect(cx - cw / 2, cyChip - ch / 2, cw, ch, 6);
  ctx.fill();
  ctx.font = sans(chipFont, 600);
  ctx.fillStyle = '#0a0d16';
  ctx.textBaseline = 'middle';
  ctx.fillText(r.name, cx, cyChip + 1);

  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = shade(r.color, -0.55);
  ctx.fill();
  ctx.lineWidth = Math.max(2, R * 0.11);
  ctx.strokeStyle = r.color;
  ctx.stroke();
  ctx.font = `${Math.round(R * 1.05)}px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif`;
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText(r.glyph, cx, cy + R * 0.06);

  ctx.restore();
}

/** "× 340" in the free part of the big bar, with a note when the sliver is a lie of three pixels. */
function drawRatio(bars, y, barH, full, ppm) {
  const i = Math.round(pos);
  if (Math.abs(pos - i) > 0.35 || i === 0) return;
  const prev = RUNGS[i - 1];
  const ratio = RUNGS[i].d / prev.d;
  const sliver = prev.d * ppm;
  const fade = clamp(1 - Math.abs(pos - i) / 0.35);
  const text = `× ${ratioStr(ratio)}`;
  const sub = sliver < 2
    ? (compact()
      ? `${prev.name}: ${sliverStr(sliver)} here, drawn as a 3 px tick`
      : `${prev.name} would be ${sliverStr(sliver)} wide here, so it is drawn as a 3 px tick`)
    : `${ratioStr(ratio)} ${pluralName(prev.name)} end to end`;

  ctx.save();
  ctx.globalAlpha = fade;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const x = Math.max(sliver, 3) + (full - Math.max(sliver, 3)) / 2;
  ctx.font = mono(compact() ? 22 : 30, 600);
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText(text, x, y + barH / 2 + 16);
  ctx.font = sans(compact() ? 12 : 14, 400);
  ctx.fillStyle = PALETTE.dim;
  const half = ctx.measureText(sub).width / 2;
  ctx.fillText(sub, clamp(x, half + 12, w - half - 12), y + barH / 2 + 16 + (compact() ? 30 : 40));
  ctx.restore();
}

const ratioStr = (r) => {
  if (r >= 1e6) return `${digits(r / 1e6)} million`;
  if (r >= 1e4) return `${digits(r / 1e3)} thousand`;
  return digits(r);
};
const digits = (v) => {
  const s = v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
  return s.toLocaleString('en-US', { maximumFractionDigits: 2 }).replace(/,/g, ' ');
};
const sliverStr = (px) => (px < 0.01 ? `${digits(px * 1000)} thousandths of a pixel` : `${digits(px)} px`);

// Enough English for a ladder of 24 names.
function pluralName(name) {
  const lower = name.replace(/^(The|One|Greater) /, '').toLowerCase();
  if (name === 'Human') return 'humans';
  if (name === 'Football pitch') return 'pitches';
  if (name === 'Burj Khalifa' || name === 'Mount Everest' || name === 'Proxima Centauri') return `${name}s`;
  if (name === 'Greater London') return 'Londons';
  if (name === 'The Sun') return 'Suns';
  if (name === 'The Milky Way') return 'Milky Ways';
  if (name === 'Observable universe') return 'observable universes';
  if (/orbit$/.test(name)) return `${name}s`;
  if (lower.endsWith('s') || lower.endsWith('x')) return `${lower}es`;
  if (lower.endsWith('y')) return `${lower.slice(0, -1)}ies`;
  return `${lower}s`;
}

// ----------------------------------------------------------------------------

function roundRect(x, y, bw, bh, r) {
  r = Math.min(r, bw / 2, bh / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + bw, y, x + bw, y + bh, r);
  ctx.arcTo(x + bw, y + bh, x, y + bh, r);
  ctx.arcTo(x, y + bh, x, y, r);
  ctx.arcTo(x, y, x + bw, y, r);
  ctx.closePath();
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (sh) => {
    const c = (n >> sh) & 255;
    const v = amount < 0 ? c * (1 + amount) : c + (255 - c) * amount;
    return Math.round(clamp(v, 0, 255));
  };
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

// ----------------------------------------------------------------- chrome ---

function syncChrome() {
  el('count').textContent = `${k + 1} / ${RUNGS.length}`;
  el('prev').disabled = k === 0;
  el('next').disabled = k === RUNGS.length - 1;
  el('prev').title = k > 0 ? `← ${RUNGS[k - 1].name}` : '';
  el('next').title = k < RUNGS.length - 1 ? `${RUNGS[k + 1].name} →` : '';
  for (const [i, dot] of dots.entries()) dot.classList.toggle('on', i === k);
  if (!tween) history.replaceState(null, '', `#${slug(RUNGS[k].name)}`);
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const dots = [];
(function buildDots() {
  const box = el('dots');
  for (const [i, r] of RUNGS.entries()) {
    const d = document.createElement('button');
    d.className = 'dot';
    d.style.setProperty('--c', r.color);
    d.setAttribute('aria-label', r.name);
    d.addEventListener('click', () => go(i));
    box.appendChild(d);
    dots.push(d);
  }
})();

el('prev').addEventListener('click', () => go(k - 1));
el('next').addEventListener('click', () => go(k + 1));

addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'l') { e.preventDefault(); go(k + 1); }
  else if (e.key === 'ArrowLeft' || e.key === 'h') { e.preventDefault(); go(k - 1); }
  else if (e.key === 'Home') go(0);
  else if (e.key === 'End') go(RUNGS.length - 1);
});

// A swipe is a page turn. Taps on the right third go up, on the left third down.
let touch = null;
canvas.addEventListener('pointerdown', (e) => { touch = { x: e.clientX, t: performance.now() }; });
canvas.addEventListener('pointerup', (e) => {
  if (!touch) return;
  const dx = e.clientX - touch.x;
  const dt = performance.now() - touch.t;
  touch = null;
  if (Math.abs(dx) > 40) go(dx < 0 ? k + 1 : k - 1);
  else if (dt < 300) {
    if (e.clientX > w * 0.66) go(k + 1);
    else if (e.clientX < w * 0.34) go(k - 1);
  }
});
canvas.addEventListener('wheel', (e) => {
  if (Math.abs(e.deltaY) < 20 || tween) return;
  go(k + (e.deltaY > 0 ? 1 : -1));
}, { passive: true });

// Test hook: park the view at a rung, or a fraction of the way to the next one.
window.__ladder = {
  show(slugOrIndex, frac = 0) {
    const i = typeof slugOrIndex === 'number' ? slugOrIndex : RUNGS.findIndex((r) => slug(r.name) === slugOrIndex);
    if (i < 0) throw new Error(`no rung ${slugOrIndex}`);
    tween = null;
    k = frac > 0 ? Math.min(RUNGS.length - 1, i + 1) : i;
    pos = i + frac;
    syncChrome();
    render();
  },
};

(function boot() {
  const want = location.hash.slice(1);
  const i = RUNGS.findIndex((r) => slug(r.name) === want);
  if (i >= 0) { k = i; pos = i; }
  addEventListener('resize', resize);
  resize();
  syncChrome();
  if (document.fonts?.ready) document.fonts.ready.then(render);
})();
