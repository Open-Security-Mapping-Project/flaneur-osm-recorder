/**
 * Flaneur OSM Recorder — Main Application
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Entry point. Owns the DOM, the map, GPS, and app-level actions.
 *
 * Event listener registration for static DOM elements lives in handlers.js.
 * This module exports the actions that handlers.js binds to.
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../css/index.css';
import '../css/direction-widget.css';

import { t, setLocale, getLocale, AVAILABLE_LOCALES } from './i18n.js';
import { MODES, PRESETS, findPresetById, findPresetByTags, FALLBACK_ICON } from './presets.js';
import { iconMarkup, iconSpriteMarkup } from './icons.js';
import {
  createSession,
  getLastSession,
  resumeActiveSession,
  pruneEmptySessions,
  addNode,
  removeLastNode,
  deleteNodeById,
  updateNodeNote,
  getPref,
  setPref,
  deleteAllSessions,
  isStorageAvailable,
  requestPersistentStorage,
  getStorageHealth,
  onWriteError,
  loadAllSessions,
} from './storage.js';
import { exportSession, mergeSessions } from './export.js';
import { GpsManager } from './gps.js';
import { showToast, closeModal, openModal, escHtml } from './ui-utils.js';
import { DirectionWidget, degreesToCardinal } from './direction-widget.js';
import {
  setSoundEnabled,
  isSoundEnabled,
  playRecordClick,
  playDragTick,
  playToggleBlip,
  unlockAudio,
} from './sound.js';
import { registerHandlers } from './handlers.js';

// ─── State ─────────────────────────────────────────────────────────────────

let map, gpsMarker, accuracyCircle;
let mapLocked = true;
let currentSession = null;
let activeMode = 'urban';
let holdTimer = null;
let pendingPreset = null;
let pendingPhotos = [];
let placementMode = 'gps'; // 'gps' or 'crosshair'
let tutorialSlide = 0;
let editingNodeId = null;
let deletingNodeId = null;
let deletingRow = null;
let pendingDirection = null; // degrees (0-359) or null
let directionWidget = null;
let storageWritable = true;
let noteModalOpen = false;
let gpsToggledByUser = false;
let exportScope = 'session'; // 'session' | 'all' — what the export modal acts on

const nodeMarkers = new Map(); // node id → Leaflet marker
const TUTORIAL_TOTAL = 6;

/**
 * Where the map sits before the first GPS fix: New York City Hall.
 *
 * The previous default was [0, 0] — Null Island, open ocean off West Africa,
 * which renders as an empty blue tile and looks like the map is broken. Any
 * real streetscape is a better "still locating" state.
 */
const DEFAULT_CENTER = [40.712772, -74.006058];
const DEFAULT_ZOOM = 16; // neighborhood context, not a rooftop
const SURVEY_ZOOM = 18; // what we snap to once an actual position arrives

const gps = new GpsManager({
  onPosition: handlePosition,
  onError: handleGpsError,
  onStatusChange: updateGpsButton,
});

// ─── Init ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);

function init() {
  setLocale(getPref('locale', 'en'));

  installIconSprite();
  initMap();
  initDirectionWidget();
  applyAllStrings();
  registerHandlers();
  initSound();

  onWriteError(handleStorageWriteError);
  checkStorageOnLaunch();

  openSessionModal();
  gps.start();
}

/**
 * Put the icon sprite in the document so `<use href="#ico-...">` resolves.
 *
 * Must run before anything renders an icon. It goes in first so the preset
 * grid, the map markers and the node list all draw on first paint rather than
 * flashing empty boxes.
 */
function installIconSprite() {
  if (document.getElementById('icon-sprite')) return;
  document.body.insertAdjacentHTML('afterbegin', iconSpriteMarkup());
}

/**
 * Verify survey data can actually be persisted, ask for eviction protection,
 * and prune abandoned empty sessions left by previous launches.
 */
async function checkStorageOnLaunch() {
  storageWritable = isStorageAvailable();

  if (!storageWritable) {
    showStorageBanner(t('storageUnavailable'));
    showToast(t('storageUnavailable'), 'error');
    return;
  }

  pruneEmptySessions();

  const persisted = await requestPersistentStorage();
  if (!persisted) {
    console.warn('💾 Persistent storage not granted — data may be evicted under storage pressure.');
  }
  refreshStorageInfo();
}

function handleStorageWriteError({ reason }) {
  storageWritable = false;
  const msg = reason === 'quota' ? t('storageFullError') : t('storageWriteError');
  showStorageBanner(msg);
  showToast(msg, 'error');
}

function showStorageBanner(msg) {
  const banner = document.getElementById('storage-banner');
  if (!banner) return;
  banner.textContent = msg;
  banner.removeAttribute('hidden');
  // The banner takes vertical space away from the map; re-measure immediately
  // rather than leaving a stale size for Leaflet to correct later.
  onMapResize();
}

function initMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl) {
    console.error('Map element #map not found in DOM');
    return;
  }

  map = L.map('map', {
    zoomControl: false,
    attributionControl: true,
  }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 21,
    maxNativeZoom: 19,
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);
  map.on('drag', onMapDrag);

  createCrosshair();

  // Leaflet measures the container on creation; the flex layout has not
  // settled yet at DOMContentLoaded.
  setTimeout(onMapResize, 100);
}

function onMapDrag() {
  if (mapLocked) {
    mapLocked = false;
    updateLockButton();
  }
}

function onMapResize() {
  map?.invalidateSize();
}

let resizeTimer = null;

/**
 * Keep Leaflet's cached container size current.
 *
 * A phone's URL bar collapsing on scroll, or a rotation, changes the map
 * container without any Leaflet-visible event. Re-measuring here keeps the
 * size fresh continuously instead of letting a stale measurement accumulate
 * and get applied — with a map-moving pan — at some later, arbitrary moment.
 */
export function handleViewportResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(onMapResize, 150);
}

// ─── Crosshair reticle ─────────────────────────────────────────────────────

