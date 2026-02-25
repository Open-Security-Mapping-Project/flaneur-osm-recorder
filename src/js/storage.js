/**
 * Flaneur OSM Recorder — Storage Module
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Manages sessions and nodes in localStorage.
 * Schema version is embedded to allow future migrations.
 */

const SCHEMA_VERSION = 1;
const KEY_SESSIONS_INDEX = 'flaneur_sessions';
const KEY_SESSION_PREFIX = 'flaneur_session_';
const KEY_ACTIVE_SESSION = 'flaneur_active_session';
const KEY_PREFS = 'flaneur_prefs';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function dateTag() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Sessions Index ────────────────────────────────────────────────────────

export function getSessionsIndex() {
  try {
    return JSON.parse(localStorage.getItem(KEY_SESSIONS_INDEX)) || [];
  } catch {
    return [];
  }
}

function saveSessionsIndex(index) {
  localStorage.setItem(KEY_SESSIONS_INDEX, JSON.stringify(index));
}

export function getLastSession() {
  const index = getSessionsIndex();
  if (!index.length) return null;
  return loadSession(index[index.length - 1].id);
}

// ─── Session CRUD ──────────────────────────────────────────────────────────

export function createSession() {
  const id = generateId();
  const session = {
    schemaVersion: SCHEMA_VERSION,
    id,
    name: `Survey ${dateTag()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: [],
  };
  const key = KEY_SESSION_PREFIX + id;
  localStorage.setItem(key, JSON.stringify(session));

  const index = getSessionsIndex();
  index.push({ id, name: session.name, createdAt: session.createdAt, nodeCount: 0 });
  saveSessionsIndex(index);

  setActiveSessionId(id);
  return session;
}

export function loadSession(id) {
  try {
    const raw = localStorage.getItem(KEY_SESSION_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  session.updatedAt = new Date().toISOString();
  localStorage.setItem(KEY_SESSION_PREFIX + session.id, JSON.stringify(session));

  // Update index entry
  const index = getSessionsIndex();
  const entry = index.find((e) => e.id === session.id);
  if (entry) {
    entry.nodeCount = session.nodes.length;
    entry.updatedAt = session.updatedAt;
    saveSessionsIndex(index);
  }
}

export function deleteAllSessions() {
  const index = getSessionsIndex();
  for (const entry of index) {
    localStorage.removeItem(KEY_SESSION_PREFIX + entry.id);
  }
  localStorage.removeItem(KEY_SESSIONS_INDEX);
  localStorage.removeItem(KEY_ACTIVE_SESSION);
}

export function getActiveSessionId() {
  return localStorage.getItem(KEY_ACTIVE_SESSION);
}

export function setActiveSessionId(id) {
  localStorage.setItem(KEY_ACTIVE_SESSION, id);
}

// ─── Node Operations ───────────────────────────────────────────────────────

let _negIdCounter = -1;

/**
 * Add a node to the active session.
 * Returns the new node.
 */
export function addNode(session, { lat, lon, accuracy, tags, note, photos }) {
  const node = {
    id: _negIdCounter--,        // negative IDs: JOSM convention for new nodes
    lat,
    lon,
    accuracy_m: accuracy,
    timestamp: new Date().toISOString(),
    tags: { ...tags, source: 'flaneur_survey' },
    note: note || '',
    photos: photos || [],       // array of base64 data URIs or blob URLs
  };
  session.nodes.push(node);
  saveSession(session);
  return node;
}

export function removeLastNode(session) {
  if (!session.nodes.length) return null;
  const removed = session.nodes.pop();
  saveSession(session);
  return removed;
}

/**
 * Delete a node by its id. Returns true if found and removed.
 */
export function deleteNodeById(session, nodeId) {
  const idx = session.nodes.findIndex((n) => n.id === nodeId);
  if (idx === -1) return false;
  session.nodes.splice(idx, 1);
  saveSession(session);
  return true;
}

/**
 * Update the note field on a node by id.
 * Returns the updated node, or null if not found.
 */
export function updateNodeNote(session, nodeId, note) {
  const node = session.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  node.note = note;
  saveSession(session);
  return node;
}

// ─── Preferences ──────────────────────────────────────────────────────────

export function getPrefs() {
  try {
    return JSON.parse(localStorage.getItem(KEY_PREFS)) || {};
  } catch {
    return {};
  }
}

export function setPref(key, value) {
  const prefs = getPrefs();
  prefs[key] = value;
  localStorage.setItem(KEY_PREFS, JSON.stringify(prefs));
}

export function getPref(key, defaultValue = null) {
  return getPrefs()[key] ?? defaultValue;
}

// ─── Storage health ────────────────────────────────────────────────────────

export function estimateStorageUsedKb() {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith('flaneur_')) {
      total += (localStorage.getItem(k) || '').length;
    }
  }
  return Math.round(total / 1024);
}
