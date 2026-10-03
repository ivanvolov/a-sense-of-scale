// The explorer: a log-space camera you drive with your fingers.
//
// The camera state is `logSpan` — the base-10 log of how many metres fit across
// the viewport. That one choice is what makes 42 decades tractable: a pinch is
// an addition, a zoom tween is a straight line, and the slider is linear in
// decades. Nothing anywhere multiplies its way toward a float32 cliff.

import { C_LIGHT } from './data.js';
import { WORLDS, worldById } from './worlds.js';
import { lengthStr, lightTime, clockFace, niceBar, duration } from './units.js';

const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, u) => a + (b - a) * u;
const easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

/** Deterministic PRNG (mulberry32) so the starfield is identical every run. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d', { alpha: false });

const PALETTE = {
  bg: '#04060d',
  ink: '#eaf0fb',
  dim: '#8593ad',
  faint: '#4a5670',
  accent: '#ffcf5c',
  cool: '#5cd0ff',
};

let w = 0, h = 0, diag = 0, rect = { left: 0, top: 0 };
let world = WORLDS[0];

const view = { cx: 0, cy: 0, logSpan: 0 };
const state = { planets: false };
const pulse = { on: false, sim: 0, speed: 1, arrivals: [], next: 0 };

let tween = null;
let lastFrame = performance.now();

// ------------------------------------------------------------------ camera --

const spanMetres = () => Math.pow(10, view.logSpan);
const scaleOf = () => w / spanMetres();

const sx = (x) => w / 2 + (x - view.cx) * scaleOf();
const sy = (y) => h / 2 - (y - view.cy) * scaleOf();
const wx = (px) => view.cx + (px - w / 2) / scaleOf();
const wy = (py) => view.cy - (py - h / 2) / scaleOf();

function spanBounds() {
  return [Math.log10(world.span[0]), Math.log10(world.span[1])];
}

function panPixels(dx, dy) {
  const s = scaleOf();
  view.cx -= dx / s;
  view.cy += dy / s;
}

/** Zoom by `dLog` decades of span, keeping the world point under `ax, ay` still. */
function zoomAt(ax, ay, dLog) {
  const [lo, hi] = spanBounds();
  const before = { x: wx(ax), y: wy(ay) };
  view.logSpan = clamp(view.logSpan + dLog, lo, hi);
  const after = { x: wx(ax), y: wy(ay) };
  view.cx += before.x - after.x;
  view.cy += before.y - after.y;
}

function goHome(animated = true) {
  const target = { ...world.home };
  if (!animated) { Object.assign(view, target); return; }
  tween = { from: { ...view }, to: target, t0: performance.now(), dur: 700 };
}

function stepTween(now) {
  if (!tween) return;
  const u = clamp((now - tween.t0) / tween.dur);
  const e = easeInOut(u);
  view.cx = lerp(tween.from.cx, tween.to.cx, e);
  view.cy = lerp(tween.from.cy, tween.to.cy, e);
  view.logSpan = lerp(tween.from.logSpan, tween.to.logSpan, e);
  if (u >= 1) tween = null;
}

// ------------------------------------------------------------------- input --

const pointers = new Map();
let prevGesture = null;

function gestureState() {
  const pts = [...pointers.values()];
  if (!pts.length) return null;
  const mid = {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  };
  let dist = 0;
  if (pts.length >= 2) dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  return { mid, dist, n: pts.length };
}

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX - rect.left, y: e.clientY - rect.top });
  prevGesture = gestureState();
  canvas.classList.add('dragging');
  dismissHint();
  tween = null;
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX - rect.left, y: e.clientY - rect.top });
  const cur = gestureState();
  // Only act when the finger count is unchanged — adding or lifting a finger
  // moves the midpoint discontinuously and would fling the view across a decade.
  if (prevGesture && cur && prevGesture.n === cur.n) {
    panPixels(cur.mid.x - prevGesture.mid.x, cur.mid.y - prevGesture.mid.y);
    if (cur.n >= 2 && prevGesture.dist > 4 && cur.dist > 4) {
      zoomAt(cur.mid.x, cur.mid.y, Math.log10(prevGesture.dist / cur.dist));
    }
  }
  prevGesture = cur;
});