function createCrosshair() {
  const crosshair = document.createElement('div');
  crosshair.id = 'map-crosshair';
  crosshair.setAttribute('hidden', '');
  crosshair.innerHTML = `
    <svg width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="8" fill="none" stroke="var(--accent2)" stroke-width="2" opacity="0.8"/>
      <line x1="20" y1="0" x2="20" y2="12" stroke="var(--accent2)" stroke-width="2" opacity="0.8"/>
      <line x1="20" y1="28" x2="20" y2="40" stroke="var(--accent2)" stroke-width="2" opacity="0.8"/>
      <line x1="0" y1="20" x2="12" y2="20" stroke="var(--accent2)" stroke-width="2" opacity="0.8"/>
      <line x1="28" y1="20" x2="40" y2="20" stroke="var(--accent2)" stroke-width="2" opacity="0.8"/>
      <circle cx="20" cy="20" r="2" fill="var(--accent2)"/>
    </svg>
  `;
  document.getElementById('map-wrap').appendChild(crosshair);
}

/**
 * The geographic point actually drawn under the crosshair reticle.
 *
 * Deliberately NOT `map.getCenter()` after an `invalidateSize()`. That was the
 * old approach and it caused the reported "the first crosshair node jogs away
 * from the reticle, later ones are fine" bug: `invalidateSize()` defaults to
 * `pan: true`, so when the container size has changed since Leaflet last
 * measured it — a phone URL bar collapsing, the storage banner appearing, the
 * session modal closing — it pans the map by the size delta before returning.
 * `getCenter()` then reported a point the user never aimed at. It only ever
 * happened once because the pan clears Leaflet's size-changed flag, leaving
 * every later call a no-op.
 *
 * Reading the reticle's real rendered box and converting through
 * `containerPointToLatLng()` is immune to stale sizing: it resolves against the
 * pixel origin the visible tiles are currently drawn with, so it returns what
 * the user is actually looking at, and it never moves the map.
 */
function crosshairLatLng() {
  const crosshair = document.getElementById('map-crosshair');
  const container = map.getContainer();

  if (!crosshair || crosshair.hasAttribute('hidden')) return map.getCenter();

  const mapBox = container.getBoundingClientRect();
  const reticleBox = crosshair.getBoundingClientRect();

  return map.containerPointToLatLng([
    reticleBox.left + reticleBox.width / 2 - mapBox.left,
    reticleBox.top + reticleBox.height / 2 - mapBox.top,
  ]);
}

// ─── Direction widget ──────────────────────────────────────────────────────

function initDirectionWidget() {
  directionWidget = new DirectionWidget({
    onConfirm: onDirectionConfirm,
    onCancel: onDirectionWidgetCancel,
    onEmptyConfirm: onDirectionNotChosen,
    onDrag: onDirectionDrag,
  });
}

/** Each detent of the wheel: click, and turn the button's arrow to match. */
function onDirectionDrag(deg) {
  playDragTick();
  setDirectionArrow(deg);
}

function onDirectionConfirm(deg) {
  pendingDirection = deg;
  updateDirectionBadge(deg);
  updateNoteDirectionField();
  restoreNoteModal();
  showToast(
    t('directionSet', { deg: Math.round(deg), cardinal: degreesToCardinal(deg) }),
    'success'
  );
}

/** Confirm tapped before any bearing was picked — say what it is waiting for. */
function onDirectionNotChosen() {
  showToast(t('directionPickFirst'), 'info');
}

/**
 * Cancel discards the bearing entirely — including one set earlier and shown
 * in the top bar badge. Leaving a stale direction behind after an explicit
 * cancel would silently tag the next node with it.
 */
function onDirectionWidgetCancel() {
  const hadDirection = pendingDirection !== null;
  clearDirection();
  restoreNoteModal();
  if (hadDirection) showToast(t('directionCleared'), 'info');
}

/**
 * The direction widget covers the note modal, which is hidden (not closed)
 * while it is open. Only restore it if a note is genuinely in progress.
 */
function restoreNoteModal() {
  if (noteModalOpen && pendingPreset) openModal('modal-note');
}

/**
 * Turn the arrow on the direction button to `deg`, or back to north when it is
 * null. Tying the button to the bearing it controls is what makes the two read
 * as the same thing, and it gives live feedback while the wheel is dragged.
 *
 * The rotation is written as an SVG transform attribute — the documented
 * exception in CLAUDE.md, because a per-element rotation by a runtime value
 * cannot be a static class. One attribute, nothing else.
 */
function setDirectionArrow(deg) {
  const arrow = document.getElementById('dir-btn-arrow');
  if (!arrow) return;
  arrow.setAttribute('transform', `rotate(${Math.round(deg ?? 0)}, 12, 12)`);
}

function updateDirectionBadge(deg) {
  setDirectionArrow(deg);
  const badge = document.getElementById('direction-badge');
  if (!badge) return;
  if (deg === null) {
    badge.setAttribute('hidden', '');
    badge.textContent = '';
  } else {
    badge.removeAttribute('hidden');
    badge.textContent = `⬆ ${Math.round(deg)}° ${degreesToCardinal(deg)}`;
  }
}

function updateNoteDirectionField() {
  const field = document.getElementById('note-direction-display');
  if (!field) return;
  const isSet = pendingDirection !== null;
  field.textContent = isSet
    ? `${Math.round(pendingDirection)}° ${degreesToCardinal(pendingDirection)}`
    : t('directionNotSet');
  field.classList.toggle('direction-row-value--set', isSet);
}

export function clearDirection() {
  pendingDirection = null;
  updateDirectionBadge(null);
  updateNoteDirectionField();
}

export function toggleDirectionWidget() {
  directionWidget.toggle(pendingDirection);
  // Dismissing the wheel without confirming abandons whatever was dragged, so
  // put the arrow back on the bearing that is actually pending.
  if (!directionWidget.isOpen()) setDirectionArrow(pendingDirection);
}

/** Open the direction widget from inside the note modal. */
export function openDirectionFromNote() {
  closeModal('modal-note'); // hidden, not canceled — restoreNoteModal brings it back
  directionWidget.open(pendingDirection);
}

// ─── GPS ───────────────────────────────────────────────────────────────────

