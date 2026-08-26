/**
 * Flaneur OSM Recorder — Storage regression tests
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Run with: npm test
 *
 * No test framework and no dependencies — plain Node with a localStorage
 * mock. These lock down the two field-reported data-loss bugs:
 *
 *   1. Node IDs repeated after a page reload, which suppressed map markers,
 *      misdirected edit/delete, and produced OSM XML with duplicate IDs.
 *   2. An empty "New Session" masked the user's real saved data, which looked
 *      like localStorage had stopped working.
 */

class MockStorage {
  constructor({ quota = Infinity, blocked = false } = {}) {
    this.map = new Map();
    this.quota = quota;
    this.blocked = blocked;
  }
  get length() {
    return this.map.size;
  }
  key(i) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k) {
    if (this.blocked) throw new Error('SecurityError');
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(k, v) {
    if (this.blocked) throw new Error('SecurityError');
    const size = [...this.map.entries()].reduce((n, [a, b]) => n + a.length + b.length, 0);
    if (size + String(v).length > this.quota) {
      const e = new Error('quota');
      e.name = 'QuotaExceededError';
      throw e;
    }
    this.map.set(k, String(v));
  }
  removeItem(k) {
    this.map.delete(k);
  }
}

global.localStorage = new MockStorage();
global.navigator = {};

const S = await import('../src/js/storage.js');

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) {
    console.log(`  ✅ ${name}`);
  } else {
    console.log(`  ❌ ${name} ${extra}`);
    failures++;
  }
}

const node = (s, tag) => S.addNode(s, { lat: 1, lon: 2, accuracy: 5, tags: { x: tag }, note: '' });

/**
 * Run `fn` with console.error/warn muted.
 *
 * Several tests deliberately drive storage.js down its failure paths, and it
 * logs those to stderr by design. Node buffers stdout and stderr separately,
 * so in CI those lines interleave into unrelated sections — the GitHub Actions
 * log showed a QuotaExceededError stack printed under "BUG 1", which reads as
 * a failing test when nothing is wrong. Expected noise is suppressed; the
 * assertions still verify the error was reported through onWriteError().
 */
function withQuietErrors(fn) {
  const { error, warn } = console;
  console.error = () => {};
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.error = error;
    console.warn = warn;
  }
}

// ── BUG 1: duplicate negative IDs after a reload ───────────────────────────
console.log('\nBUG 1 — node IDs must stay unique across a page reload');
{
  const s = S.createSession();
  node(s, 'a');
  node(s, 'b');
  check('fresh session issues -1, -2', s.nodes.map((n) => n.id).join() === '-1,-2', s.nodes.map((n) => n.id).join());

  // Simulate a reload: reload the session from storage, module state is gone.
  const reloaded = S.loadSession(s.id);
  node(reloaded, 'c');
  node(reloaded, 'd');

  const ids = reloaded.nodes.map((n) => n.id);
  check('after reload, appended nodes get -3, -4', ids.join() === '-1,-2,-3,-4', ids.join());
  check('all IDs unique', new Set(ids).size === ids.length, ids.join());
  check('all IDs negative', ids.every((i) => i < 0), ids.join());
}

// ── BUG 2: "localStorage is not working" ───────────────────────────────────
console.log('\nBUG 2 — an empty new session must not hide real data');
{
  localStorage = global.localStorage = new MockStorage();

  const real = S.createSession();
  node(real, 'survey1');
  node(real, 'survey2');
  node(real, 'survey3');
  const realId = real.id;

  // User relaunches the app and taps "New Session" without recording anything.
  const empty = S.createSession();
  check('the empty session is now the newest index entry', S.getSessionsIndex().at(-1).id === empty.id);

  // Relaunch again: what does the app offer to append to?
  const offered = S.getLastSession();
  check('getLastSession() returns the session WITH data', offered?.id === realId, `got ${offered?.id}`);
  check('and it still holds all 3 nodes', offered?.nodes.length === 3, `got ${offered?.nodes.length}`);

  // Pruning clears the abandoned empties.
  S.setActiveSessionId(realId);
  const pruned = S.pruneEmptySessions();
  check('pruneEmptySessions() removed the abandoned empty session', pruned === 1, `pruned ${pruned}`);
  check('the real session survived pruning', S.loadSession(realId)?.nodes.length === 3);
}

// ── Resume without prompting ───────────────────────────────────────────────
console.log('\nResume — the active session comes back on launch');
{
  localStorage = global.localStorage = new MockStorage();
  const s = S.createSession();
  node(s, 'a');
  const resumed = S.resumeActiveSession();
  check('resumeActiveSession() returns the active session', resumed?.id === s.id);
  check('with its node intact', resumed?.nodes.length === 1);

  const s2 = S.createSession(); // empty, becomes active
  check('an empty active session is NOT auto-resumed', S.resumeActiveSession() === null, String(s2.id));
}

// ── Quota exhaustion must not silently lose a node ─────────────────────────
console.log('\nQuota — a rejected write must be reported, not swallowed');
{
  localStorage = global.localStorage = new MockStorage();
  const s = S.createSession();
  node(s, 'ok');

  let reported = null;
  S.onWriteError((d) => (reported = d));
  global.localStorage.quota = 10; // no room for anything more

  const failed = withQuietErrors(() =>
    S.addNode(s, { lat: 1, lon: 2, accuracy: 1, tags: { x: 'nope' }, note: '' })
  );
  check('addNode() returns null when the write fails', failed === null, String(failed));
  check('the write error was reported', reported?.reason === 'quota', JSON.stringify(reported?.reason));
  check('the in-memory session was rolled back (no phantom node)', s.nodes.length === 1, String(s.nodes.length));
}

// ── Blocked storage (private mode) ─────────────────────────────────────────
console.log('\nBlocked storage — detection must not throw');
{
  localStorage = global.localStorage = new MockStorage({ blocked: true });
  check('isStorageAvailable() reports false instead of throwing', S.isStorageAvailable() === false);
  check(
    'getSessionsIndex() degrades to []',
    Array.isArray(withQuietErrors(() => S.getSessionsIndex()))
  );
  check(
    'estimateStorageUsedKb() degrades to 0',
    withQuietErrors(() => S.estimateStorageUsedKb()) === 0
  );
}

console.log(failures ? `\n${failures} FAILURE(S)\n` : '\nAll storage checks passed.\n');
process.exit(failures ? 1 : 0);
