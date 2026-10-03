// Checks that dist/ is actually installable and actually works offline, rather
// than just containing the right files. Serves dist/ over 127.0.0.1 (a secure
// context, so service workers are allowed) and drives a real browser.
//
//   node tools/verify-site.js

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

// Served under a subdirectory on purpose: GitHub Pages puts a project site at
// /<repo>/, and an absolute path anywhere in the build would 404 there while
// passing happily at the origin root.
const BASE_PATH = '/a-sense-of-scale/';

const server = http.createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!urlPath.startsWith(BASE_PATH)) { res.writeHead(404).end('outside the base path'); return; }
  const stripped = urlPath.slice(BASE_PATH.length);
  const rel = stripped === '' ? 'index.html' : stripped;
  const file = path.join(DIST, rel);
  if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
  try {
    const buf = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.writeHead(404).end('not found');
  }
});

const url = await new Promise((r) => {
  server.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${server.address().port}${BASE_PATH}`));
});

function chromiumExecutable() {
  const base = '/opt/pw-browsers';
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  if (!existsSync(base)) return undefined;
  const dir = readdirSync(base).filter((n) => /^chromium-\d+$/.test(n)).sort().reverse()[0];
  const bin = dir && path.join(base, dir, 'chrome-linux/chrome');
  return bin && existsSync(bin) ? bin : undefined;
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({
  headless: true,
  executablePath: chromiumExecutable(),
  args: ['--ignore-certificate-errors'],
});
const context = await browser.newContext({ viewport: { width: 414, height: 896 }, ignoreHTTPSErrors: true });
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push(m.text()); });

await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction('window.__explorer !== undefined', null, { timeout: 15000 });
check('page boots', true);

// --- manifest -------------------------------------------------------------
const manifest = await page.evaluate(async () => {
  const href = document.querySelector('link[rel=manifest]')?.getAttribute('href');
  const res = await fetch(href);
  return { status: res.status, body: await res.json() };
});
check('manifest fetches', manifest.status === 200, `HTTP ${manifest.status}`);
for (const key of ['name', 'short_name', 'start_url', 'display', 'icons', 'theme_color']) {
  check(`manifest.${key}`, manifest.body[key] !== undefined);
}
check('manifest display is standalone', manifest.body.display === 'standalone', manifest.body.display);
const maskable = manifest.body.icons.some((i) => (i.purpose ?? '').includes('maskable'));
const png192 = manifest.body.icons.some((i) => i.sizes === '192x192' && i.type === 'image/png');
check('manifest has a maskable icon', maskable);
check('manifest has a 192px PNG icon', png192);

// --- icons really exist ---------------------------------------------------
// Resolve every icon the way the browser does — against the document — so the
// check fails on an absolute path instead of quietly testing a different URL.
const iconStatus = await page.evaluate(async (manifestIcons) => {
  const hrefs = [
    ...manifestIcons,
    document.querySelector('link[rel="apple-touch-icon"]').getAttribute('href'),
  ];
  const out = {};
  for (const h of hrefs) out[h] = (await fetch(new URL(h, location.href))).status;
  return out;
}, manifest.body.icons.map((i) => i.src));
for (const [u, status] of Object.entries(iconStatus)) check(`icon ${u}`, status === 200, `HTTP ${status}`);

// --- iOS head tags --------------------------------------------------------
const ios = await page.evaluate(() => ({
  appleIcon: !!document.querySelector('link[rel="apple-touch-icon"]'),
  capable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
  title: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content,
  theme: document.querySelector('meta[name="theme-color"]')?.content,
}));
check('apple-touch-icon link', ios.appleIcon);
check('apple-mobile-web-app-capable', ios.capable === 'yes', ios.capable);
check('apple-mobile-web-app-title', !!ios.title, ios.title);
check('theme-color', !!ios.theme, ios.theme);

// --- service worker -------------------------------------------------------
const swState = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  return { scope: reg.scope, active: !!reg.active };
});
check('service worker activates', swState.active, swState.scope);

check('no page errors while online', errors.length === 0, errors.slice(0, 3).join(' | '));

// --- offline --------------------------------------------------------------
// Google Fonts is a third party we deliberately do not precache, so a failed
// font request offline is expected; only the app shell has to survive.
errors.length = 0;
await page.waitForTimeout(600);        // let the shell precache finish
await context.setOffline(true);
await page.reload({ waitUntil: 'load' });
const offlineOk = await page.evaluate(() => typeof window.__explorer === 'object'
  && document.getElementById('stage')?.width > 0).catch(() => false);
check('works offline after install', !!offlineOk);
const ownOffline = errors.filter((e) => !/fonts\.(googleapis|gstatic)|ERR_FAILED|ERR_INTERNET/.test(e));
check('no app errors offline', ownOffline.length === 0, ownOffline.slice(0, 2).join(' | '));
await context.setOffline(false);
await page.close();

// --- the add-to-home affordance on iOS ------------------------------------
// Safari has no install API, so the button has to appear on its own and open
// the instructions. This is the one path no automated install prompt covers.
const ios17 = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 '
    + '(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  isMobile: true,
  hasTouch: true,
  ignoreHTTPSErrors: true,
});
const ip = await ios17.newPage();
await ip.goto(url, { waitUntil: 'load' });
await ip.waitForFunction('window.__explorer !== undefined', null, { timeout: 15000 });
const btnVisible = await ip.isVisible('#install');
check('iOS shows the Add to Home Screen button', btnVisible);
if (btnVisible) {
  await ip.click('#install');
  check('iOS sheet opens with instructions', await ip.isVisible('#iosSheet'));
  await ip.click('#iosClose');
  check('iOS sheet closes', !(await ip.isVisible('#iosSheet')));
}
await ios17.close();

await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