function handlePosition(pos) {
  const { lat, lon, accuracy } = pos;
  const isFirstFix = !gpsMarker;

  if (!gpsMarker) {
    gpsMarker = L.circleMarker([lat, lon], {
      radius: 8,
      fillColor: '#00ffe5',
      color: '#003333',
      weight: 2,
      fillOpacity: 0.9,
    }).addTo(map);

    accuracyCircle = L.circle([lat, lon], {
      radius: accuracy,
      fillColor: '#00ffe5',
      fillOpacity: 0.08,
      color: '#00ffe5',
      weight: 1,
    }).addTo(map);
  } else {
    gpsMarker.setLatLng([lat, lon]);
    accuracyCircle.setLatLng([lat, lon]);
    accuracyCircle.setRadius(accuracy);
  }

  if (mapLocked) {
    // The first real fix leaves the wide fallback view for survey zoom.
    // After that, respect whatever zoom the user has chosen.
    map.setView([lat, lon], isFirstFix ? SURVEY_ZOOM : map.getZoom());
  }

  document.getElementById('status-coords').textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  const accEl = document.getElementById('status-accuracy');
  accEl.textContent = t('mapAccuracy', { meters: Math.round(accuracy) });
  accEl.classList.toggle('status-accuracy--poor', accuracy > 50);

  updatePresetGridReadiness();
}

function handleGpsError(err) {
  console.error('GPS error:', err.code, err.message);

  // POSITION_UNAVAILABLE / TIMEOUT are routine on desktop and indoors.
  // Fall back to manual placement rather than nagging.
  if (err.code === 2 || err.code === 3) {
    if (!gps.getCurrentPosition()) {
      showToast(t('errorGpsFallback'), 'info');
    }
    return;
  }

  const msg =
    err.code === 'UNAVAILABLE'
      ? t('errorGpsUnavailable')
      : err.code === 1
        ? t('errorGpsDenied')
        : t('errorGpsTimeout');
  showToast(msg, 'error');
}

function updateGpsButton(active) {
  const btn = document.getElementById('btn-gps');
  const dot = document.getElementById('gps-dot');
  if (!btn || !dot) return;
  dot.className = active ? 'gps-dot gps-dot--on' : 'gps-dot gps-dot--off';
  btn.setAttribute('aria-label', active ? t('gpsOn') : t('gpsOff'));
  btn.title = active ? t('gpsOn') : t('gpsOff');

  // Only announce changes the user asked for. GPS auto-starts on launch, and
  // that toast would otherwise bury the session-resume message.
  if (gpsToggledByUser) {
    showToast(
      active ? t('gpsTrackingActive') : t('gpsBatteryWarning'),
      active ? 'success' : 'warn'
    );
  }
  updatePresetGridReadiness();
}

export function toggleGps() {
  gpsToggledByUser = true;
  gps.toggle();
}

/**
 * Disable preset buttons while there is nowhere to place a node. Tapping a
 * preset before the first GPS fix used to look like a failed recording — this
 * makes the "not ready yet" state visible instead.
 */
function updatePresetGridReadiness() {
  const ready = placementMode === 'crosshair' || gps.getCurrentPosition() !== null;
  const grid = document.getElementById('preset-grid');
  if (!grid) return;
  grid.classList.toggle('preset-grid--waiting', !ready);
  for (const btn of grid.querySelectorAll('.preset-btn')) {
    btn.disabled = !ready;
    btn.title = ready ? t('holdForNote') : t('waitingForGps');
  }
}

// ─── Session modal ─────────────────────────────────────────────────────────

/**
 * On launch, silently resume the session that was active last time if it has
 * data in it. Only ask when there is a real choice to make.
 */
function openSessionModal() {
  const resumed = resumeActiveSession();
  if (resumed) {
    adoptSession(resumed);
    showToast(t('sessionResumed', { count: resumed.nodes.length }), 'info');
    maybeShowTutorial();
    return;
  }

  const lastSession = getLastSession();
  const newBtn = document.getElementById('btn-session-new');
  const appendBtn = document.getElementById('btn-session-append');
  const appendInfo = document.getElementById('session-append-info');
  const hasLast = !!lastSession && lastSession.nodes.length > 0;

  if (hasLast) {
    appendBtn.removeAttribute('disabled');
    appendInfo.textContent = t('sessionLastInfo', {
      count: lastSession.nodes.length,
      date: new Date(lastSession.createdAt).toLocaleDateString(),
    });
  } else {
    appendBtn.setAttribute('disabled', 'true');
    appendInfo.textContent = t('sessionNoExisting');
  }

  // The two options are not equivalent and must not look it: continuing work
  // already on the device is the safe default, while "new" discards nothing
  // but starts an empty export. Whichever is the likely intent is the one
  // drawn as primary.
  newBtn?.classList.toggle('session-option--primary', !hasLast);
  appendBtn?.classList.toggle('session-option--primary', hasLast);

  openModal('modal-session');
}

/**
 * Make `session` the one being recorded into, and make the screen show it.
 *
 * renderExistingNodes() runs unconditionally, including for an empty new
 * session, because it is also what clears the markers of whichever session was
 * on the map before.
 */
function adoptSession(session) {
  currentSession = session;
  renderPresetGrid(activeMode);
  updateNodeCount();
  renderExistingNodes();
  if (!gps.isActive) gps.start();
  refreshStorageInfo();
  // Building the preset grid changes the layout under the map. Re-measure now,
  // while nothing is placed yet, rather than mid-survey.
  onMapResize();
}

/**
 * Start an empty session, discarding nothing.
 *
 * "New" has to mean new on screen as well as in storage: the map keeps its
 * markers in a module-level Map, and a half-finished note or bearing survives
 * in module state, so without this reset the previous session's nodes stayed
 * drawn over an empty session — and, because node ids restart at -1 per
 * session, the first node recorded into the new session collided with a
 * leftover marker id and never appeared.
 */
export function startNewSession() {
  resetPendingCapture();
  adoptSession(createSession());
  closeModal('modal-session');
  maybeShowTutorial();
}

