// Flattens the explorer's ES modules into one self-contained HTML file.
//
// The source stays modular because that is how it is pleasant to edit; the
// shipped page is a single file because that is how it is pleasant to host —
// drop it on any static server, mail it, or publish it as an artifact, with no
// build step at the other end.
//
//   node tools/bundle.js            # -> out/explorer.html
//   node tools/bundle.js --out x.html

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY_HTML = path.join(ROOT, 'src/explorer/index.html');
const ENTRY_JS = path.join(ROOT, 'src/explorer/app.js');

const IMPORT_RE = /^[ \t]*import[\s\S]*?from\s+['"]([^'"]+)['"];?[ \t]*\r?\n?/gm;

/** Depth-first module walk: a module is emitted only after everything it imports. */
async function collect(file, seen = new Set(), out = []) {
  const abs = path.resolve(file);
  if (seen.has(abs)) return out;
  seen.add(abs);

  const src = await readFile(abs, 'utf8');
  for (const m of src.matchAll(IMPORT_RE)) {
    const spec = m[1];
    if (!spec.startsWith('.')) throw new Error(`${abs}: bare import "${spec}" cannot be inlined`);
    await collect(path.resolve(path.dirname(abs), spec), seen, out);
  }

  out.push({ abs, body: strip(src) });
  return out;
}

/**
 * Turn a module into plain script text: drop the imports, drop the `export`
 * keyword. Safe here only because the modules share one flat namespace with no
 * duplicate top-level names — `npm run check:bundle` is what proves that.
 */
function strip(src) {
  return src
    .replace(IMPORT_RE, '')
    .replace(/^export\s+(?=(const|let|var|function|class)\b)/gm, '')
    .trimStart();
}

/** Every top-level binding, so a collision fails the build instead of the page. */
function topLevelNames(body) {
  const names = [];
  const re = /^(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm;
  for (const m of body.matchAll(re)) names.push(m[1]);
  return names;
}

/** Inline every module into src/explorer/index.html and return the HTML. */
export async function buildBundle() {
  const modules = await collect(ENTRY_JS);

  const owner = new Map();
  for (const m of modules) {
    for (const n of topLevelNames(m.body)) {
      if (owner.has(n)) {
        throw new Error(
          `duplicate top-level name "${n}" in ${path.relative(ROOT, m.abs)} ` +
          `and ${path.relative(ROOT, owner.get(n))} — rename one before bundling`,
        );
      }
      owner.set(n, m.abs);
    }
  }

  const js = modules
    .map((m) => `// ---- ${path.relative(ROOT, m.abs)} ${'-'.repeat(Math.max(3, 66 - m.abs.length))}\n${m.body}`)
    .join('\n\n');

  const html = await readFile(ENTRY_HTML, 'utf8');
  const tag = /<script type="module" src="\.\/app\.js"><\/script>/;
  if (!tag.test(html)) throw new Error('entry script tag not found in index.html');

  return { html: html.replace(tag, `<script>\n(() => {\n${js}\n})();\n</script>`), moduleCount: modules.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outArg = process.argv.indexOf('--out');
  const outFile = outArg > -1 ? path.resolve(process.argv[outArg + 1]) : path.join(ROOT, 'out/explorer.html');
  const { html, moduleCount } = await buildBundle();
  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, html);
  console.log(`${path.relative(process.cwd(), outFile)} — ${moduleCount} modules, ${(html.length / 1024).toFixed(0)} KB`);
}
