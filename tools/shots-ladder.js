// Screenshots of the nested-bars page: a few rungs at rest and mid-tween, on a
// desktop window and a phone, to eyeball the layout without a device in hand.
//
//   node tools/shots-ladder.js
//   node tools/shots-ladder.js --device phone

import { mkdir } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { listen } from './serve.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out', 'shots-ladder');

const DEVICES = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
};

// rung slug, then an optional fraction into the tween towards the next rung.
const SHOTS = [
  ['human', 0],
  ['human', 0.35],
  ['human', 0.7],
  ['blue-whale', 0],
  ['hydrogen-atom', 0],
  ['earth', 0],
  ['one-light-year', 0],
  ['observable-universe', 0],
];

function chromiumExecutable() {
  const base = '/opt/pw-browsers';
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  if (!existsSync(base)) return undefined;
  const dir = readdirSync(base).filter((n) => /^chromium-\d+$/.test(n)).sort().reverse()[0];
  if (!dir) return undefined;
  const p = path.join(base, dir, 'chrome-linux', 'chrome');
  return existsSync(p) ? p : undefined;
}

const devArg = process.argv.indexOf('--device');
const device = devArg > -1 ? process.argv[devArg + 1] : 'desktop';
const vp = DEVICES[device];
if (!vp) throw new Error(`unknown device ${device}`);

await mkdir(OUT, { recursive: true });
const { server, url } = await listen(0);
const browser = await chromium.launch({ executablePath: chromiumExecutable() });
const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 2 });
await page.goto(`${url}ladder.html#human`);
await page.waitForTimeout(600);

for (const [slug, frac] of SHOTS) {
  await page.evaluate(([s, f]) => window.__ladder.show(s, f), [slug, frac]);
  await page.waitForTimeout(80);
  const file = path.join(OUT, `${device}-${slug}${frac ? `-${Math.round(frac * 100)}` : ''}.png`);
  await page.screenshot({ path: file });
  console.log(path.relative(ROOT, file));
}

await browser.close();
server.close();
