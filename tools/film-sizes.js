// Frame-by-frame film of the Sizes view. Chromium on SwiftShader cannot render
// 30 fps live, so time is virtual: performance.now and requestAnimationFrame
// are replaced, the camera is scripted, and every frame is rendered and
// screenshotted before the clock moves on.
//
//   CHROMIUM_PATH=... node tools/film-sizes.js [--size 1280x720] [--fps 30] [--out out/film] [--probe] [--every N]
//
// --probe  print body positions per scene and exit
// --every  render only every Nth frame (quick preview of the choreography)

import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listen } from './serve.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i > -1 ? argv[i + 1] : d; };
const [W, H] = opt('--size', '1280x720').split('x').map(Number);
const FPS = Number(opt('--fps', 30));
const OUT = path.resolve(ROOT, opt('--out', 'out/film'));
const EVERY = Number(opt('--every', 1));
const FROM = Number(opt('--from', 0)), TO = Number(opt('--to', 1e9));
const probe = argv.includes('--probe');

// Camera shots. Centres are resolved per frame from live body positions.
// ctr: 'Earth+Moon' | 'Earth' | 'Sun' | 'Betelgeuse' | [x,y,z]; w: width in Earth radii.
// A shot blends from `a` to `b`; width moves on a log scale, the centre follows
// with s = k^p so the Earth stays in frame while the view backs away.
const SHOTS = [
  { t0: 0, t1: 4.0, a: { ctr: 'Earth+Moon', w: 5.4, el: 7, az: -8 }, b: { ctr: 'Earth+Moon', w: 5.0, el: 10, az: 6 }, p: 1 },
  { t0: 4.0, t1: 6.2, a: { ctr: 'Earth+Moon', w: 5.0, el: 10, az: 6 }, b: { ctr: 'Earth+Moon', w: 6.2, el: 11, az: 12 }, p: 1 },
  { t0: 6.2, t1: 14.0, a: { ctr: 'Earth+Moon', w: 6.2, el: 11, az: 12 }, b: { ctr: 'Sun', w: 300, el: 14, az: 30 }, p: 4 },
  { t0: 14.0, t1: 16.0, a: { ctr: 'Sun', w: 300, el: 14, az: 30 }, b: { ctr: 'Sun', w: 300, el: 14, az: 34 }, p: 1 },
  { t0: 16.0, t1: 27.0, a: { ctr: 'Sun', w: 300, el: 14, az: 34 }, b: { ctr: 'Betelgeuse', w: 215000, el: 10, az: -40 }, p: 5, anchor: [-0.25, 0.3886] },
  { t0: 27.0, t1: 31.0, a: { ctr: 'Betelgeuse', w: 215000, el: 10, az: -40 }, b: { ctr: 'Betelgeuse', w: 215000, el: 9, az: -48 }, p: 1 },
];
// Things that happen to the app at a given time.
const EVENTS = [
  { t: 0, picked: ['Earth', 'Moon'], last: 'Earth' },
  { t: 4.0, picked: ['Earth', 'Moon', 'Sun'], last: 'Earth' },
  { t: 11.0, last: 'Sun' },
  { t: 16.0, picked: ['Earth', 'Moon', 'Sun', 'Betelgeuse'], last: 'Sun' },
  { t: 22.0, last: 'Betelgeuse' },
];
const DURATION = 31;

const { server, url } = await listen();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });

await page.addInitScript(() => {
  let T = 1000;
  performance.now = () => T;
  window.__cb = null;
  window.requestAnimationFrame = (cb) => { window.__cb = cb; return 1; };
  window.__step = (ms) => { T += ms; const cb = window.__cb; window.__cb = null; if (cb) cb(T); };
  try { localStorage.setItem('demo-theme', 'dark'); } catch { /* ignore */ }
});
await page.goto(`${url}demo/#earth-moon`);
await page.waitForFunction(() => window.__demo && document.getElementById('loading')?.classList.contains('off'), null, { timeout: 120000, polling: 500 });
await page.evaluate(() => window.__step(16));
await page.waitForLoadState('networkidle');
await page.waitForTimeout(6000);   // 4k textures land and swap in
await page.evaluate(() => { window.__demo.setMode('earth-moon'); window.__demo.setTheme('dark'); });
await page.evaluate(() => { document.getElementById('tip').style.display = 'none'; });

