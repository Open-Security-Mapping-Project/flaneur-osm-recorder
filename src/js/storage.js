/**
 * Flaneur OSM Recorder — Storage Module
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Manages sessions and nodes in localStorage.
 * Schema version is embedded to allow future migrations.
 *
 * Durability contract (see REQUIREMENTS.md § Storage):
 *   - Every write goes through safeWrite() and reports failure rather than
 *     throwing into a UI event handler.
 *   - Node IDs are derived from the session itself, never from a module
 *     counter, so they survive a page reload.
 *   - requestPersistentStorage() asks the browser to exempt our origin from
 *     eviction under storage pressure.
 */

const SCHEMA_VERSION = 1;
const KEY_SESSIONS_INDEX = 'flaneur_sessions';
const KEY_SESSION_PREFIX = 'flaneur_session_';
const KEY_ACTIVE_SESSION = 'flaneur_active_session';
const KEY_PREFS = 'flaneur_prefs';
const KEY_HEALTHCHECK = 'flaneur_healthcheck';

/**
 * Listeners notified when a write fails. main.js registers one so the user
 * sees a toast instead of losing a node silently.
 * @type {((detail: {reason: string, error: Error}) => void)[]}
 */
const writeErrorListeners = [];

export function onWriteError(fn) {
  writeErrorListeners.push(fn);
}

function reportWriteError(reason, error) {
  console.error(`💾 Storage write failed (${reason}):`, error);
  for (const fn of writeErrorListeners) {
    try {
      fn({ reason, error });
    } catch (listenerError) {
      console.error('💾 Write-error listener threw:', listenerError);
    }
  }
}

/**
 * Every localStorage.setItem in this module goes through here.
 * Returns true on success, false on failure (quota exceeded, private mode,
 * storage disabled). Never throws.
 */
function safeWrite(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    const quotaExceeded =
      error &&
      (error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        error.code === 22);
    reportWriteError(quotaExceeded ? 'quota' : 'unavailable', error);
    return false;
  }
}

function safeRead(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    reportWriteError('unavailable', error);
    return null;
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function dateTag() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Storage availability ──────────────────────────────────────────────────

/**
 * Round-trips a value through localStorage to prove it actually persists.
 * Safari private mode historically exposed the API but threw on write, and
 * some privacy browsers silently discard values, so a read-back is required.
 * Returns true if survey data can be saved on this device.
 */
export function isStorageAvailable() {
  try {
    const probe = String(Date.now());
    localStorage.setItem(KEY_HEALTHCHECK, probe);
    const readBack = localStorage.getItem(KEY_HEALTHCHECK);
    localStorage.removeItem(KEY_HEALTHCHECK);
    return readBack === probe;
  } catch {
    return false;
  }
}

/**
 * Ask the browser to mark this origin's storage as persistent, so survey data
 * is not evicted when the device is low on space. Chrome/Android grants this
 * silently for installed PWAs and engaged sites; Safari ignores it.
 * Returns the resulting persisted state.
 */
export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch (error) {
    console.warn('💾 Persistent storage request failed:', error);
    return false;
  }
}

/**
 * Current storage health, for the settings panel.
 * Returns { available, persisted, usedKb, quotaKb, sessionCount, nodeCount }.
 * quotaKb is null when the Storage API is unavailable.
 */
export async function getStorageHealth() {
  const index = getSessionsIndex();
  const health = {
    available: isStorageAvailable(),
    persisted: false,
    usedKb: estimateStorageUsedKb(),
    quotaKb: null,
    sessionCount: index.length,
    nodeCount: index.reduce((sum, entry) => sum + (entry.nodeCount || 0), 0),
  };

  if (navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      if (estimate.quota) health.quotaKb = Math.round(estimate.quota / 1024);
    } catch (error) {
      console.warn('💾 Storage estimate failed:', error);
    }
  }

  if (navigator.storage?.persisted) {
    try {
      health.persisted = await navigator.storage.persisted();
    } catch (error) {
      console.warn('💾 Persisted check failed:', error);
    }
  }

  return health;
}

