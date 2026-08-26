/**
 * Flaneur OSM Recorder — Icon and preset-tag audit
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Run with: npm test
 *
 * No test framework and no dependencies — plain Node, same as the storage
 * tests. This file guards three things that break silently:
 *
 *   1. A preset pointing at an icon that is not on disk. The app falls back to
 *      a generic pin, so a typo'd ref shows a plausible-looking wrong icon
 *      instead of an error. Only a build-time check catches it.
 *   2. An icon on disk with no entry in icon-sources.json. MDI is Apache-2.0
 *      and REQUIRES its attribution notice be retained, so an unattributed
 *      icon is a licence problem, not just untidiness.
 *   3. A regression to the surveillance tag values that were wrong before —
 *      surveillance:type is a fixed enum, camera geometry belongs in
 *      camera:type, and camera:direction is degrees, not "360".
 *
 * It deliberately does NOT import src/js/icons.js: that module uses
 * import.meta.glob, which only exists inside Vite.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PRESETS, MODES, allPresets, findPresetByTags, FALLBACK_ICON } from '../src/js/presets.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS_DIR = join(ROOT, 'src', 'icons');

let failures = 0;
function check(label, cond, detail = '') {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const manifest = JSON.parse(await readFile(join(ICONS_DIR, 'icon-sources.json'), 'utf8'));
const declared = new Set(manifest.icons);

// Everything actually on disk, as `set:id`.
const onDisk = new Set();
for (const entry of await readdir(ICONS_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  for (const file of await readdir(join(ICONS_DIR, entry.name))) {
    if (file.endsWith('.svg')) onDisk.add(`${entry.name}:${file.slice(0, -4)}`);
  }
}

const presets = allPresets();

// ── Preset integrity ───────────────────────────────────────────────────────
console.log('\nPresets');
{
  const missingRef = presets.filter((p) => !p.iconRef);
  check(
    'every preset has an iconRef',
    missingRef.length === 0,
    missingRef.map((p) => p.id).join(', ')
  );

  const leftoverEmoji = presets.filter((p) => 'icon' in p);
  check(
    'no preset still carries an emoji `icon` field',
    leftoverEmoji.length === 0,
    leftoverEmoji.map((p) => p.id).join(', ')
  );

  const ids = presets.map((p) => p.id);
  check('preset ids are unique', new Set(ids).size === ids.length);

  const modeIds = MODES.map((m) => m.id);
  const orphanModes = Object.keys(PRESETS).filter((k) => !modeIds.includes(k));
  check('every PRESETS key has a MODES entry', orphanModes.length === 0, orphanModes.join(', '));

  check('all 66 presets are present', presets.length === 66, String(presets.length));
}

// ── Icon resolution ────────────────────────────────────────────────────────
console.log('\nIcon refs resolve');
{
  const refs = [...new Set([...presets.map((p) => p.iconRef), FALLBACK_ICON])];

  const undeclared = refs.filter((r) => !declared.has(r));
  check(
    'every iconRef is declared in icon-sources.json',
    undeclared.length === 0,
    undeclared.join(', ')
  );

  const absent = refs.filter((r) => !onDisk.has(r));
  check('every iconRef has a file on disk', absent.length === 0, absent.join(', '));

  check('the fallback icon exists', onDisk.has(FALLBACK_ICON), FALLBACK_ICON);

  const badSet = refs.filter((r) => !manifest.sets[r.split(':')[0]]);
  check('every iconRef names a declared set', badSet.length === 0, badSet.join(', '));
}

// ── Provenance ─────────────────────────────────────────────────────────────
console.log('\nProvenance and licensing');
{
  const missingFiles = [...declared].filter((r) => !onDisk.has(r));
  check(
    'every manifest entry has a file (run: node tools/fetch-icons.mjs)',
    missingFiles.length === 0,
    missingFiles.join(', ')
  );

  // An icon on disk with no manifest entry has no recorded licence. For the
  // Apache-2.0 set that is an actual licence violation, not just clutter.
  const unattributed = [...onDisk].filter((r) => !declared.has(r));
  check('no icon on disk is unattributed', unattributed.length === 0, unattributed.join(', '));

  const setsMissingLicence = Object.entries(manifest.sets)
    .filter(([, s]) => !s.license || !s.name)
    .map(([k]) => k);
  check(
    'every declared set has a name and a licence',
    setsMissingLicence.length === 0,
    setsMissingLicence.join(', ')
  );
}

// ── SVG normalisation ──────────────────────────────────────────────────────
console.log('\nSVG normalisation');
{
  const wrongViewBox = [];
  const notRecolourable = [];

  for (const ref of [...onDisk].sort()) {
    const [set, id] = ref.split(':');
    const svg = await readFile(join(ICONS_DIR, set, `${id}.svg`), 'utf8');

    if (!/viewBox\s*=\s*"0 0 24 24"/.test(svg)) wrongViewBox.push(ref);

    // A hardcoded colour would survive the CSS `color:` that plates the icon,
    // and show up as a stray coloured glyph on the off-white tile.
    const hardcoded = svg.match(/(?:fill|stroke)\s*=\s*"(?!currentColor|none|")([^"]+)"/);
    if (hardcoded) notRecolourable.push(`${ref} (${hardcoded[1]})`);
  }

  check('every icon is on a 24x24 viewBox', wrongViewBox.length === 0, wrongViewBox.join(', '));
  check('no icon hardcodes a colour', notRecolourable.length === 0, notRecolourable.join(', '));
}

// ── OSM tag correctness ────────────────────────────────────────────────────
console.log('\nOSM tag correctness');
{
  // Verified against openstreetmap/id-tagging-schema, which is what iD
  // validates against.
  const SURVEILLANCE_TYPES = new Set(['camera', 'guard', 'gunshot_detector', 'ALPR']);
  const CAMERA_TYPES = new Set(['fixed', 'panning', 'dome']);

  const badSurvType = presets.filter(
    (p) => p.tags['surveillance:type'] && !SURVEILLANCE_TYPES.has(p.tags['surveillance:type'])
  );
  check(
    'surveillance:type only uses schema values',
    badSurvType.length === 0,
    badSurvType.map((p) => `${p.id}=${p.tags['surveillance:type']}`).join(', ')
  );

  const badCamType = presets.filter(
    (p) => p.tags['camera:type'] && !CAMERA_TYPES.has(p.tags['camera:type'])
  );
  check(
    'camera:type only uses schema values',
    badCamType.length === 0,
    badCamType.map((p) => `${p.id}=${p.tags['camera:type']}`).join(', ')
  );

  // camera:direction is a number field in degrees. 360 is the same bearing as
  // 0 and is not a valid value; an omnidirectional unit omits the key.
  const badDirection = presets.filter((p) => {
    const d = p.tags['camera:direction'] ?? p.tags['direction'];
    return d !== undefined && !(Number.isInteger(Number(d)) && Number(d) >= 0 && Number(d) <= 359);
  });
  check(
    'no preset writes an out-of-range direction',
    badDirection.length === 0,
    badDirection.map((p) => p.id).join(', ')
  );

  check(
    'pow_solar writes power=generator, not the old generator=source',
    presets.find((p) => p.id === 'pow_solar').tags.power === 'generator'
  );
  check(
    'bike_ramp writes ramp:bicycle=yes, not the old ramp=bicycle',
    presets.find((p) => p.id === 'bike_ramp').tags['ramp:bicycle'] === 'yes'
  );

  const emptyTags = presets.filter((p) => Object.keys(p.tags ?? {}).length === 0);
  check(
    'every preset writes at least one tag',
    emptyTags.length === 0,
    emptyTags.map((p) => p.id).join(', ')
  );
}

// ── Tag matching for nodes saved before node.presetId ──────────────────────
console.log('\nLegacy node matching');
{
  // The old first-match scan returned urban_camera for every camera, because
  // its two tags are a subset of every camera preset's. Specificity must win.
  const dome = findPresetByTags({
    man_made: 'surveillance',
    surveillance: 'outdoor',
    'surveillance:type': 'camera',
    'camera:type': 'dome',
    source: 'flaneur_survey',
  });
  check(
    'a dome camera resolves to surv_dome, not urban_camera',
    dome?.id === 'surv_dome',
    dome?.id
  );

  // Nodes written before the tagging fix must still find their preset.
  const legacyAudio = findPresetByTags({
    man_made: 'surveillance',
    surveillance: 'outdoor',
    'surveillance:type': 'audio',
    source: 'flaneur_survey',
  });
  check(
    'a pre-fix acoustic node still resolves to survd_audio',
    legacyAudio?.id === 'survd_audio',
    legacyAudio?.id
  );

  const legacySolar = findPresetByTags({
    generator: 'source',
    'generator:source': 'solar',
    'generator:method': 'photovoltaic',
    source: 'flaneur_survey',
  });
  check(
    'a pre-fix solar node still resolves to pow_solar',
    legacySolar?.id === 'pow_solar',
    legacySolar?.id
  );

  // A legacy set that is a strict SUBSET of the current tags is the normal
  // "we added a tag" case (surv_indoor gained surveillance:type=camera), and
  // is still needed — an old node lacks the added tag and would not match the
  // current set. A legacy set IDENTICAL to the current one is dead weight and
  // means a correction was reverted or never applied.
  const sameKeys = (a, b) => {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
  };
  const redundant = presets.filter((p) =>
    (p.legacyTags ?? []).some((set) => sameKeys(set, p.tags))
  );
  check(
    'no legacyTags entry duplicates the preset current tags',
    redundant.length === 0,
    redundant.map((p) => p.id).join(', ')
  );

  check(
    'an unmatched node returns null so the fallback icon is used',
    findPresetByTags({ foo: 'bar' }) === null
  );
}

console.log(failures ? `\n${failures} FAILURE(S)\n` : '\nAll icon checks passed.\n');
process.exit(failures ? 1 : 0);
