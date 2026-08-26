#!/usr/bin/env node
/**
 * Flaneur OSM Recorder — upstream icon vendoring
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Downloads every icon listed in src/icons/icon-sources.json that has an
 * upstream `raw` URL, normalises it, and writes it to src/icons/<set>/<id>.svg.
 *
 *   node tools/fetch-icons.mjs           # fetch anything missing
 *   node tools/fetch-icons.mjs --force   # re-fetch everything
 *
 * The vendored SVGs are COMMITTED. This script exists to refresh them or to
 * audit them against upstream, not as a build step — `npm run build` must work
 * with no network. Sets with `raw: null` (the Flaneur originals) are skipped;
 * those are authored by hand in this repo.
 *
 * Normalisation, per set:
 *   - viewBox rewritten to "0 0 24 24"; a non-24 grid gets its content wrapped
 *     in <g transform="scale(24/grid)">
 *   - fill="currentColor" on the root so CSS `color:` drives the icon
 *   - XML prolog, width/height, id and xlink cruft stripped
 *
 * The script fails hard on a 404 or an unparseable viewBox rather than writing
 * a broken icon — a missing icon must break the fetch, not the app.
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS_DIR = join(ROOT, 'src', 'icons');
const MANIFEST = join(ICONS_DIR, 'icon-sources.json');

const force = process.argv.includes('--force');

/** Pull the inner markup out of an SVG document and drop upstream metadata. */
function innerMarkup(svgText) {
  const open = svgText.indexOf('<svg');
  const gt = svgText.indexOf('>', open);
  const close = svgText.lastIndexOf('</svg>');
  if (open === -1 || gt === -1 || close === -1) {
    throw new Error('not an SVG document');
  }
  return svgText
    .slice(gt + 1, close)
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/g, '')
    .replace(/<desc\b[^>]*>[\s\S]*?<\/desc>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
}

/** Read the upstream viewBox so we can check it against the declared grid. */
function viewBoxSize(svgText) {
  const m = svgText.match(/viewBox\s*=\s*"([^"]+)"/);
  if (!m) throw new Error('no viewBox');
  const parts = m[1]
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    throw new Error(`unparseable viewBox "${m[1]}"`);
  }
  const [minX, minY, w, h] = parts;
  if (minX !== 0 || minY !== 0) throw new Error(`viewBox origin is not 0 0: "${m[1]}"`);
  if (w !== h) throw new Error(`viewBox is not square: "${m[1]}"`);
  return w;
}

/**
 * Wrap normalised markup in a 24x24 root. Indented to two spaces so a diff of
 * a re-fetch is readable.
 */
function wrap({ ref, set, body, scale, license, sourceUrl }) {
  const indented = body
    .split('\n')
    .map((line) => (line.trim() ? `  ${scale === 1 ? '' : '  '}${line.trim()}` : ''))
    .filter(Boolean)
    .join('\n');

  const content = scale === 1 ? indented : `  <g transform="scale(${scale})">\n${indented}\n  </g>`;

  return [
    `<!-- ${ref} — ${set.license} — ${sourceUrl}`,
    `     Vendored by tools/fetch-icons.mjs. Do not hand-edit; edit the manifest and re-fetch. -->`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">`,
    content,
    `</svg>`,
    '',
  ].join('\n');
  // `license` is destructured for symmetry with the credits builder; unused here.
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  let fetched = 0;
  let skipped = 0;
  const failures = [];

  for (const ref of manifest.icons) {
    const [setId, id] = ref.split(':');
    const set = manifest.sets[setId];
    if (!set) {
      failures.push(`${ref} — set "${setId}" is not declared in the manifest`);
      continue;
    }
    if (!set.raw) {
      skipped++;
      continue; // authored in-repo, nothing to fetch
    }

    const outPath = join(ICONS_DIR, setId, `${id}.svg`);
    if (!force && (await exists(outPath))) {
      skipped++;
      continue;
    }

    const url = set.raw.replace('{id}', id);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();

      // A set's grid is not always uniform (temaki:atm is 50x50 in an
      // otherwise 15x15 set), so the manifest can override it per icon. Any
      // disagreement is fatal: silently trusting the declared grid would
      // scale the icon to the wrong size.
      const grid = manifest.gridOverrides?.[ref] ?? set.grid;
      const size = viewBoxSize(text);
      if (size !== grid) {
        throw new Error(
          `viewBox is ${size} but manifest declares grid ${grid}` +
            ` — add "${ref}": ${size} to gridOverrides if upstream is right`
        );
      }

      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(
        outPath,
        wrap({
          ref,
          set,
          body: innerMarkup(text),
          scale: Number((24 / grid).toFixed(6)),
          license: set.license,
          sourceUrl: (set.blob || set.raw).replace('{id}', id),
        })
      );
      fetched++;
      process.stdout.write(`  fetched ${ref}\n`);
    } catch (err) {
      failures.push(`${ref} — ${err.message} (${url})`);
    }
  }

  process.stdout.write(`\n${fetched} fetched, ${skipped} already present or authored in-repo\n`);

  if (failures.length) {
    process.stderr.write(`\n${failures.length} FAILED:\n`);
    for (const f of failures) process.stderr.write(`  ${f}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