// Pose helper lives in the page: it resolves centres from live positions.
await page.evaluate(() => {
  const d = window.__demo;
  const THREE_V = d.state.origin.pos.constructor;
  const body = (n) => d.state.bodies.find((b) => b.name === n);
  const pos = (b) => b.pos;
  window.__ctr = (c) => {
    if (Array.isArray(c)) return new THREE_V(...c);
    if (c === 'Earth+Moon') return pos(body('Earth')).clone().add(pos(body('Moon'))).multiplyScalar(0.5);
    return pos(body(c)).clone();
  };
  window.__pose = (a, b, k, p, kw, anchor) => {
    const s = Math.pow(k, p);
    const w = Math.exp(Math.log(a.w) + (Math.log(b.w) - Math.log(a.w)) * kw);
    let c;
    if (anchor) {
      const bt = body('Betelgeuse'), sun = window.__ctr(a.ctr);
      const limb = bt.pos.x - bt.r;
      const u = Math.min(1, Math.max(0, Math.log(w / 50000) / Math.log(215000 / 50000))), g = anchor[0] + (anchor[1] - anchor[0]) * u * u * (3 - 2 * u);
      const tgt = new THREE_V(limb + w * g, sun.y, sun.z);
      const m = Math.min(1, k / 0.15), mm = m * m * (3 - 2 * m);
      c = sun.lerp(tgt, mm);
    } else c = window.__ctr(a.ctr).lerp(window.__ctr(b.ctr), s);
    d.flyFrame({ center: c, width: w, el: a.el + (b.el - a.el) * k, az: a.az + (b.az - a.az) * k }, 0);
    d.controls.update();
  };
  window.__apply = (ev) => {
    if (ev.picked) d.setPicked(ev.picked);
    if (ev.last) d.state.last = ev.last;
  };
});

if (probe) {
  for (const picked of [['Earth', 'Moon'], ['Earth', 'Moon', 'Sun'], ['Earth', 'Moon', 'Sun', 'Betelgeuse']]) {
    await page.evaluate((p) => window.__demo.setPicked(p), picked);
    for (let i = 0; i < 80; i++) await page.evaluate(() => window.__step(33.3));
    const out = await page.evaluate(() => window.__demo.state.bodies.filter((b) => b.shown).map((b) => [b.name, +b.pos.x.toFixed(2), +b.pos.y.toFixed(2), +b.pos.z.toFixed(2), +b.r.toFixed(2), +b.size.toFixed(2)]));
    console.log(picked.join('+'), JSON.stringify(out), JSON.stringify(await page.evaluate(() => ({ ...window.__demo.state.rowFrame, center: window.__demo.state.rowFrame.center.toArray() }))));
  }
  await browser.close(); server.close();
  process.exit(0);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const N = Math.round(DURATION * FPS);
let ei = 0;
const t0 = Date.now();
let written = 0;
for (let f = 0; f < N; f++) {
  const t = f / FPS;
  const skip = t < FROM || t > TO;
  while (ei < EVENTS.length && EVENTS[ei].t <= t + 1e-9) { await page.evaluate((ev) => window.__apply(ev), EVENTS[ei]); ei++; }
  const shot = SHOTS.find((s) => t >= s.t0 && t < s.t1) ?? SHOTS[SHOTS.length - 1];
  const raw = Math.min(1, Math.max(0, (t - shot.t0) / (shot.t1 - shot.t0)));
  const k = raw * raw * (3 - 2 * raw);
  await page.evaluate(([a, b, k, p, an]) => window.__pose(a, b, k, p, k, an), [shot.a, shot.b, k, shot.p, shot.anchor]);
  await page.evaluate((ms) => window.__step(ms), 1000 / FPS);
  if (skip && f % 15 === 0) await page.screenshot({ type: 'jpeg', quality: 20 });
  if (!skip && f % EVERY === 0) {
    await page.screenshot({ path: path.join(OUT, `f${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 95 });
    written++;
  }
  if (f % 30 === 0) console.log(`frame ${f}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
console.log('frames', written);
await browser.close();
server.close();
