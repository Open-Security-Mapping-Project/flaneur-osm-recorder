/**
 * Flaneur OSM Recorder — Export regression tests
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Run with: npm test
 *
 * No test framework and no dependencies — export.js is pure string building
 * (the one DOM touch, downloadText, is inside a function body and never runs
 * here), so it imports into plain Node as-is.
 *
 * What these lock down: node ids are negative and derived *per session*, so
 * every session starts again at -1. Concatenating sessions for a combined
 * export therefore produces duplicate ids unless they are reissued — and a
 * JOSM layer with duplicate ids is exactly the failure REQUIREMENTS.md R3.5
 * exists to prevent, arriving by a different route than the module-counter bug.
 */

import { mergeSessions, toOsmXml, toGeoJson, toGpx } from '../src/js/export.js';

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) {
    console.log(`  ✅ ${name}`);
  } else {
    console.log(`  ❌ ${name} ${extra}`);
    failures++;
  }
}

/** A session whose ids start at -1, the way storage.js issues them. */
function session(id, createdAt, tagValues) {
  return {
    id,
    name: `Survey ${id}`,
    createdAt,
    updatedAt: createdAt,
    nodes: tagValues.map((value, i) => ({
      id: -(i + 1),
      lat: 40.7 + i / 1000,
      lon: -74 - i / 1000,
      accuracy_m: 5,
      timestamp: createdAt,
      tags: { man_made: 'surveillance', 'surveillance:type': value },
      note: '',
      photos: [],
      presetId: 'surv_fixed',
    })),
  };
}

const a = session('aaa', '2026-08-01T10:00:00.000Z', ['camera', 'camera']);
const b = session('bbb', '2026-08-20T10:00:00.000Z', ['camera', 'camera', 'guard']);
const empty = { id: 'ccc', name: 'Empty', createdAt: '2026-08-25T10:00:00.000Z', nodes: [] };

// ── Merging must reissue ids ───────────────────────────────────────────────
console.log('\nCombined export — ids must be unique across sessions');
{
  const merged = mergeSessions([a, b, empty]);
  const ids = merged.nodes.map((n) => n.id);

  check(
    'every node from every session is present',
    merged.nodes.length === 5,
    String(merged.nodes.length)
  );
  check('ids are renumbered into one sequence', ids.join() === '-1,-2,-3,-4,-5', ids.join());
  check('all ids unique', new Set(ids).size === ids.length, ids.join());
  check(
    'all ids negative',
    ids.every((id) => id < 0),
    ids.join()
  );
  check(
    'empty sessions are dropped',
    merged.sourceSessions.length === 2,
    JSON.stringify(merged.sourceSessions)
  );
  check(
    'each node remembers the session it came from',
    merged.nodes.filter((n) => n.sessionId === 'aaa').length === 2 &&
      merged.nodes.filter((n) => n.sessionId === 'bbb').length === 3,
    merged.nodes.map((n) => n.sessionId).join()
  );
  check(
    'the file is dated from the earliest session it contains',
    merged.createdAt === a.createdAt,
    merged.createdAt
  );
}

// ── The originals must not be touched ──────────────────────────────────────
console.log('\nCombined export — stored sessions are left alone');
{
  mergeSessions([a, b]);
  check(
    'session A keeps its own ids',
    a.nodes.map((n) => n.id).join() === '-1,-2',
    a.nodes.map((n) => n.id).join()
  );
  check(
    'session B keeps its own ids',
    b.nodes.map((n) => n.id).join() === '-1,-2,-3',
    b.nodes.map((n) => n.id).join()
  );
  check(
    'no sessionId leaked onto a stored node',
    a.nodes.every((n) => n.sessionId === undefined)
  );
}

// ── Serialized output ──────────────────────────────────────────────────────
console.log('\nCombined export — serialized output');
{
  const merged = mergeSessions([a, b]);
  const xml = toOsmXml(merged);
  const idAttrs = [...xml.matchAll(/<node id="(-\d+)"/g)].map((m) => m[1]);

  check('OSM XML emits one node per merged node', idAttrs.length === 5, String(idAttrs.length));
  check('OSM XML ids are unique', new Set(idAttrs).size === idAttrs.length, idAttrs.join());
  check('OSM XML records the source sessions in comments', xml.includes('Source session: aaa'));
  check(
    'every node still carries action="create"',
    (xml.match(/action="create"/g) || []).length === 5
  );

  const geo = JSON.parse(toGeoJson(merged));
  check(
    'GeoJSON carries one feature per node',
    geo.features.length === 5,
    String(geo.features.length)
  );
  check(
    'GeoJSON labels each feature with its session',
    geo.features.every((f) => f.properties.flaneur_session),
    JSON.stringify(geo.features[0].properties)
  );
  check('GeoJSON lists the source sessions', geo.source_sessions?.length === 2);

  const gpx = toGpx(merged);
  check('GPX emits one waypoint per node', (gpx.match(/<wpt /g) || []).length === 5);
}

// ── A single session is unchanged by all of this ───────────────────────────
console.log('\nSingle-session export — unchanged');
{
  const geo = JSON.parse(toGeoJson(a));
  check(
    'no session label on a single-session export',
    geo.features.every((f) => f.properties.flaneur_session === undefined)
  );
  check('no source_sessions key on a single-session export', geo.source_sessions === undefined);
  check('OSM XML has no source-session comments', !toOsmXml(a).includes('Source session:'));
}

console.log(failures ? `\n${failures} FAILURE(S)\n` : '\nAll export checks passed.\n');
process.exit(failures ? 1 : 0);
