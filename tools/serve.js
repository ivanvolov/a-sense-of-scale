// Tiny static server. ES modules refuse to load over file://, and the renderer
// needs the exact same URLs the browser preview uses, so both go through here.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

// Fonts are pulled straight out of node_modules — nothing binary is committed.
const FONT_DIRS = {
  '/vendor/inter/': path.dirname(require.resolve('@fontsource/inter/package.json')) + '/files/',
  '/vendor/mono/': path.dirname(require.resolve('@fontsource/jetbrains-mono/package.json')) + '/files/',
};

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
};

function resolve(urlPath) {
  for (const [prefix, dir] of Object.entries(FONT_DIRS)) {
    if (urlPath.startsWith(prefix)) {
      const name = path.basename(urlPath.slice(prefix.length));
      return path.join(dir, name);
    }
  }
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');
  const abs = path.join(SRC, rel);
  // Never serve anything outside src/ through the generic branch.
  return abs.startsWith(SRC + path.sep) ? abs : null;
}

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = resolve(urlPath);
      if (!file) { res.writeHead(403).end('forbidden'); return; }
      const buf = await readFile(file);
      res.writeHead(200, {
        'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(buf);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
}

/** Start on an ephemeral port and resolve with { server, url }. */
export function listen(port = 0) {
  return new Promise((resolve_) => {
    const server = createServer();
    server.listen(port, '127.0.0.1', () => {
      resolve_({ server, url: `http://127.0.0.1:${server.address().port}/` });
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 5178);
  listen(port).then(({ url }) => console.log(`preview: ${url}`));
}