// ─── Sessions Index ────────────────────────────────────────────────────────

export function getSessionsIndex() {
  try {
    return JSON.parse(safeRead(KEY_SESSIONS_INDEX)) || [];
  } catch {
    return [];
  }
}

function saveSessionsIndex(index) {
  return safeWrite(KEY_SESSIONS_INDEX, JSON.stringify(index));
}

/**
 * The session a returning user most likely wants to continue: the one with
 * nodes in it that was updated most recently.
 *
 * Deliberately NOT "the last entry in the index" — that is the most recently
 * *created* session, which is empty if the user just tapped "New Session" and
 * then reloaded, making their real data look lost.
 */
export function getLastSession() {
  const index = getSessionsIndex();
  if (!index.length) return null;

  const withNodes = index.filter((entry) => (entry.nodeCount || 0) > 0);
  const candidates = withNodes.length ? withNodes : index;

  const newest = candidates.reduce((best, entry) => {
    const entryTime = Date.parse(entry.updatedAt || entry.createdAt) || 0;
    const bestTime = Date.parse(best.updatedAt || best.createdAt) || 0;
    return entryTime > bestTime ? entry : best;
  });

  return loadSession(newest.id);
}

/**
 * All sessions, newest activity first, for the session list UI.
 */
export function listSessions() {
  return getSessionsIndex()
    .slice()
    .sort(
      (a, b) =>
        (Date.parse(b.updatedAt || b.createdAt) || 0) -
        (Date.parse(a.updatedAt || a.createdAt) || 0)
    );
}

// ─── Session CRUD ──────────────────────────────────────────────────────────

export function createSession() {
  const id = generateId();
  const now = new Date().toISOString();
  const session = {
    schemaVersion: SCHEMA_VERSION,
    id,
    name: `Survey ${dateTag()}`,
    createdAt: now,
    updatedAt: now,
    nodes: [],
  };
  safeWrite(KEY_SESSION_PREFIX + id, JSON.stringify(session));

  const index = getSessionsIndex();
  index.push({ id, name: session.name, createdAt: now, updatedAt: now, nodeCount: 0 });
  saveSessionsIndex(index);

  setActiveSessionId(id);
  return session;
}

