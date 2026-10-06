// Draws src/demo/tex/betelgeuse.jpg: an equirectangular photosphere with the
// few huge convection cells of a red supergiant (VLT/SPHERE and ALMA images
// show a handful of bright patches on an orange disc, not Sun-like granules).
// Procedural and seeded, so the file is reproducible.
//
//   CHROMIUM_PATH=... node tools/make-betelgeuse.js

import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
const dataUrl = await page.evaluate(() => {
  const W = 2048, H = 1024;
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  // 3D Worley noise: distance to the nearest of a jittered point per lattice cell.
  const hash = (x, y, z, k) => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647) + Math.imul(k, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const sm = (t) => t * t * (3 - 2 * t);
  const vnoise = (x, y, z) => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = sm(x - ix), fy = sm(y - iy), fz = sm(z - iz);
    const l = (a, b, t) => a + (b - a) * t;
    const h = (i, j, k) => hash(ix + i, iy + j, iz + k, 9);
    return l(l(l(h(0, 0, 0), h(1, 0, 0), fx), l(h(0, 1, 0), h(1, 1, 0), fx), fy),
      l(l(h(0, 0, 1), h(1, 0, 1), fx), l(h(0, 1, 1), h(1, 1, 1), fx), fy), fz);
  };
  const pt = (x, y, z) => [x + hash(x, y, z, 1), y + hash(x, y, z, 2), z + hash(x, y, z, 3)];
  const worley = (x, y, z) => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    let f1 = 9, f2 = 9;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const p = pt(ix + dx, iy + dy, iz + dz);
      const d = Math.hypot(p[0] - x, p[1] - y, p[2] - z);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    return [f1, f2];
  };

  // A few large bright plumes, as directions on the sphere.
  const hot = [];
  for (let i = 0; i < 5; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    hot.push({ d: [s * Math.cos(a), u, s * Math.sin(a)], w: 0.35 + rnd() * 0.3, k: 0.5 + rnd() * 0.5 });
  }

  const ramp = [
    [0.00, [70, 12, 3]],
    [0.35, [150, 38, 10]],
    [0.60, [214, 80, 20]],
    [0.85, [244, 124, 40]],
    [1.00, [255, 176, 84]],
  ];
  const color = (v) => {
    v = Math.min(1, Math.max(0, v));
    for (let i = 1; i < ramp.length; i++) {
      if (v <= ramp[i][0]) {
        const [a, ca] = ramp[i - 1], [b, cb] = ramp[i];
        const t = (v - a) / (b - a);
        return ca.map((c, j) => c + (cb[j] - c) * t);
      }
    }
    return ramp[ramp.length - 1][1];
  };

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - (y + 0.5) / H) * Math.PI;
    for (let x = 0; x < W; x++) {
      const lon = ((x + 0.5) / W) * Math.PI * 2;
      const p = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
      // Soft, large-scale mottling: a few broad cells, no sharp lanes.
      const [a1] = worley(p[0] * 2.2 + 11, p[1] * 2.2 + 3, p[2] * 2.2 + 7);
      const n1 = vnoise(p[0] * 1.9 + 4, p[1] * 1.9 + 1, p[2] * 1.9 + 8);
      const n2 = vnoise(p[0] * 4.6 + 2, p[1] * 4.6 + 6, p[2] * 4.6 + 3);
      let v = 0.26 + 0.34 * n1 + 0.14 * n2 + 0.16 * Math.min(1, a1 * 1.3);
      for (const h of hot) {
        const dot = p[0] * h.d[0] + p[1] * h.d[1] + p[2] * h.d[2];
        v += h.k * 0.3 * Math.exp(-((1 - dot) / (h.w * h.w)));
      }
      const [r, gg, b] = color(v);
      const i = (y * W + x) * 4;
      img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL('image/jpeg', 0.92);
});
await browser.close();
await writeFile(path.join(ROOT, 'src/demo/tex/betelgeuse.jpg'), Buffer.from(dataUrl.split(',')[1], 'base64'));
console.log('wrote src/demo/tex/betelgeuse.jpg');