/** Drop anything staged for a node that was never saved. */
function resetPendingCapture() {
  pendingPreset = null;
  pendingPhotos = [];
  noteModalOpen = false;
  editingNodeId = null;
  deletingNodeId = null;
  deletingRow = null;
  clearDirection();
  directionWidget?.close();
  closeModal('modal-note');
  closeModal('modal-nodeedit');
  closeModal('modal-nodedelete');
  closeNodeList();
}

/**
 * Start a new session from the settings panel, mid-survey.
 *
 * Without this the launch chooser was the only way to start one, and it is
 * skipped entirely once the active session holds nodes — so a surveyor who had
 * recorded anything could never begin a second survey without clearing all
 * their data. The existing session is left on the device and stays exportable
 * via "Append to Last Session" on the next launch.
 */
export function newSessionFromSettings() {
  const count = currentSession?.nodes.length ?? 0;
  if (count > 0 && !confirm(t('sessionNewConfirm', { count }))) return;

  closeSettings();
  startNewSession();
  showToast(t('sessionNewStarted'), 'info');
}

export function appendToLastSession() {
  const last = getLastSession();
  if (!last) return;
  resetPendingCapture();
  adoptSession(last);
  closeModal('modal-session');
}

// ─── Node markers ──────────────────────────────────────────────────────────

function renderExistingNodes() {
  if (!currentSession) return;
  nodeMarkers.forEach((marker) => marker.remove());
  nodeMarkers.clear();
  for (const node of currentSession.nodes) {
    addNodeMarker(node);
  }
}