for (const type of ['pointerup', 'pointercancel']) {
  canvas.addEventListener(type, (e) => {
    pointers.delete(e.pointerId);
    prevGesture = gestureState();
    if (!pointers.size) canvas.classList.remove('dragging');
  });
}

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  dismissHint();
  tween = null;
  // A trackpad pinch arrives as ctrl+wheel and wants a much larger step.
  const k = e.ctrlKey ? 0.012 : 0.0022;
  zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY * k);
}, { passive: false });

canvas.addEventListener('dblclick', () => goHome());

addEventListener('keydown', (e) => {
  if (e.key === '+' || e.key === '=') zoomAt(w / 2, h / 2, -0.25);
  else if (e.key === '-' || e.key === '_') zoomAt(w / 2, h / 2, 0.25);
  else if (e.key === '0') goHome();
  else return;
  dismissHint();
});

// ----------------------------------------------------------------- drawing --

let starfield = [];

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  rect = canvas.getBoundingClientRect();
  w = Math.max(1, Math.round(rect.width));
  h = Math.max(1, Math.round(rect.height));
  diag = Math.hypot(w, h);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const r = rng(9);
  starfield = Array.from({ length: Math.round((w * h) / 5200) }, () => ({
    x: r() * w, y: r() * h, s: 0.4 + r() * 1.3, a: 0.1 + r() * 0.5,
  }));
}

