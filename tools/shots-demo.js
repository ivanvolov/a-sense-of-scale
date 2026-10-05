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
  ['sizes-home', 'earth-moon', null, null, [], 2500],
  ['sizes-planets', 'earth-moon', null, ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'], [], 2800],
  ['sizes-everything', 'earth-moon', null, 'all', [], 2800],
  ['sizes-sun', 'earth-moon', null, ['Sun'], [], 2500],
  ['sizes-earth-moon', 'earth-moon', null, ['Earth', 'Moon'], [], 2500],
  ['ss-compressed', 'solar-system', 'compressed', null, [], 2500],
  ['ss-compressed-light', 'solar-system', 'compressed', null, ['light', 9000], 500],
  ['ss-true', 'solar-system', 'true', null, [], 2500],
  ['ss-true-earth', 'solar-system', 'true', 'Earth', [], 2500],
  ['ss-true-light', 'solar-system', 'true', null, ['light', 6000], 500],
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

for (const [name, mode, variant, body, steps, settle] of SHOTS) {
  if (only && name !== only) continue;
  await page.evaluate(({ mode, variant, body }) => {
    const d = window.__demo;
    d.setMode(mode, variant);
    if (Array.isArray(body)) d.setPicked(body);
    else if (body === 'all') d.setPicked(d.state.bodies.map((b) => b.name));
    else if (body) d.select(d.state.bodies.find((b) => b.name === body));
  }, { mode, variant, body });
  await page.waitForTimeout(1800);
  for (const s of steps) {
    if (s === 'gap') await page.evaluate(() => window.__demo.toggleGap());
    else if (s === 'light') await page.evaluate(() => window.__demo.startPulse());
    else if (typeof s === 'number') await page.waitForTimeout(s);
  }
  await page.waitForTimeout(settle);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('shot', name);
}

// The compressed layout must put the pulse front on each planet at the real
// arrival time: same mapping both ways.
const check = await page.evaluate(() => {
  const d = window.__demo;
  d.setMode('solar-system', 'compressed');
  return d.state.targets.map((t) => {
    d.pulse.sim = t.d / 299792458;
    const body = d.state.bodies.find((b) => b.name === t.name);
    const planet = body.tween ? body.tween.to.length() : body.pos.length();
    return `${t.name}: pulse ${d.pulseRadius().toFixed(1)} vs planet ${planet.toFixed(1)}`;
  });
});
console.log('compressed pulse check:\n  ' + check.join('\n  '));

await browser.close();
server.close();
