// Draws the app icons and the social preview with the same canvas the explorer
// uses, so the mark on the home screen is made of the same rings as the page.
//
//   node tools/icons.js            # -> src/explorer/assets/*.png, favicon.svg

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { listen } from './serve.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src/explorer/assets');

/**
 * Concentric rings with a lit core — the Powers of Ten view, reduced until it
 * still reads at 48 px. `inset` shrinks the artwork for maskable icons, whose
 * corners Android is free to crop.
 */
const DRAW = `(size, inset) => {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const m = size / 2;
  const u = (f) => f * size * inset;

  // Flat ground on purpose: a full-bleed radial gradient dithers into a 290 KB
  // PNG, and these files ship on every page load.
  x.fillStyle = '#060a16';
  x.fillRect(0, 0, size, size);

  const rings = [
    { r: 0.175, w: 0.022, c: '#ffcf5c', a: 1 },
    { r: 0.295, w: 0.018, c: '#5cd0ff', a: 0.9 },
    { r: 0.415, w: 0.013, c: '#8fc4f5', a: 0.55 },
  ];
  for (const ring of rings) {
    x.globalAlpha = ring.a;
    x.strokeStyle = ring.c;
    x.lineWidth = Math.max(1, u(ring.w));
    x.beginPath();
    x.arc(m, m, u(ring.r), 0, Math.PI * 2);
    x.stroke();
  }

  // One body parked on the middle ring, so the mark reads as an orbit.
  x.globalAlpha = 1;
  const a = -Math.PI / 4;
  x.fillStyle = '#5cd0ff';
  x.beginPath();
  x.arc(m + Math.cos(a) * u(0.295), m + Math.sin(a) * u(0.295), Math.max(1.5, u(0.035)), 0, Math.PI * 2);
  x.fill();

  x.fillStyle = '#ffae3d';
  x.beginPath();
  x.arc(m, m, u(0.072), 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#fff0c2';
  x.beginPath();
  x.arc(m - u(0.016), m - u(0.016), u(0.032), 0, Math.PI * 2);
  x.fill();

  return c.toDataURL('image/png');
}`;

// The large sizes ship as SVG — a vector of three circles is 500 bytes where
// the same art as a 512 PNG is 50 KB, and it stays sharp on any density.
// PNG is kept only where it is actually required: iOS ignores the manifest and
// demands apple-touch-icon.png, and an install-criteria fallback wants a raster
// of at least 192.
const ICONS = [
  ['icon-192.png', 192, 1],
  // Android crops adaptive icons to its own shape; raster is the reliable
  // container for `purpose: maskable`, so this one stays a PNG too.
  ['icon-maskable-192.png', 192, 0.72],
  ['apple-touch-icon.png', 180, 1],
  ['favicon-32.png', 32, 1],
];

/** The same three rings as a vector. `inset` leaves Android room to crop. */
const iconSvg = (inset) => {
  const u = (f) => (f * 64 * inset).toFixed(2);
  const a = -Math.PI / 4;
  const dot = (r) => [32 + Math.cos(a) * r, 32 + Math.sin(a) * r].map((v) => v.toFixed(2));
  const [dx, dy] = dot(Number(u(0.295)));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#060a16"/>
  <g fill="none">
    <circle cx="32" cy="32" r="${u(0.175)}" stroke="#ffcf5c" stroke-width="${u(0.022)}"/>
    <circle cx="32" cy="32" r="${u(0.295)}" stroke="#5cd0ff" stroke-width="${u(0.018)}" opacity="0.9"/>
    <circle cx="32" cy="32" r="${u(0.415)}" stroke="#8fc4f5" stroke-width="${u(0.013)}" opacity="0.55"/>
  </g>
  <circle cx="${dx}" cy="${dy}" r="${u(0.035)}" fill="#5cd0ff"/>
  <circle cx="32" cy="32" r="${u(0.072)}" fill="#ffae3d"/>
  <circle cx="${(32 - Number(u(0.016))).toFixed(2)}" cy="${(32 - Number(u(0.016))).toFixed(2)}" r="${u(0.032)}" fill="#fff0c2"/>
</svg>
`;
};

function chromiumExecutable() {
  const base = '/opt/pw-browsers';
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  if (!existsSync(base)) return undefined;
  const dir = readdirSync(base).filter((n) => /^chromium-\d+$/.test(n)).sort().reverse()[0];
  const bin = dir && path.join(base, dir, 'chrome-linux/chrome');
  return bin && existsSync(bin) ? bin : undefined;
}

const save = async (file, dataUrl) => {
  await writeFile(path.join(OUT, file), Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
  console.log(`  ${path.relative(ROOT, path.join(OUT, file))}`);
};

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: chromiumExecutable(),
  args: ['--ignore-certificate-errors'],
});
const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
await page.goto('about:blank');

for (const [file, size, inset] of ICONS) {
  await save(file, await page.evaluate(([d, s, i]) => eval(`(${d})`)(s, i), [DRAW, size, inset]));
}
for (const [file, inset] of [['icon.svg', 1], ['icon-maskable.svg', 0.72]]) {
  await writeFile(path.join(OUT, file), iconSvg(inset));
  console.log(`  ${path.relative(ROOT, path.join(OUT, file))}`);
}

// Social preview: a real frame of the app rather than a mock-up of one.
const { server, url } = await listen(0);
const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, ignoreHTTPSErrors: true });
await og.goto(`${url}explorer/index.html`, { waitUntil: 'load' });
await og.waitForFunction('window.__explorer !== undefined', null, { timeout: 15000 });
await og.evaluate(() => document.fonts.ready);
await og.evaluate(() => {
  window.__explorer.select('solar-system');
  document.getElementById('firstRun').style.display = 'none';
  document.getElementById('bottom').style.display = 'none';
});
await og.waitForTimeout(400);
await og.screenshot({ path: path.join(OUT, 'og.jpg'), type: 'jpeg', quality: 86 });
console.log(`  ${path.relative(ROOT, path.join(OUT, 'og.jpg'))}`);

await browser.close();
server.close();
