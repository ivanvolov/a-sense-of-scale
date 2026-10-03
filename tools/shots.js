// Screenshots of the app at chosen worlds and zoom levels. Used to eyeball
// layout at sizes a person would actually hold: a desktop window and an iPad.
//
//   node tools/shots.js
//   node tools/shots.js --device ipad

import { mkdir } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { listen } from './serve.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out', 'shots');

const DEVICES = {
  desktop: { width: 1440, height: 900 },
  ipad: { width: 1024, height: 1366 },
  phone: { width: 390, height: 844 },
};

// world id, metres across the viewport, and where to look.
const SHOTS = [
  ['earth-moon', null, null, 'home'],
  ['earth-moon', 3.0e7, [0, 0], 'earth'],
  ['earth-moon', 6.0e8, [1.92e8, 0], 'gap-planets', { planets: true }],
  ['solar-system', null, null, 'home'],
  ['solar-system', 4.0e11, [0, 0], 'inner'],
  // Powers of Ten has no camera: the sixth field parks it on a rung, or a
  // fraction of the way into the tween towards the next one.
  ['powers-of-ten', null, null, 'human', null, ['human', 0]],
  ['powers-of-ten', null, null, 'human-mid', null, ['human', 0.6]],
  ['powers-of-ten', null, null, 'atom', null, ['hydrogen-atom', 0]],
  ['powers-of-ten', null, null, 'universe', null, ['observable-universe', 0]],
];

function chromiumExecutable() {
  const base = '/opt/pw-browsers';
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  if (!existsSync(base)) return undefined;
  const dir = readdirSync(base).filter((n) => /^chromium-\d+$/.test(n)).sort().reverse()[0];
  const bin = dir && path.join(base, dir, 'chrome-linux/chrome');
  return bin && existsSync(bin) ? bin : undefined;
}

const deviceName = process.argv.includes('--device')
  ? process.argv[process.argv.indexOf('--device') + 1] : 'desktop';
const viewport = DEVICES[deviceName] ?? DEVICES.desktop;

const { server, url } = await listen(0);
// The agent proxy re-signs TLS, so Google Fonts fails cert checks in here.
// The shots are only for eyeballing layout; accept it so the real fonts load.
const browser = await chromium.launch({
  headless: true,
  executablePath: chromiumExecutable(),
  args: ['--ignore-certificate-errors'],
});
const page = await browser.newPage({ viewport, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
page.on('pageerror', (e) => console.error('page error:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });

await mkdir(OUT, { recursive: true });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction('window.__explorer !== undefined', null, { timeout: 15000 });
await page.evaluate(() => document.fonts.ready);

for (const [worldId, span, center, tag, state, rung] of SHOTS) {
  await page.evaluate(([id, sp, c, st, rg]) => {
    const x = window.__explorer;
    x.select(id);
    if (st) Object.assign(x.state, st);
    if (sp) x.setSpan(sp);
    if (c) x.center(c[0], c[1]);
    if (rg) x.nested.show(rg[0], rg[1]);
    document.getElementById('firstRun').style.display = 'none';
  }, [worldId, span, center, state, rung]);
  // Let the pulse travel a little before we photograph it.
  await page.waitForTimeout(260);
  const file = path.join(OUT, `${deviceName}-${worldId}-${tag}.png`);
  await page.screenshot({ path: file });
  console.log(`  ${file}`);
}

await browser.close();
server.close();