function addNodeMarker(node) {
  if (nodeMarkers.has(node.id)) return nodeMarkers.get(node.id);

  const preset = presetForNode(node);
  const label = preset ? t(preset.labelKey) : t('nodeGeneric');
  const dirTag = node.tags['direction'] ?? node.tags['camera:direction'];

  // Per-marker rotation is data-driven and cannot be expressed as a static
  // class — this is the documented divIcon exception.
  const arrowHtml =
    dirTag != null
      ? `<span class="node-marker-arrow" style="transform:rotate(${Number(dirTag)}deg)">↑</span>`
      : '';

  // The marker stands alone on the map with no text beside it, so unlike
  // every other icon in the app this one carries an accessible name.
  const markerIcon = iconMarkup(preset?.iconRef ?? FALLBACK_ICON, {
    className: 'node-marker-icon',
    label,
  });

  const leafletIcon = L.divIcon({
    className: 'node-marker',
    html: `${markerIcon}${arrowHtml}`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  const dirLabel =
    dirTag != null ? `<br><small>dir: ${dirTag}° ${degreesToCardinal(Number(dirTag))}</small>` : '';

  const marker = L.marker([node.lat, node.lon], { icon: leafletIcon })
    .bindPopup(`<b>${escHtml(label)}</b>${node.note ? `<br>${escHtml(node.note)}` : ''}${dirLabel}`)
    .addTo(map);

  nodeMarkers.set(node.id, marker);
  return marker;
}

// ─── Tutorial ──────────────────────────────────────────────────────────────

function maybeShowTutorial() {
  if (!getPref('tutorialSeen', false)) showTutorial();
}

export function showTutorial() {
  tutorialSlide = 0;
  renderTutorialSlide();
  openModal('modal-tutorial');
}

function renderTutorialSlide() {
  const idx = tutorialSlide + 1;
  const isLastSlide = tutorialSlide === TUTORIAL_TOTAL - 1;

  document.getElementById('tut-title').textContent = t(`tutorialSlide${idx}Title`);
  document.getElementById('tut-body').textContent = t(`tutorialSlide${idx}Body`);
  document.getElementById('tut-progress').textContent = `${idx} / ${TUTORIAL_TOTAL}`;

  const nextBtn = document.getElementById('btn-tut-next');
  nextBtn.textContent = isLastSlide ? t('tutorialDone') : t('tutorialNext');
  // Final slide is the "go" action — green, and full width once Skip is gone.
  nextBtn.classList.toggle('btn-go', isLastSlide);

  // On the last slide Skip and "Start Surveying" do exactly the same thing,
  // so offering both is a false choice.
  document.getElementById('btn-tut-skip').toggleAttribute('hidden', isLastSlide);
}

export function dismissTutorial() {
  setPref('tutorialSeen', true);
  closeModal('modal-tutorial');
}

export function advanceTutorial() {
  if (tutorialSlide < TUTORIAL_TOTAL - 1) {
    tutorialSlide++;
    renderTutorialSlide();
  } else {
    dismissTutorial();
  }
}

// ─── Mode switcher ─────────────────────────────────────────────────────────

function renderModeTabs() {
  const container = document.getElementById('mode-tabs');
  if (!container) return;
  container.innerHTML = '';
  for (const mode of MODES) {
    const btn = document.createElement('button');
    btn.className = 'mode-tab' + (mode.id === activeMode ? ' mode-tab--active' : '');
    btn.textContent = t(mode.labelKey);
    btn.dataset.mode = mode.id;
    btn.setAttribute('augmented-ui', 'tl-clip br-clip exe');
    // Arrow closes over `mode`; the logic itself is in onModeSelect.
    btn.addEventListener('click', () => onModeSelect(mode.id));
    container.appendChild(btn);
  }
}

function onModeSelect(modeId) {
  activeMode = modeId;
  renderPresetGrid(modeId);
}

// ─── Preset grid ───────────────────────────────────────────────────────────

function renderPresetGrid(modeId) {
  renderModeTabs();
  const grid = document.getElementById('preset-grid');
  if (!grid) return;
  grid.innerHTML = '';

  for (const preset of PRESETS[modeId] || []) {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.setAttribute('augmented-ui', 'tl-clip br-clip exe');
    btn.dataset.presetId = preset.id;
    btn.innerHTML =
      iconMarkup(preset.iconRef, { className: 'preset-icon' }) +
      `<span class="preset-label">${escHtml(t(preset.labelKey))}</span>`;

    // Arrows close over `preset`; the logic lives in the named functions.
    btn.addEventListener('pointerdown', () => onPresetPointerDown(preset));
    btn.addEventListener('pointerup', () => onPresetPointerUp(preset));
    btn.addEventListener('pointercancel', onPresetPointerCancel);
    btn.addEventListener('pointerleave', onPresetPointerCancel);

    grid.appendChild(btn);
  }
  updatePresetGridReadiness();
}

function onPresetPointerDown(preset) {
  pendingPreset = preset;
  holdTimer = setTimeout(() => {
    holdTimer = null;
    openNoteModal(preset);
  }, 700);
}

function onPresetPointerUp(preset) {
  if (!holdTimer) return; // hold already fired and opened the note modal
  clearTimeout(holdTimer);
  holdTimer = null;
  // Short tap records immediately, so no note is pending afterwards.
  pendingPreset = null;
  recordNode(preset, '', []);
}

function onPresetPointerCancel() {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
    pendingPreset = null;
  }
}

// ─── Recording ─────────────────────────────────────────────────────────────

function recordNode(preset, note, photos) {
  if (!currentSession) {
    showToast(t('errorNoSession'), 'error');
    return;
  }

  let lat, lon, accuracy;

  if (placementMode === 'crosshair') {
    const point = crosshairLatLng();
    lat = point.lat;
    lon = point.lng;
    accuracy = null;
  } else {
    const pos = gps.getCurrentPosition();
    if (!pos) {
      showToast(t('waitingForGps'), 'warn');
      return;
    }
    lat = pos.lat;
    lon = pos.lon;
    accuracy = pos.accuracy;
  }

  const tags = { ...preset.tags };
  if (pendingDirection !== null) {
    tags['direction'] = Math.round(pendingDirection);
    if (tags['man_made'] === 'surveillance') {
      tags['camera:direction'] = Math.round(pendingDirection);
    }
  }

  const node = addNode(currentSession, {
    lat,
    lon,
    accuracy,
    tags,
    note,
    photos,
    presetId: preset.id,
  });
  if (!node) return; // storage rejected the write; the error listener notified

  addNodeMarker(node);
  if (navigator.vibrate) navigator.vibrate(60);
  playRecordClick();

  const savedDir = pendingDirection;
  // A camera node holds its bearing for the next one. Surveying a run of
  // cameras along a street means recording several that face the same way, and
  // re-setting the wheel between each was the cost of a rule written for
  // one-off bearings. Anything without camera:direction still clears, so a
  // bearing is never silently reused by an unrelated preset. The top-bar badge
  // and the direction button's arrow are what keep a held bearing visible.
  if (node.tags['camera:direction'] == null) clearDirection();

  showToast(
    buildRecordSummary(preset, node, savedDir),
    'success',
    iconMarkup(preset.iconRef, { className: 'toast-icon' })
  );
  updateNodeCount();
  refreshStorageInfo();
}

/**
 * Confirmation line for a recorded node. Reports what was actually written to
 * the node, so the surveyor can catch a wrong bearing or a bad fix without
 * opening the node list.
 *
 * e.g. "Fixed Camera · 245° WSW · ±8m · note · #12", led by the preset's icon,
 * which showToast renders ahead of this text.
 */
function buildRecordSummary(preset, node, direction) {
  const parts = [t(preset.labelKey)];

  if (direction !== null) {
    const deg = Math.round(direction);
    // camera:direction is written alongside direction for surveillance nodes,
    // so flag which convention this node uses.
    const key = node.tags['camera:direction'] != null ? 'cam' : 'dir';
    parts.push(`${key} ${deg}° ${degreesToCardinal(direction)}`);
    // Say when the bearing is being kept for the next node, so a held
    // direction is never a surprise on the following camera.
    if (node.tags['camera:direction'] != null) parts.push(t('summaryDirectionHeld'));
  }

  if (node.accuracy_m != null) {
    parts.push(`±${Math.round(node.accuracy_m)}m`);
  } else if (placementMode === 'crosshair') {
    parts.push(t('placementManualSuffix'));
  }

  if (node.note) parts.push(t('summaryNote'));
  if (node.photos?.length) parts.push(`${node.photos.length}📷`);

  parts.push(`#${currentSession.nodes.length}`);
  return parts.join(' · ');
}

// ─── Note modal ────────────────────────────────────────────────────────────

function openNoteModal(preset) {
  pendingPhotos = [];
  noteModalOpen = true;
  document.getElementById('note-preset-label').textContent = t(preset.labelKey);
  document.getElementById('note-input').value = '';
  updateNoteDirectionField();
  updatePhotoPreview();
  openModal('modal-note');
  document.getElementById('note-input').focus();
}

export function saveNote() {
  const note = document.getElementById('note-input').value.trim();
  if (pendingPreset) recordNode(pendingPreset, note, [...pendingPhotos]);
  cancelNote();
}

export function cancelNote() {
  pendingPreset = null;
  pendingPhotos = [];
  noteModalOpen = false;
  closeModal('modal-note');
}

export function openPhotoPicker() {
  document.getElementById('photo-file-input').click();
}

export function addPhotoFiles(fileList) {
  for (const file of Array.from(fileList || [])) {
    const reader = new FileReader();
    reader.onload = onPhotoRead;
    reader.readAsDataURL(file);
  }
}

function onPhotoRead(ev) {
  pendingPhotos.push(ev.target.result);
  updatePhotoPreview();
}

function updatePhotoPreview() {
  const el = document.getElementById('photo-count');
  if (el) {
    el.textContent = pendingPhotos.length
      ? t('photoAttached', { count: pendingPhotos.length })
      : '';
  }
}

// ─── Placement mode ────────────────────────────────────────────────────────

export function togglePlacementMode() {
  placementMode = placementMode === 'gps' ? 'crosshair' : 'gps';
  updatePlacementModeButton();
}

function updatePlacementModeButton() {
  const btn = document.getElementById('btn-placement-mode');
  const crosshair = document.getElementById('map-crosshair');
  if (!btn) return;

  const manual = placementMode === 'crosshair';
  btn.textContent = manual ? '⊕' : '📍';
  btn.title = manual ? t('placementCrosshair') : t('placementGps');
  btn.classList.toggle('map-btn--placement-manual', manual);

  if (crosshair) crosshair.toggleAttribute('hidden', !manual);

  if (manual && mapLocked) {
    mapLocked = false;
    updateLockButton();
  }
  updatePresetGridReadiness();
}

// ─── Undo / map lock ───────────────────────────────────────────────────────

export function undoLastNode() {
  if (!currentSession) return;
  const removed = removeLastNode(currentSession);
  if (!removed) return;

  const marker = nodeMarkers.get(removed.id);
  if (marker) {
    marker.remove();
    nodeMarkers.delete(removed.id);
  }
  showToast(t('nodeUndone'), 'info');
  updateNodeCount();
  refreshStorageInfo();
}

export function toggleMapLock() {
  mapLocked = !mapLocked;
  updateLockButton();
  if (mapLocked) {
    const pos = gps.getCurrentPosition();
    if (pos) map.setView([pos.lat, pos.lon], map.getZoom());
  }
}

function updateLockButton() {
  const btn = document.getElementById('btn-map-lock');
  if (!btn) return;
  btn.textContent = mapLocked ? '🔒' : '🔓';
  btn.title = mapLocked ? t('mapLocked') : t('mapUnlocked');
}

// ─── Export ────────────────────────────────────────────────────────────────

export function openExportModal() {
  // Always reopen on the current session. "All sessions" is the deliberate
  // choice, never the one a distracted tap inherits from last time.
  exportScope = 'session';
  renderExportScope();
  openModal('modal-export');
}

/**
 * Fill in both scope buttons with what they would actually export, and mark
 * the chosen one. The counts are the point: without them "All Sessions" is a
 * blind choice, and the reason older sessions felt unreachable is that nothing
 * in the UI ever admitted they existed.
 */
function renderExportScope() {
  const sessionCount = currentSession?.nodes.length ?? 0;
  const others = loadAllSessions();
  const otherNodes = others.reduce((sum, session) => sum + session.nodes.length, 0);
  const hasOthers = others.length > 0;

  const sessionInfo = document.getElementById('export-scope-session-info');
  if (sessionInfo) sessionInfo.textContent = t('exportScopeSessionInfo', { count: sessionCount });

  const allInfo = document.getElementById('export-scope-all-info');
  if (allInfo) {
    allInfo.textContent = hasOthers
      ? t('exportScopeAllInfo', { nodes: otherNodes, sessions: others.length })
      : t('exportScopeAllNone');
  }

  const allBtn = document.getElementById('btn-export-scope-all');
  if (allBtn) {
    if (hasOthers) allBtn.removeAttribute('disabled');
    else allBtn.setAttribute('disabled', 'true');
  }
  if (!hasOthers) exportScope = 'session';

  for (const [scope, id] of [
    ['session', 'btn-export-scope-session'],
    ['all', 'btn-export-scope-all'],
  ]) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    const active = exportScope === scope;
    btn.classList.toggle('export-scope-btn--active', active);
    btn.setAttribute('aria-pressed', String(active));
  }

  const info = document.getElementById('export-session-info');
  if (info) {
    info.textContent =
      exportScope === 'all' ? t('exportScopeAllNote') : t('nodeCount', { count: sessionCount });
  }
}