export function loadSession(id) {
  try {
    const raw = safeRead(KEY_SESSION_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Persist a session. Returns true if the write landed.
 */
export function saveSession(session) {
  session.updatedAt = new Date().toISOString();
  const ok = safeWrite(KEY_SESSION_PREFIX + session.id, JSON.stringify(session));
  if (!ok) return false;

  const index = getSessionsIndex();
  const entry = index.find((e) => e.id === session.id);
  if (entry) {
    entry.nodeCount = session.nodes.length;
    entry.updatedAt = session.updatedAt;
  } else {
    // Index lost or never written — rebuild this entry so the session is
    // reachable again on next launch.
    index.push({
      id: session.id,
      name: session.name,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      nodeCount: session.nodes.length,
    });
  }
  saveSessionsIndex(index);
  return true;
}

export function deleteSession(id) {
  try {
    localStorage.removeItem(KEY_SESSION_PREFIX + id);
  } catch (error) {
    reportWriteError('unavailable', error);
    return false;
  }
  saveSessionsIndex(getSessionsIndex().filter((entry) => entry.id !== id));
  if (getActiveSessionId() === id) {
    try {
      localStorage.removeItem(KEY_ACTIVE_SESSION);
    } catch {
      /* already reported above */
    }
  }
  return true;
}

/**
 * Drop empty sessions other than the active one. Tapping "New Session" on
 * every launch would otherwise pile up abandoned empty records in the index.
 */
export function pruneEmptySessions() {
  const activeId = getActiveSessionId();
  const stale = getSessionsIndex().filter(
    (entry) => (entry.nodeCount || 0) === 0 && entry.id !== activeId
  );
  for (const entry of stale) {
    deleteSession(entry.id);
  }
  return stale.length;
}

export function deleteAllSessions() {
  const index = getSessionsIndex();
  try {
    for (const entry of index) {
      localStorage.removeItem(KEY_SESSION_PREFIX + entry.id);
    }
    localStorage.removeItem(KEY_SESSIONS_INDEX);
    localStorage.removeItem(KEY_ACTIVE_SESSION);
  } catch (error) {
    reportWriteError('unavailable', error);
  }
}

export function getActiveSessionId() {
  return safeRead(KEY_ACTIVE_SESSION);
}

export function setActiveSessionId(id) {
  safeWrite(KEY_ACTIVE_SESSION, id);
}

/**
 * The session to reopen on launch without asking: the active session, if it
 * still exists and holds nodes.
 */
export function resumeActiveSession() {
  const id = getActiveSessionId();
  if (!id) return null;
  const session = loadSession(id);
  if (!session || !session.nodes?.length) return null;
  return session;
}

// ─── Node Operations ───────────────────────────────────────────────────────

/**
 * Next negative node ID for this session.
 *
 * Derived from the session's own nodes rather than a module-level counter:
 * a counter resets to -1 on every page load, so appending to a saved session
 * would re-issue IDs that already exist in it. Duplicate IDs silently
 * suppressed the new map marker, made edit/delete act on the wrong node, and
 * produced OSM XML that JOSM rejects.
 */
export function nextNodeId(session) {
  let lowest = 0;
  for (const node of session.nodes) {
    if (typeof node.id === 'number' && node.id < lowest) lowest = node.id;
  }
  return lowest - 1;
}

/**
 * Add a node to the given session.
 * Returns the new node, or null if it could not be persisted.
 */
export function addNode(session, { lat, lon, accuracy, tags, note, photos }) {
  const node = {
    id: nextNodeId(session), // negative IDs: JOSM convention for new nodes
    lat,
    lon,
    accuracy_m: accuracy,
    timestamp: new Date().toISOString(),
    tags: { ...tags, source: 'flaneur_survey' },
    note: note || '',
    photos: photos || [], // array of base64 data URIs or blob URLs
  };
  session.nodes.push(node);

  if (!saveSession(session)) {
    // Roll back the in-memory push so the UI never shows a node that is not
    // on disk. The write-error listener has already surfaced the reason.
    session.nodes.pop();
    return null;
  }
  return node;
}

export function removeLastNode(session) {
  if (!session.nodes.length) return null;
  const removed = session.nodes.pop();
  if (!saveSession(session)) {
    session.nodes.push(removed);
    return null;
  }
  return removed;
}

/**
 * Delete a node by its id. Returns true if found and removed.
 */
export function deleteNodeById(session, nodeId) {
  const idx = session.nodes.findIndex((n) => n.id === nodeId);
  if (idx === -1) return false;
  const [removed] = session.nodes.splice(idx, 1);
  if (!saveSession(session)) {
    session.nodes.splice(idx, 0, removed);
    return false;
  }
  return true;
}

/**
 * Update the note field on a node by id.
 * Returns the updated node, or null if not found or not saved.
 */
export function updateNodeNote(session, nodeId, note) {
  const node = session.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const previous = node.note;
  node.note = note;
  if (!saveSession(session)) {
    node.note = previous;
    return null;
  }
  return node;
}

// ─── Preferences ──────────────────────────────────────────────────────────

export function getPrefs() {
  try {
    return JSON.parse(safeRead(KEY_PREFS)) || {};
  } catch {
    return {};
  }
}

export function setPref(key, value) {
  const prefs = getPrefs();
  prefs[key] = value;
  safeWrite(KEY_PREFS, JSON.stringify(prefs));
}

export function getPref(key, defaultValue = null) {
  return getPrefs()[key] ?? defaultValue;
}

// ─── Storage health ────────────────────────────────────────────────────────

export function estimateStorageUsedKb() {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('flaneur_')) {
        total += (localStorage.getItem(k) || '').length;
      }
    }
  } catch {
    return 0;
  }
  return Math.round(total / 1024);
}