function background() {
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, diag * 0.6);
  g.addColorStop(0, 'rgba(16,26,52,0.55)');
  g.addColorStop(1, 'rgba(4,6,13,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#cfe0ff';
  for (const s of starfield) {
    ctx.globalAlpha = s.a;
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.globalAlpha = 1;
}

/** Label requests are collected during the world draw and resolved afterwards. */
let labelQueue = [];

function drawBody(o) {
  const s = scaleOf();
  const px = sx(o.x), py = sy(o.y), pr = o.r * s;

  // Zoomed far enough inside a body that it is the whole picture.
  if (pr > diag && Math.hypot(px - w / 2, py - h / 2) < pr) {
    ctx.fillStyle = o.color;
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
    g.addColorStop(0, o.color2);
    g.addColorStop(1, o.color);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    return;
  }
  if (px + pr < -60 || px - pr > w + 60 || py + pr < -60 || py - pr > h + 60) return;

  if (pr < 1.8) {
    // Honest marker: a dot that admits it is bigger than the thing it marks.
    ctx.fillStyle = o.color2;
    ctx.beginPath();
    ctx.arc(px, py, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = o.color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(px, py, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (o.name) labelQueue.push({ x: px, y: py - 16, text: o.name, color: o.color2, priority: pr, marked: true });
    return;
  }

  if (o.glow) {
    const gr = pr * (1 + 2.2 * o.glow);
    const g = ctx.createRadialGradient(px, py, pr * 0.85, px, py, gr);
    g.addColorStop(0, withAlpha(o.color2, 0.3 * o.glow));
    g.addColorStop(1, withAlpha(o.color2, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, gr, 0, Math.PI * 2);
    ctx.fill();
  }

  const lx = px - (o.emissive ? 0 : pr * 0.42);
  const ly = py - (o.emissive ? 0 : pr * 0.34);
  const g = ctx.createRadialGradient(lx, ly, pr * 0.04, px, py, pr * 1.1);
  g.addColorStop(0, o.color2);
  g.addColorStop(o.emissive ? 0.72 : 0.55, o.color);
  g.addColorStop(1, o.emissive ? o.color : shade(o.color, -0.5));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fill();

  if (o.name) labelQueue.push({ x: px, y: py - pr - 10, text: o.name, color: o.color2, priority: pr });
}

function drawRing(o) {
  const s = scaleOf();
  const pr = o.r * s;
  const ox = sx(0), oy = sy(0);
  if (pr < 1 || pr > 4e6) return;
  const d = Math.hypot(ox - w / 2, oy - h / 2);
  if (pr - d > diag || d - pr > diag) return;   // the circle never enters the frame

  ctx.save();
  ctx.globalAlpha = o.alpha ?? 0.4;
  ctx.strokeStyle = o.color ?? PALETTE.faint;
  ctx.lineWidth = o.bold ? 1.6 : 1;
  ctx.beginPath();
  ctx.arc(ox, oy, pr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  if (o.label) {
    const p = ringLabelPoint(ox, oy, pr);
    if (p) labelQueue.push({ x: p.x, y: p.y - 8, text: o.label, note: o.note, color: o.color, priority: 1e6 - Math.abs(Math.log10(pr)) });
  }
}

/** A point on the circle that is actually inside the viewport, or null. */
function ringLabelPoint(ox, oy, pr) {
  for (const x of [w * 0.5, w * 0.3, w * 0.7]) {
    const dx = x - ox;
    if (Math.abs(dx) > pr) continue;
    const dy = Math.sqrt(pr * pr - dx * dx);
    for (const y of [oy - dy, oy + dy]) if (y > 110 && y < h - 170) return { x, y };
  }
  for (const y of [h * 0.45, h * 0.62]) {
    const dy = y - oy;
    if (Math.abs(dy) > pr) continue;
    const dx = Math.sqrt(pr * pr - dy * dy);
    for (const x of [ox - dx, ox + dx]) if (x > 120 && x < w - 120) return { x, y };
  }
  return null;
}

function drawChip({ x, y, text, color = PALETTE.accent }) {
  ctx.save();
  ctx.font = `500 12px ${monoStack()}`;
  const tw = ctx.measureText(text).width;
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = 'rgba(4,6,13,0.88)';
  ctx.strokeStyle = withAlpha(color, 0.4);
  ctx.lineWidth = 1;
  roundRect(x - tw / 2 - 9, y - 19, tw + 18, 24, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y - 6.5);
  ctx.restore();
}

function paintLabels() {
  labelQueue.sort((a, b) => b.priority - a.priority);
  const boxes = [];
  ctx.textBaseline = 'alphabetic';
  for (const l of labelQueue) {
    ctx.font = `600 13px ${sansStack()}`;
    const tw = ctx.measureText(l.text).width;
    const nw = l.note ? measureWith(l.note, `400 11px ${sansStack()}`) : 0;
    const bw = Math.max(tw, nw);
    const bh = l.note ? 32 : 18;
    const box = { x: l.x - bw / 2 - 6, y: l.y - bh, w: bw + 12, h: bh + 6 };
    if (box.x < 2 || box.x + box.w > w - 2 || box.y < 60 || box.y + box.h > h - 120) continue;
    if (boxes.some((b) => b.x < box.x + box.w && box.x < b.x + b.w && b.y < box.y + box.h && box.y < b.y + b.h)) continue;
    boxes.push(box);

    ctx.textAlign = 'center';
    ctx.font = `600 13px ${sansStack()}`;
    ctx.fillStyle = l.color ?? PALETTE.ink;
    ctx.fillText(l.text, l.x, l.note ? l.y - 14 : l.y);
    if (l.note) {
      ctx.font = `400 11px ${sansStack()}`;
      ctx.fillStyle = PALETTE.dim;
      ctx.fillText(l.note, l.x, l.y);
    }
  }
  labelQueue = [];
}

// ------------------------------------------------------------- light pulse --

function tickPulse(dt) {
  if (!pulse.on) return;
  pulse.sim += dt * pulse.speed;
  const radius = C_LIGHT * pulse.sim;

  const targets = world.lightTargets();
  while (pulse.next < targets.length && radius >= targets[pulse.next].d) {
    const t = targets[pulse.next];
    pulse.arrivals.push({ name: t.name, at: t.d / C_LIGHT });
    pulse.next++;
  }

  const last = targets.length ? targets[targets.length - 1].d : spanMetres();
  if (radius > Math.max(last * 1.6, spanMetres() * 3)) pulse.on = false;
}

function drawPulse() {
  if (!pulse.on && pulse.sim === 0) return;
  const s = scaleOf();
  const pr = C_LIGHT * pulse.sim * s;
  if (pr <= 0 || pr > 4e6) return;
  const ox = sx(world.lightOrigin.x), oy = sy(world.lightOrigin.y);
  const d = Math.hypot(ox - w / 2, oy - h / 2);
  if (pr - d > diag || d - pr > diag) return;

  ctx.save();
  ctx.strokeStyle = PALETTE.cool;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.9;
  ctx.shadowColor = PALETTE.cool;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(ox, oy, pr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.restore();
}

// -------------------------------------------------------------------- HUD ---

const el = (id) => document.getElementById(id);

function updateHud() {
  const s = scaleOf();
  const targetPx = Math.min(200, w * 0.22);
  const bar = niceBar(targetPx / s);
  el('scalebar').style.width = `${Math.round(bar.metres * s)}px`;
  el('scaleValue').textContent = bar.text;
  el('scaleLight').innerHTML = `light crosses this in <b>${lightTime(bar.metres)}</b>`;

  const showClock = pulse.on || pulse.sim > 0;
  el('clock').classList.toggle('on', showClock);
  if (showClock) {
    el('clockTime').textContent = clockFace(pulse.sim);
    el('clockSpeed').textContent = pulse.speed === 1 ? 'real time' : `time ×${pulse.speed}`;
    el('clockTravel').textContent = `${lengthStr(C_LIGHT * pulse.sim)} travelled`;
    el('clockArrivals').innerHTML = pulse.arrivals
      .map((a) => `reached <b>${a.name}</b> at ${duration(a.at)}`).join('<br>');
    labelLightButton();
  }
}

// ------------------------------------------------------------------- loop ---

function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;

  stepTween(now);
  tickPulse(dt);

  background();
  const deferred = [];
  world.draw({
    ctx, w, h, diag, view, state,
    scale: scaleOf(), sx, sy,
    body: drawBody, ring: drawRing, chip: drawChip,
    after: (fn) => deferred.push(fn),   // chips belong on top of the bodies
  });
  for (const fn of deferred) fn();
  drawPulse();
  paintLabels();
  updateHud();

  requestAnimationFrame(frame);
}

// --------------------------------------------------------------------- UI ---

function buildTabs() {
  el('tabs').innerHTML = '';
  for (const wd of WORLDS) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = wd.title;
    b.setAttribute('aria-pressed', String(wd.id === world.id));
    b.onclick = () => selectWorld(wd.id);
    el('tabs').appendChild(b);
  }
}

function buildTools() {
  const box = el('tools');
  box.innerHTML = '';
  if (world.tools.includes('planets')) {
    const b = document.createElement('button');
    b.className = 'chip tool';
    b.textContent = 'Fill the gap with planets';
    b.setAttribute('aria-pressed', String(state.planets));
    b.onclick = () => { state.planets = !state.planets; b.setAttribute('aria-pressed', String(state.planets)); };
    box.appendChild(b);
  }
  if (world.tools.includes('light')) {
    const b = document.createElement('button');
    b.className = 'chip tool';
    lightButton = b;
    b.onclick = () => { startPulse(); };
    box.appendChild(b);

    const speeds = world.timeScales;
    if (speeds) {
      const sp = document.createElement('button');
      sp.className = 'chip';
      const render = () => { sp.textContent = pulse.speed === 1 ? 'Time ×1 (real)' : `Time ×${pulse.speed}`; };
      sp.onclick = () => {
        pulse.speed = speeds[(speeds.indexOf(pulse.speed) + 1) % speeds.length];
        render();
      };
      if (!speeds.includes(pulse.speed)) pulse.speed = speeds[0];
      render();
      box.appendChild(sp);
    }
  }
}

let lightButton = null;

/** Label the one light control for what it will do next. */
function labelLightButton() {
  if (lightButton) lightButton.textContent = pulse.sim > 0 ? '↻ Replay pulse' : 'Send a light pulse';
}

function startPulse() {
  pulse.on = true;
  pulse.sim = 0;
  pulse.arrivals = [];
  pulse.next = 0;
  labelLightButton();
  dismissHint();
}

function selectWorld(id) {
  world = worldById(id);
  state.planets = false;
  pulse.on = false;
  pulse.sim = 0;
  pulse.arrivals = [];
  pulse.next = 0;
  pulse.speed = world.timeScales ? world.timeScales[1] : 1;

  el('worldTitle').textContent = world.title;
  el('worldHint').textContent = world.hint;
  buildTabs();
  buildTools();
  labelLightButton();
  goHome(false);
  if (world.autoLight) startPulse();
  try { location.hash = world.id; } catch { /* sandboxed: fine, the tab still works */ }
}

el('reset').onclick = () => goHome();

function dismissHint() {
  const f = el('firstRun');
  if (f && !f.classList.contains('gone')) f.classList.add('gone');
}
el('firstRun').onclick = dismissHint;
setTimeout(dismissHint, 6500);

// --------------------------------------------------- add to home screen ----

/**
 * Two different worlds. Chrome and Edge fire `beforeinstallprompt` and let us
 * trigger the real installer; Safari has no such API, so iOS gets a card
 * telling it where the Share menu is. Neither applies inside an iframe — there
 * the install would bookmark the host page, not this one — nor once the app is
 * already running from the home screen.
 */
const standalone = () =>
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const isIosSafari = () => {
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return iOS && !/CriOS|FxiOS|EdgiOS/.test(ua);
};

let installEvent = null;
const installBtn = el('install');
const framed = window.top !== window.self;

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  if (!framed && !standalone()) installBtn.hidden = false;
});

addEventListener('appinstalled', () => { installBtn.hidden = true; installEvent = null; });

if (!framed && !standalone() && isIosSafari()) installBtn.hidden = false;

installBtn.onclick = async () => {
  if (installEvent) {
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    installEvent = null;
    if (outcome === 'accepted') installBtn.hidden = true;
    return;
  }
  el('iosSheet').hidden = false;
};
el('iosClose').onclick = () => { el('iosSheet').hidden = true; };
el('iosSheet').onclick = (e) => { if (e.target === el('iosSheet')) el('iosSheet').hidden = true; };

// ------------------------------------------------------------------ helpers -

function roundRect(x, y, bw, bh, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + bw, y, x + bw, y + bh, r);
  ctx.arcTo(x + bw, y + bh, x, y + bh, r);
  ctx.arcTo(x, y + bh, x, y, r);
  ctx.arcTo(x, y, x + bw, y, r);
  ctx.closePath();
}

function measureWith(text, font) {
  const prev = ctx.font;
  ctx.font = font;
  const m = ctx.measureText(text).width;
  ctx.font = prev;
  return m;
}

const sansStack = () => "'Inter', ui-sans-serif, system-ui, sans-serif";
const monoStack = () => "'JetBrains Mono', ui-monospace, Menlo, monospace";

function rgb(hex) {
  const x = hex.replace('#', '');
  const f = x.length === 3 ? x.split('').map((c) => c + c).join('') : x;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
}
function withAlpha(hex, a) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function shade(hex, amount) {
  const [r, g, b] = rgb(hex);
  const f = (v) => Math.round(clamp(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount, 0, 255));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// ------------------------------------------------------------------- boot ---

addEventListener('resize', resize);
resize();
selectWorld((location.hash || '').replace('#', '') || WORLDS[0].id);
requestAnimationFrame((t) => { lastFrame = t; frame(t); });

// A small surface for automated checks: drive the camera without a mouse.
window.__explorer = {
  view, pulse, state,
  select: selectWorld,
  setSpan(metres) { tween = null; view.logSpan = clamp(Math.log10(metres), ...spanBounds()); },
  center(x, y) { view.cx = x; view.cy = y; },
  worlds: WORLDS.map((wd) => wd.id),
};
