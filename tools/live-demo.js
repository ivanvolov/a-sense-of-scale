// Click through the deployed demo and make sure it is the commit we think.
//
//   CHROMIUM_PATH=... node tools/live-demo.js <sha> [url]

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
const [sha, url = 'https://a-sense-of-scale.vercel.app/demo/'] = process.argv.slice(2);
if (!sha) { console.error('usage: live-demo.js <sha> [url]'); process.exit(1); }

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1512, height: 857 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });

// The deploy takes a little while to go live; poll until the page serves the sha.
let live = false;
for (let i = 0; i < 18 && !live; i++) {
  const res = await page.goto(url + '?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
  const html = await res.text();
  live = html.includes(`@${sha}/src/demo/demo.js`) && html.includes(`@${sha}/src/demo/tex/`);
  if (!live) await page.waitForTimeout(5000);
}
console.log('served sha matches:', live);
if (!live) { await browser.close(); process.exit(2); }

await page.waitForFunction(() => window.__demo && document.getElementById('loading').classList.contains('off'), null, { timeout: 90000 });
await page.waitForTimeout(4000);

await page.click('#dock button:nth-of-type(2)');          // The planets
await page.waitForTimeout(1800);
await page.locator('#dock button.tog').nth(0).click();    // Front
await page.waitForTimeout(1800);
console.log('front ortho:', await page.evaluate(() => window.__demo.camera.isOrthographicCamera === true));
await page.screenshot({ path: path.join(OUT, 'live-compare.png') });
await page.locator('#dock button.tog').nth(1).click();    // Along
await page.waitForTimeout(1800);
console.log('along ortho:', await page.evaluate(() => window.__demo.camera.isOrthographicCamera === true && window.__demo.side === 'end'));
await page.screenshot({ path: path.join(OUT, 'live-along.png') });
await page.mouse.move(700, 430); await page.mouse.wheel(0, -200); await page.waitForTimeout(500);
console.log('after wheel still along:', await page.evaluate(() => window.__demo.camera.isOrthographicCamera === true && window.__demo.side === 'end'));
await page.mouse.move(700, 430); await page.mouse.down(); await page.mouse.move(760, 440, { steps: 5 }); await page.mouse.up();
await page.waitForTimeout(400);
console.log('after drag persp:', await page.evaluate(() => window.__demo.camera.isPerspectiveCamera === true && !window.__demo.side));

await page.click('#modes button[data-mode="solar-system"]');
await page.waitForTimeout(2000);
await page.click('#dock button.go');                       // Send light
await page.waitForTimeout(7000);
console.log('pulse arrow visible:', await page.evaluate(() => window.__demo.pulse.arrow.visible && window.__demo.pulse.arrow.scale.x > 0));
await page.locator('#dock .seg button').nth(0).click();
console.log('speed picker:', await page.evaluate(() => [...document.querySelectorAll('#dock .seg button')].map((b) => b.textContent).join(' ')), '| picked ×1 →', await page.evaluate(() => window.__demo.pulse.speed));
await page.screenshot({ path: path.join(OUT, 'live-light.png') });
await page.click('#theme');
await page.waitForTimeout(800);
console.log('theme:', await page.evaluate(() => document.documentElement.dataset.theme));
await page.screenshot({ path: path.join(OUT, 'live-dark.png') });

await browser.close();
