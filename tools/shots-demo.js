// Screenshots of the demo (src/demo/). WebGL runs on SwiftShader in headless
// Chromium, so textures and shaders render the same as on a GPU, only slower.
//
//   CHROMIUM_PATH=... node tools/shots-demo.js [--only name] [--size 1512x857]

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listen } from './serve.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out/shots-demo');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i > -1 ? argv[i + 1] : d; };
const only = opt('--only', null);
const [W, H] = opt('--size', '1512x857').split('x').map(Number);

// name, mode, variant, selected body (solar) or picked names (sizes), extra steps, settle ms
const SHOTS = [
  ['g-em-bh', 'earth-moon', null, ['Earth', 'Moon', 'Sagittarius A*'], ['dark'], 2800],
  ['g-ems', 'earth-moon', null, ['Earth', 'Moon', 'Sun'], ['dark'], 2800],
  ['g-esb', 'earth-moon', null, ['Earth', 'Sun', 'Betelgeuse'], ['dark'], 2800],
  ['moon', 'earth-moon', null, ['Moon'], [], 2500],
  ['moon-dark', 'earth-moon', null, ['Moon'], ['dark'], 2500],
  ['moon-zoom', 'earth-moon', null, ['Moon'], [['zoom', 'Moon'], 2200], 1500],
  ['moon-zoom-dark', 'earth-moon', null, ['Moon'], ['dark', ['zoom', 'Moon'], 2200], 1500],
  ['h-em', 'earth-moon', null, ['Earth', 'Moon'], ['dark', 'side', 1500], 2500],
  ['h-ems', 'earth-moon', null, ['Earth', 'Moon', 'Sun'], ['dark', 'side', 1500], 2500],
  ['h-em-bh', 'earth-moon', null, ['Earth', 'Moon', 'Sagittarius A*'], ['dark', 'side', 1500], 2800],
  ['h-esb', 'earth-moon', null, ['Earth', 'Sun', 'Betelgeuse'], ['dark', 'side', 1500], 2800],
  ['moon-earth-dark', 'earth-moon', null, ['Earth', 'Moon'], ['dark'], 2500],
  ['moon-earth', 'earth-moon', null, ['Earth', 'Moon'], [], 2500],
  ['sizes-home', 'earth-moon', null, null, [], 2500],
  ['sizes-planets', 'earth-moon', null, ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'], [], 2800],
  ['sizes-everything', 'earth-moon', null, ['Sun', 'Mercury', 'Venus', 'Earth', 'Moon', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'], [], 2800],
  ['sizes-side', 'earth-moon', null, ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'], ['side', 1500], 2500],
  ['sizes-end-home', 'earth-moon', null, null, ['end', 1500], 2500],
  ['sizes-end-all', 'earth-moon', null, 'all', ['end', 1500], 2500],
  ['sizes-end-planets', 'earth-moon', null, ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'], ['end', 1500], 2500],
  ['sizes-sun', 'earth-moon', null, ['Sun'], [], 2500],
  ['sizes-beyond', 'earth-moon', null, ['Sun', 'Sagittarius A*', 'Betelgeuse'], [], 2800],
  ['sizes-sun-bh', 'earth-moon', null, ['Sun', 'Sagittarius A*'], [], 2800],
  ['sizes-sun-betelgeuse', 'earth-moon', null, ['Earth', 'Sun', 'Betelgeuse'], [], 2800],
  ['sizes-betelgeuse', 'earth-moon', null, ['Betelgeuse'], [], 2800],
  ['dark-sizes-end-betelgeuse', 'earth-moon', null, ['Earth', 'Sun', 'Betelgeuse'], ['dark', 'end', 1500], 2500],
  ['ss-sun-selected', 'solar-system', 'compressed', 'Sun', [], 2000],
  ['sizes-zoom-earth', 'earth-moon', null, ['Earth', 'Moon', 'Sun'], [['zoom', 'Earth'], 2200], 1500],
  ['sizes-zoom-earth-front', 'earth-moon', null, ['Earth', 'Moon', 'Sun'], ['side', 1500, ['zoom', 'Earth'], 1800], 1200],
  ['sizes-zoom-jupiter-end', 'earth-moon', null, ['Mercury', 'Earth', 'Jupiter', 'Saturn'], ['end', 1500, ['zoom', 'Jupiter'], 1800], 1200],
  ['dark-sizes-beyond', 'earth-moon', null, ['Sun', 'Sagittarius A*', 'Betelgeuse'], ['dark'], 2800],
  ['sizes-earth-moon', 'earth-moon', null, ['Earth', 'Moon'], [], 2500],
  ['ss-compressed', 'solar-system', 'compressed', null, [], 2500],
  ['ss-compressed-light', 'solar-system', 'compressed', null, ['light', 9000], 500],
  ['ss-true', 'solar-system', 'true', null, [], 2500],
  ['ss-true-earth', 'solar-system', 'true', 'Earth', [], 2500],
  ['ss-true-light', 'solar-system', 'true', null, ['light', 6000], 500],
  ['ss-compressed-start', 'solar-system', 'compressed', null, ['light', 400], 100],
  ['dark-sizes-planets', 'earth-moon', null, ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'], ['dark'], 2800],
  ['dark-sizes-home', 'earth-moon', null, null, ['dark'], 2500],
  ['dark-ss-compressed-light', 'solar-system', 'compressed', null, ['dark', 'light', 9000], 500],
  ['dark-ss-true', 'solar-system', 'true', null, ['dark'], 2500],
];

const { server, url } = await listen();
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });

await page.goto(`${url}demo/#earth-moon`);
await page.waitForFunction(() => window.__demo && document.getElementById('loading').classList.contains('off'), null, { timeout: 60000 });
// Let the 4k textures stream in before shooting.
await page.waitForTimeout(9000);

for (const [name, mode, variant, body, steps, settle] of SHOTS) {
  if (only && !only.split(',').includes(name)) continue;
  await page.evaluate(({ mode, variant, body }) => {
    const d = window.__demo;
    d.setMode(mode, variant);
    if (Array.isArray(body)) d.setPicked(body);
    else if (body === 'all') d.setPicked(d.state.bodies.map((b) => b.name));
    else if (body) d.select(d.state.bodies.find((b) => b.name === body));
  }, { mode, variant, body });
  await page.waitForTimeout(1800);
  for (const s of steps) {
    if (s === 'side') await page.evaluate(() => window.__demo.setSide('front'));
    else if (s === 'end') await page.evaluate(() => window.__demo.setSide('end'));
    else if (s === 'light') await page.evaluate(() => window.__demo.startPulse());
    else if (s === 'dark') await page.evaluate(() => window.__demo.setTheme('dark'));
    else if (Array.isArray(s)) await page.evaluate(([, n]) => window.__demo.zoomTo(window.__demo.state.bodies.find((b) => b.name === n)), s);
    else if (typeof s === 'number') await page.waitForTimeout(s);
  }
  await page.waitForTimeout(settle);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  await page.evaluate(() => window.__demo.setTheme('light'));
  console.log('shot', name);
}

// Both layouts must put the pulse front on each planet at the real arrival
// time, and the front must leave from the photosphere, not the centre.
for (const variant of ['compressed', 'true']) {
  const check = await page.evaluate((variant) => {
    const d = window.__demo;
    d.setMode('solar-system', variant);
    const sun = d.state.origin;
    const out = [];
    d.pulse.sim = 0;
    out.push(`t=0: pulse ${d.pulseRadius().toFixed(2)} vs Sun surface ${(sun.r * (sun.sizeTween ? sun.sizeTween.to : sun.size)).toFixed(2)}`);
    for (const t of d.state.targets) {
      d.pulse.sim = t.d / 299792458;
      const body = d.state.bodies.find((b) => b.name === t.name);
      const planet = body.tween ? body.tween.to.length() : body.pos.length();
      out.push(`${t.name}: pulse ${d.pulseRadius().toFixed(1)} vs planet ${planet.toFixed(1)} at ${(t.d / 299792458).toFixed(1)} s`);
    }
    return out;
  }, variant);
  console.log(`${variant} pulse check:\n  ` + check.join('\n  '));
}

// The Earth's atmosphere must stay a thin ring at every camera distance: sample
// the pixel at the centre of the Earth's disc while the camera flies between
// views and make sure it never turns sky-blue (the log-depth bug did that).
await page.evaluate(() => { window.__demo.setMode('earth-moon'); window.__demo.setPicked(['Earth', 'Moon']); });
await page.waitForTimeout(1800);
const blueFrames = [];
for (const view of ['front', 'end', null, 'front', null]) {
  await page.evaluate((v) => window.__demo.setSide(v), view);
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(150);
    const px = await page.evaluate(() => {
      const d = window.__demo;
      const earth = d.state.bodies.find((b) => b.name === 'Earth');
      const v = earth.pos.clone().project(d.camera);
      const c = document.getElementById('stage');
      const x = Math.round((v.x + 1) / 2 * c.width), y = Math.round((1 - v.y) / 2 * c.height);
      // Render and read in one go: the drawing buffer is not preserved.
      d.renderer.render(d.scene, d.camera);
      const gl = d.renderer.getContext();
      const buf = new Uint8Array(4);
      gl.readPixels(x, c.height - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return [...buf];
    });
    // Sky-blue flood: blue high, red low, and much bluer than the ocean texture gets.
    if (px[2] > 200 && px[0] > 110 && px[0] < 170 && px[1] > 170) blueFrames.push({ view, i, px });
  }
}
console.log('atmosphere flood frames:', blueFrames.length, blueFrames.slice(0, 3).map((f) => f.px.join(',')).join(' | ') || 'none');

// Projected diameters in the orthographic compare view must be in the ratio
// of the real radii.
await page.evaluate(() => {
  const d = window.__demo;
  d.setMode('earth-moon');
  d.setPicked(d.state.bodies.map((b) => b.name));
});
await page.waitForTimeout(1800);
await page.evaluate(() => window.__demo.setSide(true, true));
await page.waitForTimeout(2000);
const sizes = await page.evaluate(() => {
  const d = window.__demo;
  const cam = d.camera;
  const pxPerUnit = innerHeight / (cam.top - cam.bottom);
  const earth = d.state.bodies.find((b) => b.name === 'Earth');
  return d.state.bodies.map((b) => `${b.name}: ${(2 * b.r * b.size * pxPerUnit).toFixed(1)} px = ${(b.r * b.size / (earth.r * earth.size)).toFixed(3)} × Earth (data ${(b.r / earth.r).toFixed(3)})`);
});
console.log('ortho =', await page.evaluate(() => window.__demo.camera.isOrthographicCamera === true));
console.log('compare view sizes:\n  ' + sizes.join('\n  '));

// A drag must hand the scene back to the perspective camera; a wheel only zooms.
await page.mouse.move(W / 2, H / 2);
await page.mouse.down();
await page.mouse.move(W / 2 + 60, H / 2 + 10, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(300);
console.log('after drag: persp =', await page.evaluate(() => window.__demo.camera.isPerspectiveCamera === true && !window.__demo.side));
await page.evaluate(() => window.__demo.setSide(true, true));
await page.waitForTimeout(300);
const zoom0 = await page.evaluate(() => window.__demo.camera.zoom);
await page.mouse.move(W / 2, H / 2);
await page.mouse.wheel(0, -200);
await page.waitForTimeout(600);
console.log('after wheel: still ortho =', await page.evaluate(() => window.__demo.camera.isOrthographicCamera === true && window.__demo.side === 'front'),
  '| zoomed:', await page.evaluate((z) => window.__demo.camera.zoom > z, zoom0));

await browser.close();
server.close();
