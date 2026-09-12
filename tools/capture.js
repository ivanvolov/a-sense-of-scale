// Headless renderer: walks the timeline frame by frame in Chromium and pipes
// the PNGs straight into ffmpeg. Nothing large ever touches the disk, so a
// 70-second 1080p render costs a few megabytes of output and no scratch space.
//
//   node tools/capture.js                 # full film -> out/space-scale.mp4
//   node tools/capture.js --from 4 --to 9 # just that slice, seconds
//   node tools/capture.js --scene sun-au  # just one scene
//   node tools/capture.js --stills 2,14,31.5   # PNG stills at those seconds
//   node tools/capture.js --jpeg --crf 23 --scale 960   # fast, small preview

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';
import { listen } from './serve.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');

/** One frame from the middle of every beat — the contact sheet for a layout check. */
const DEFAULT_STILLS = [
  2.0, 5.0, 10.0, 14.5, 18.5, 22.0, 26.5, 30.5,
  34.0, 39.0, 46.0, 52.0, 56.5, 62.0, 74.0, 79.5, 84.0,
];

const argv = parseArgs(process.argv.slice(2));

/**
 * Playwright bundles a browser version that may not match what the machine
 * already has. Prefer an installed build over failing with "run npx playwright
 * install", which is not an option on an offline box.
 */
function chromiumExecutable() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    ...expand('/opt/pw-browsers', /^chromium-\d+$/, 'chrome-linux/chrome'),
    ...expand('/opt/pw-browsers', /^chromium_headless_shell-\d+$/, 'chrome-linux/headless_shell'),
  ].filter(Boolean);
  return candidates.find((c) => existsSync(c));   // undefined => Playwright's own copy
}

function expand(base, namePattern, tail) {
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .filter((n) => namePattern.test(n))
    .sort()
    .reverse()
    .map((n) => path.join(base, n, tail));
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const { server, url } = await listen(0);

  const executablePath = chromiumExecutable();
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (e) => { console.error('page error:', e.message); });

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction('window.film && document.body.dataset.ready === "1"', null, { timeout: 30000 });

  const film = await page.evaluate(() => ({
    FPS: window.film.FPS,
    DURATION: window.film.DURATION,
    TOTAL_FRAMES: window.film.TOTAL_FRAMES,
    manifest: window.film.manifest,
  }));

  if (argv.stills) {
    await captureStills(page, film, argv.stills);
    await browser.close();
    server.close();
    return;
  }

  const { from, to } = frameRange(film, argv);
  const total = to - from;
  const outFile = path.join(OUT, argv.out ?? `${argv.scene ?? 'space-scale'}.mp4`);

  const mime = argv.jpeg ? 'image/jpeg' : 'image/png';
  const ff = spawn(ffmpegPath, ffmpegArgs(film.FPS, outFile, argv), { stdio: ['pipe', 'ignore', 'pipe'] });
  let ffErr = '';
  ff.stderr.on('data', (d) => { ffErr += d.toString(); if (ffErr.length > 40000) ffErr = ffErr.slice(-20000); });
  const done = new Promise((res, rej) => {
    ff.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}\n${ffErr.slice(-2000)}`))));
  });

  const started = Date.now();
  for (let n = from; n < to; n++) {
    const dataUrl = await page.evaluate(
      ([frame, type, q]) => { window.film.seek(frame); return window.film.snapshot(type, q); },
      [n, mime, argv.jpeg ? 0.94 : undefined],
    );
    const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));

    const i = n - from + 1;
    if (i % 30 === 0 || i === total) {
      const pct = ((i / total) * 100).toFixed(1);
      const fps = i / ((Date.now() - started) / 1000);
      process.stdout.write(`\r  ${String(i).padStart(5)} / ${total}  ${pct.padStart(5)}%  ${fps.toFixed(1)} fps  `);
    }
  }
  ff.stdin.end();
  process.stdout.write('\n');
  await done;

  await browser.close();
  server.close();
  console.log(`готово: ${outFile}`);
}

function ffmpegArgs(fps, outFile, opts) {
  const vf = [];
  if (opts.scale) vf.push(`scale=${opts.scale}:-2:flags=lanczos`);
  return [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-i', 'pipe:0',
    ...(vf.length ? ['-vf', vf.join(',')] : []),
    '-c:v', 'libx264', '-preset', opts.preset ?? 'slow',
    '-crf', String(opts.crf ?? 17),
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outFile,
  ];
}

function frameRange(film, opts) {
  if (opts.scene) {
    const s = film.manifest.find((m) => m.id === opts.scene);
    if (!s) throw new Error(`нет сцены "${opts.scene}". Есть: ${film.manifest.map((m) => m.id).join(', ')}`);
    return { from: Math.round(s.start * film.FPS), to: Math.round((s.start + s.duration) * film.FPS) };
  }
  const from = opts.from != null ? Math.round(opts.from * film.FPS) : 0;
  const to = opts.to != null ? Math.round(opts.to * film.FPS) : film.TOTAL_FRAMES;
  return { from: Math.max(0, from), to: Math.min(film.TOTAL_FRAMES, to) };
}

async function captureStills(page, film, seconds) {
  for (const sec of seconds) {
    const n = Math.round(sec * film.FPS);
    const dataUrl = await page.evaluate((frame) => {
      window.film.seek(frame);
      return window.film.snapshot('image/png');
    }, n);
    const file = path.join(OUT, `still-${sec.toFixed(2).replace('.', '_')}s.png`);
    await writeFile(file, Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
    console.log(`  ${file}`);
  }
}

function parseArgs(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--jpeg') out.jpeg = true;
    else if (a === '--stills') {
      const next = args[i + 1];
      // Bare --stills means "one frame in the middle of each beat", which is
      // what you want when checking a layout without rendering the film.
      out.stills = next && !next.startsWith('--')
        ? (i++, next.split(',').map(Number))
        : DEFAULT_STILLS;
    } else if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = args[++i];
      out[key] = /^-?\d+(\.\d+)?$/.test(val) ? Number(val) : val;
    }
  }
  return out;
}

main().catch((e) => { console.error(e); process.exit(1); });