export function setExportScope(scope) {
  exportScope = scope;
  renderExportScope();
}

/**
 * Every session as one exportable unit.
 *
 * The live `currentSession` object is substituted for its stored copy — they
 * are equal in practice, since every node write is synchronous, but exporting
 * a re-read of the session the user is actively recording into is a needless
 * way to lose the last node if a write ever lands late. If it somehow is not
 * in the index at all, it is appended rather than dropped.
 */
function buildCombinedExport() {
  const sessions = loadAllSessions().map((session) =>
    session.id === currentSession?.id ? currentSession : session
  );
  const hasCurrent = sessions.some((session) => session.id === currentSession?.id);
  if (!hasCurrent && currentSession?.nodes.length) sessions.push(currentSession);
  return mergeSessions(sessions);
}

export function exportAs(format) {
  const payload = exportScope === 'all' ? buildCombinedExport() : currentSession;

  if (!payload || !payload.nodes.length) {
    showToast(t(exportScope === 'all' ? 'exportEmptyAll' : 'exportEmpty'), 'warn');
    return;
  }
  exportSession(payload, format);
  closeModal('modal-export');
}

// ─── Settings ──────────────────────────────────────────────────────────────

export function openSettings() {
  refreshStorageInfo();
  openModal('panel-settings');
}

export function closeSettings() {
  closeModal('panel-settings');
}

export function clearAllSessions() {
  if (!confirm(t('settingsClearConfirm'))) return;
  resetPendingCapture();
  deleteAllSessions();
  // adoptSession() clears the markers of the session just deleted.
  adoptSession(createSession());
  showToast(t('settingsCleared'), 'info');
}

/**
 * Sound is off by default. This tool is used to survey surveillance
 * infrastructure, sometimes where the surveyor would rather not draw attention
 * (see REQUIREMENTS.md §2) — a phone that clicks on every saved node is a
 * behavior the user should opt into, not discover in the field.
 */
function initSound() {
  applySoundPref(getPref('soundEnabled', false));
}

function applySoundPref(on) {
  setSoundEnabled(on);
  const btn = document.getElementById('btn-settings-sound');
  if (!btn) return;
  btn.textContent = on ? t('soundOn') : t('soundOff');
  btn.setAttribute('aria-pressed', String(on));
  btn.classList.toggle('btn-ghost--active', on);
}

export function toggleSound() {
  const on = !isSoundEnabled();
  applySoundPref(on);
  setPref('soundEnabled', on);
  // Enabling is itself a user gesture — the only moment iOS will let the
  // AudioContext start — so unlock here, then confirm it audibly.
  if (on) {
    unlockAudio();
    playToggleBlip();
  }
}

export function changeLanguage(code) {
  setLocale(code);
  setPref('locale', code);
  applyAllStrings();
  renderPresetGrid(activeMode);
  updateLockButton();
  updatePlacementModeButton();
  updateNodeCount();
  applySoundPref(isSoundEnabled()); // label is set in JS, not via data-i18n
}

