// Nested bars — the Powers of Ten view. One rung fills the width; press → and
// the scale tweens in log space so it shrinks into the sliver it really is
// beside the next rung up. There is no camera to drive, so this view owns its
// own input and a strip of chrome at the bottom; app.js hands it the canvas,
// the frame clock and the events while it is the selected world.
//
// The sizes are the same LADDER the explorer always drew, so the two can never
// disagree about how big anything is.

import { LADDER } from './data.js';
import { lengthStr } from './units.js';

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

/**
 * Build the view against a canvas context and the page's `el(id)` lookup.
 * Everything stateful lives in this closure, so the module adds no names that
 * could collide with app.js once the bundler flattens them together.
 */
export function createNested({ ctx, el, palette }) {
  const clip = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
  const mix = (a, b, u) => a + (b - a) * u;
  const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const sans = (px, wt = 500) => `${wt} ${px}px 'Inter', ui-sans-serif, system-ui, sans-serif`;
  const mono = (px, wt = 500) => `${wt} ${px}px 'JetBrains Mono', ui-monospace, Menlo, monospace`;

  let w = 0, h = 0;
  let k = RUNGS.findIndex((r) => r.name === 'Human');
  // `pos` is the fractional rung the view sits at; the bar of rung `pos` is
  // exactly full width. Between rungs it is interpolated in log size.
  let pos = k;
  let tween = null;
  let mounted = false;
  const dots = [];

  const compact = () => w < 560;
  const logD = (i) => Math.log10(RUNGS[i].d);

  /** log10 of the size that currently fills the full bar width. */
  function fullLog() {
    const i = Math.floor(pos), f = pos - i;
    if (f === 0 || i + 1 >= RUNGS.length) return logD(i);
    return mix(logD(i), logD(i + 1), f);
  }

  function go(target) {
    target = clip(target, 0, RUNGS.length - 1);
    if (target === k && !tween) return;
    k = target;
    // One rung is a beat; a long jump takes a bit longer but not proportionally.
    const dur = 900 + 260 * Math.min(3, Math.abs(k - pos) - 1);
    tween = { from: pos, to: k, t0: performance.now(), dur };
    sync();
  }

  function step(now) {
    if (!tween) return;
    const u = clip((now - tween.t0) / tween.dur);
    pos = mix(tween.from, tween.to, ease(u));
    if (u >= 1) { tween = null; pos = k; }
  }

  // ------------------------------------------------------------- drawing --

  /** Paint one frame over whatever background app.js has already laid down. */
  function render(now) {
    step(now);

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

    // Biggest first so the smaller ones nest on top.
    bars.sort((a, b) => b.drawW - a.drawW);
    const frac = pos - Math.floor(pos);
    for (const b of bars) {
      // A bar still wider than the frame is the one arriving: it fades in with
      // the tween and is invisible at rest, however close the ratio.
      const alpha = b.trueW > full * 1.01 ? clip(frac * 1.6) : 1;
      if (alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = RUNGS[b.i].color;
      rrect(0, y - barH / 2, Math.min(b.drawW, w + 40), barH, b.drawW > 8 ? 4 : 1.5);
      ctx.fill();
      ctx.restore();
    }

    // Medallions on the full bar and the one just below it; smaller first so
    // the big label paints over the sliver's if they ever meet.
    bars.sort((a, b) => a.drawW - b.drawW);
    const placed = [];
    for (const b of bars) {
      const over = Math.log10(b.trueW / full);
      if (over > 0.05) continue;                         // still arriving: no label yet
      if (b.i < Math.round(pos) - 1) continue;
      // Full size when this bar fills the width, small once it is a tenth of it.
      const s = clip(1 + over);
      const alpha = clip(1 + over / 2.4, 0.35, 1);
      placed.push({ b, x: clip(b.drawW, 54, full), s, alpha });
    }
    for (let n = placed.length - 1; n > 0; n--) {
      const a = placed[n - 1], c = placed[n];
      const need = 70 * a.s + 70 * c.s + 12;
      if (c.x - a.x < need) a.x = Math.max(54, c.x - need);
    }
    for (const p of placed) medallion(p.b, p.x, y - barH / 2, p.s, p.alpha);

    ratio(y, barH, full, ppm);
  }

  function medallion(b, x, barTop, s, alpha) {
    const r = RUNGS[b.i];
    const big = !compact();
    const R = mix(big ? 24 : 20, big ? 46 : 36, s);
    const chipFont = mix(12, big ? 17 : 15, s);
    const sizeFont = mix(11, big ? 14 : 13, s);
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
    const cx = clip(x, cw / 2 + 8, w - cw / 2 - 8);

    ctx.textBaseline = 'top';
    ctx.font = mono(sizeFont, 600);
    ctx.fillStyle = palette.ink;
    ctx.fillText(lengthStr(r.d), cx, textTop);
    if (showNote) {
      ctx.font = sans(sizeFont - 1, 400);
      ctx.fillStyle = palette.dim;
      ctx.fillText(r.note, cx, textTop + sizeFont + 4);
    }

    ctx.fillStyle = r.color;
    rrect(cx - cw / 2, cyChip - ch / 2, cw, ch, 6);
    ctx.fill();
    ctx.font = sans(chipFont, 600);
    ctx.fillStyle = '#0a0d16';
    ctx.textBaseline = 'middle';
    ctx.fillText(r.name, cx, cyChip + 1);

    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = darken(r.color, 0.55);
    ctx.fill();
    ctx.lineWidth = Math.max(2, R * 0.11);
    ctx.strokeStyle = r.color;
    ctx.stroke();
    ctx.font = `${Math.round(R * 1.05)}px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif`;
    ctx.fillStyle = palette.ink;
    ctx.fillText(r.glyph, cx, cy + R * 0.06);

    ctx.restore();
  }

  /** "× 340" under the bar, and a plain note when the sliver is a lie of three pixels. */
  function ratio(y, barH, full, ppm) {
    const i = Math.round(pos);
    if (Math.abs(pos - i) > 0.35 || i === 0) return;
    const prev = RUNGS[i - 1];
    const sliver = prev.d * ppm;
    const fade = clip(1 - Math.abs(pos - i) / 0.35);
    const times = ratioStr(RUNGS[i].d / prev.d);
    const sub = sliver < 2
      ? (compact()
        ? `${prev.name}: ${sliverStr(sliver)} here, drawn as a 3 px tick`
        : `${prev.name} would be ${sliverStr(sliver)} wide here, so it is drawn as a 3 px tick`)
      : `${times} ${pluralName(prev.name)} end to end`;

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const x = Math.max(sliver, 3) + (full - Math.max(sliver, 3)) / 2;
    ctx.font = mono(compact() ? 22 : 30, 600);
    ctx.fillStyle = palette.ink;
    ctx.fillText(`× ${times}`, x, y + barH / 2 + 16);
    ctx.font = sans(compact() ? 12 : 14, 400);
    ctx.fillStyle = palette.dim;
    const half = ctx.measureText(sub).width / 2;
    ctx.fillText(sub, clip(x, half + 12, w - half - 12), y + barH / 2 + 16 + (compact() ? 30 : 40));
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

  function rrect(x, y, bw, bh, r) {
    r = Math.min(r, bw / 2, bh / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + bw, y, x + bw, y + bh, r);
    ctx.arcTo(x + bw, y + bh, x, y + bh, r);
    ctx.arcTo(x, y + bh, x, y, r);
    ctx.arcTo(x, y, x + bw, y, r);
    ctx.closePath();
  }

  function darken(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const c = (sh) => Math.round(((n >> sh) & 255) * (1 - amount));
    return `rgb(${c(16)}, ${c(8)}, ${c(0)})`;
  }

  // -------------------------------------------------------------- chrome --

  function sync() {
    if (!mounted) return;
    el('nestedCount').textContent = `${k + 1} / ${RUNGS.length}`;
    el('nestedPrev').disabled = k === 0;
    el('nestedNext').disabled = k === RUNGS.length - 1;
    el('nestedPrev').title = k > 0 ? `← ${RUNGS[k - 1].name}` : '';
    el('nestedNext').title = k < RUNGS.length - 1 ? `${RUNGS[k + 1].name} →` : '';
    for (const [i, dot] of dots.entries()) dot.classList.toggle('on', i === k);
  }

  function mount() {
    if (!dots.length) {
      const box = el('nestedDots');
      for (const [i, r] of RUNGS.entries()) {
        const d = document.createElement('button');
        d.className = 'dot';
        d.style.setProperty('--c', r.color);
        d.setAttribute('aria-label', r.name);
        d.addEventListener('click', () => go(i));
        box.appendChild(d);
        dots.push(d);
      }
      el('nestedPrev').addEventListener('click', () => go(k - 1));
      el('nestedNext').addEventListener('click', () => go(k + 1));
    }
    mounted = true;
    document.body.classList.add('nested');
    sync();
  }

  function unmount() {
    mounted = false;
    tween = null;
    pos = k;
    document.body.classList.remove('nested');
  }

  // --------------------------------------------------------------- input --

  // A swipe is a page turn. Taps on the right third go up, on the left third down.
  let touch = null;
  const pointerDown = (x) => { touch = { x, t: performance.now() }; };
  function pointerUp(x) {
    if (!touch) return;
    const dx = x - touch.x;
    const dt = performance.now() - touch.t;
    touch = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? k + 1 : k - 1);
    else if (dt < 300) {
      if (x > w * 0.66) go(k + 1);
      else if (x < w * 0.34) go(k - 1);
    }
  }
  function wheel(deltaY) {
    if (Math.abs(deltaY) < 20 || tween) return;
    go(k + (deltaY > 0 ? 1 : -1));
  }
  /** Returns true when the key was one of ours. */
  function key(e) {
    if (e.key === 'ArrowRight' || e.key === ' ') go(k + 1);
    else if (e.key === 'ArrowLeft') go(k - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(RUNGS.length - 1);
    else return false;
    return true;
  }

  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  /** Test hook: park the view at a rung, or a fraction of the way to the next one. */
  function show(slugOrIndex, frac = 0) {
    const i = typeof slugOrIndex === 'number' ? slugOrIndex : RUNGS.findIndex((r) => slug(r.name) === slugOrIndex);
    if (i < 0) throw new Error(`no rung ${slugOrIndex}`);
    tween = null;
    k = frac > 0 ? Math.min(RUNGS.length - 1, i + 1) : i;
    pos = i + frac;
    sync();
  }

  return {
    mount, unmount, render, go, show,
    resize(width, height) { w = width; h = height; },
    pointerDown, pointerUp, wheel, key,
    get rung() { return k; },
    rungs: RUNGS.map((r) => slug(r.name)),
  };
}