/**
 * Refresh the storage figures in the settings panel: how much survey data is
 * held, how much room is left, and whether the browser has promised not to
 * evict it.
 */
async function refreshStorageInfo() {
  const usedEl = document.getElementById('storage-used');
  const quotaEl = document.getElementById('storage-quota');
  const persistEl = document.getElementById('storage-persisted');
  const countEl = document.getElementById('storage-sessions');
  if (!usedEl) return;

  const health = await getStorageHealth();

  usedEl.textContent = `${health.usedKb} KB`;
  if (quotaEl) {
    quotaEl.textContent = health.quotaKb
      ? `${(health.quotaKb / 1024).toFixed(0)} MB`
      : t('storageUnknown');
  }
  if (countEl) {
    countEl.textContent = t('storageSessionSummary', {
      sessions: health.sessionCount,
      nodes: health.nodeCount,
    });
  }
  if (persistEl) {
    const ok = health.available && storageWritable;
    persistEl.textContent = !ok
      ? t('storageStateBlocked')
      : health.persisted
        ? t('storageStatePersisted')
        : t('storageStateBestEffort');
    persistEl.classList.toggle('storage-state--good', ok && health.persisted);
    persistEl.classList.toggle('storage-state--warn', ok && !health.persisted);
    persistEl.classList.toggle('storage-state--bad', !ok);
  }
}

// ─── i18n ──────────────────────────────────────────────────────────────────

function applyAllStrings() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });

  const sel = document.getElementById('select-language');
  if (sel) {
    sel.innerHTML = '';
    for (const loc of AVAILABLE_LOCALES) {
      const opt = document.createElement('option');
      opt.value = loc.code;
      opt.textContent = loc.label;
      if (loc.code === getLocale()) opt.selected = true;
      sel.appendChild(opt);
    }
  }
}

// ─── Node list panel ───────────────────────────────────────────────────────

export function openNodeList() {
  if (!currentSession) return;
  closeSettings();
  renderNodeList();
  openModal('panel-nodelist');
}

export function closeNodeList() {
  closeModal('panel-nodelist');
}

function renderNodeList() {
  const container = document.getElementById('nodelist-items');
  if (!container || !currentSession) return;

  const nodes = currentSession.nodes;
  updateNodeListCount();
  container.innerHTML = '';

  if (!nodes.length) {
    const empty = document.createElement('div');
    empty.className = 'nodelist-empty';
    empty.textContent = t('nodeListEmpty');
    container.appendChild(empty);
    return;
  }

  // Newest first for review convenience.
  for (const node of [...nodes].reverse()) {
    container.appendChild(buildNodeRow(node));
  }
}

function updateNodeListCount() {
  const header = document.getElementById('nodelist-count');
  if (header && currentSession) {
    header.textContent = t('nodeCount', { count: currentSession.nodes.length });
  }
}

function buildNodeRow(node) {
  const primaryTag = Object.entries(node.tags)
    .filter(([k]) => k !== 'source')
    .map(([k, v]) => `${k}=${v}`)
    .slice(0, 2)
    .join(' · ');

  const icon = iconMarkup(presetForNode(node)?.iconRef ?? FALLBACK_ICON, {
    className: 'nodelist-icon',
  });
  const time = new Date(node.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const coords = `${node.lat.toFixed(5)}, ${node.lon.toFixed(5)}`;
  const dirTag = node.tags['direction'] ?? node.tags['camera:direction'];
  const dirStr = dirTag != null ? ` · ⬆ ${dirTag}° ${degreesToCardinal(Number(dirTag))}` : '';
  const accuracyStr = node.accuracy_m != null ? ` · ±${Math.round(node.accuracy_m)}m` : '';

  const row = document.createElement('div');
  row.className = 'nodelist-row';
  row.dataset.nodeId = node.id;

  row.innerHTML = `
    <div class="nodelist-row-header">
      ${icon}
      <div class="nodelist-meta">
        <span class="nodelist-tags">${escHtml(primaryTag || t('nodeNoTags'))}</span>
        <span class="nodelist-sub">${time} · ${coords}${accuracyStr}${dirStr}</span>
      </div>
      <div class="nodelist-actions">
        <button class="nodelist-btn-edit" augmented-ui="tl-clip br-clip exe" title="${escHtml(t('nodeEditTitle'))}">✏</button>
        <button class="nodelist-btn-delete" augmented-ui="tl-clip br-clip exe" title="${escHtml(t('nodeDeleteTitle'))}">✕</button>
      </div>
    </div>
    ${node.note ? `<div class="nodelist-note">${escHtml(node.note)}</div>` : ''}
  `;

  // Arrows close over `node` / `row`; logic lives in the named functions.
  row
    .querySelector('.nodelist-btn-edit')
    .addEventListener('click', (e) => onNodeEditClick(e, node));
  row
    .querySelector('.nodelist-btn-delete')
    .addEventListener('click', (e) => onNodeDeleteClick(e, node, row));
  row.addEventListener('click', () => onNodeRowClick(node));

  return row;
}

function onNodeEditClick(e, node) {
  e.stopPropagation();
  openNodeEditModal(node);
}

function onNodeDeleteClick(e, node, row) {
  e.stopPropagation();
  openNodeDeleteConfirm(node, row);
}

function onNodeRowClick(node) {
  map.setView([node.lat, node.lon], Math.max(map.getZoom(), 18));
  closeNodeList();
}

// ─── Node edit modal ───────────────────────────────────────────────────────

function openNodeEditModal(node) {
  editingNodeId = node.id;

  const tagList = document.getElementById('nodeedit-tags');
  if (tagList) {
    tagList.innerHTML = Object.entries(node.tags)
      .filter(([k]) => k !== 'source')
      .map(
        ([k, v]) => `<span class="nodeedit-tag"><b>${escHtml(k)}</b>=${escHtml(String(v))}</span>`
      )
      .join('');
  }

  const coordEl = document.getElementById('nodeedit-coords');
  if (coordEl) coordEl.textContent = `${node.lat.toFixed(7)}, ${node.lon.toFixed(7)}`;

  const noteEl = document.getElementById('nodeedit-note');
  if (noteEl) noteEl.value = node.note || '';

  const timeEl = document.getElementById('nodeedit-time');
  if (timeEl) timeEl.textContent = new Date(node.timestamp).toLocaleString();

  openModal('modal-nodeedit');
  noteEl?.focus();
}

export function saveNodeEdit() {
  if (editingNodeId === null || !currentSession) return;
  const note = document.getElementById('nodeedit-note')?.value.trim() ?? '';
  const updated = updateNodeNote(currentSession, editingNodeId, note);
  editingNodeId = null;
  closeModal('modal-nodeedit');
  if (!updated) return;
  renderNodeList();
  showToast(t('nodeNoteUpdated'), 'success');
}

export function cancelNodeEdit() {
  editingNodeId = null;
  closeModal('modal-nodeedit');
}

// ─── Node delete confirmation ──────────────────────────────────────────────

function openNodeDeleteConfirm(node, rowEl) {
  deletingNodeId = node.id;
  deletingRow = rowEl;

  const label = document.getElementById('nodedelete-label');
  if (label) {
    const primaryTag = Object.entries(node.tags)
      .filter(([k]) => k !== 'source')
      .map(([k, v]) => `${k}=${v}`)
      .slice(0, 1)
      .join('');
    const time = new Date(node.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    label.textContent = `${primaryTag || t('nodeGeneric')} — ${time}`;
  }

  openModal('modal-nodedelete');
}

export function confirmNodeDelete() {
  if (deletingNodeId === null || !currentSession) return;

  if (deleteNodeById(currentSession, deletingNodeId)) {
    const marker = nodeMarkers.get(deletingNodeId);
    if (marker) {
      marker.remove();
      nodeMarkers.delete(deletingNodeId);
    }
    deletingRow?.remove();
    updateNodeCount();
    updateNodeListCount();
    refreshStorageInfo();

    const container = document.getElementById('nodelist-items');
    if (container && !container.children.length) renderNodeList();
    showToast(t('nodeDeleted'), 'warn');
  }

  cancelNodeDelete();
}

export function cancelNodeDelete() {
  deletingNodeId = null;
  deletingRow = null;
  closeModal('modal-nodedelete');
}

// ─── Manual location ───────────────────────────────────────────────────────

export function openManualLocationModal() {
  closeSettings();
  const center = map.getCenter();
  document.getElementById('manual-lat').value = center.lat.toFixed(6);
  document.getElementById('manual-lon').value = center.lng.toFixed(6);
  openModal('modal-manual-location');
  document.getElementById('manual-lat').focus();
}

export function applyManualLocation() {
  const lat = parseFloat(document.getElementById('manual-lat').value.trim());
  const lon = parseFloat(document.getElementById('manual-lon').value.trim());

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    showToast(t('errorCoordsInvalid'), 'error');
    return;
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    showToast(t('errorCoordsRange'), 'error');
    return;
  }

  map.setView([lat, lon], Math.max(map.getZoom(), 16));
  mapLocked = false;
  updateLockButton();

  placementMode = 'crosshair';
  updatePlacementModeButton();

  closeModal('modal-manual-location');
  showToast(t('manualLocationSet', { lat: lat.toFixed(4), lon: lon.toFixed(4) }), 'success');
}

export function cancelManualLocation() {
  closeModal('modal-manual-location');
}

// ─── Escape ────────────────────────────────────────────────────────────────

/** True when the overlay with this id is currently on screen. */
function isLayerOpen(id) {
  const el = document.getElementById(id);
  return !!el && !el.hasAttribute('hidden');
}

/**
 * Close the topmost dismissible layer, doing exactly what that layer's own
 * cancel button does — Escape must not become a second, subtly different exit.
 * Returns true if something was dismissed.
 *
 * Order is stacking order, innermost first. Two deliberate omissions:
 *
 *   - The direction wheel goes first even though the note modal is "under" it,
 *     because the note modal is hidden rather than closed while the wheel is
 *     up; its own cancel path restores it.
 *   - modal-session is never dismissed. It is a required choice at launch, and
 *     closing it would leave the app with no session to record into.
 */
export function dismissTopLayer() {
  if (directionWidget?.isOpen()) {
    directionWidget.close();
    onDirectionWidgetCancel();
    return true;
  }
  if (isLayerOpen('modal-nodedelete')) {
    cancelNodeDelete();
    return true;
  }
  if (isLayerOpen('modal-nodeedit')) {
    cancelNodeEdit();
    return true;
  }
  if (isLayerOpen('modal-manual-location')) {
    cancelManualLocation();
    return true;
  }
  if (isLayerOpen('modal-note')) {
    cancelNote();
    return true;
  }
  if (isLayerOpen('modal-tutorial')) {
    dismissTutorial();
    return true;
  }
  if (isLayerOpen('modal-export')) {
    closeModal('modal-export');
    return true;
  }
  if (isLayerOpen('panel-nodelist')) {
    closeNodeList();
    return true;
  }
  if (isLayerOpen('panel-settings')) {
    closeSettings();
    return true;
  }
  return false;
}

export function fillManualLocationFromMap() {
  const center = map.getCenter();
  document.getElementById('manual-lat').value = center.lat.toFixed(6);
  document.getElementById('manual-lon').value = center.lng.toFixed(6);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Which preset produced this node.
 *
 * Nodes now record the preset that made them (`node.presetId`), which is
 * exact. Tag matching is the fallback for nodes saved before that field
 * existed, and it cannot always be right: urban_pole and pow_pole write
 * identical tags, as do curb_barrier and bike_bollard, so an older node from
 * either pair may resolve to its twin.
 *
 * presetId is a display aid, not survey data — export.js reads node.tags and
 * never sees it, so nothing reaches OSM that the surveyor did not record.
 */
function presetForNode(node) {
  return findPresetById(node.presetId) ?? findPresetByTags(node.tags);
}

function updateNodeCount() {
  const el = document.getElementById('status-node-count');
  if (el && currentSession) {
    el.textContent = t('nodeCount', { count: currentSession.nodes.length });
  }
}
