
/**
 * Flaneur OSM Recorder — Main Application
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Entry point. Initialises map, GPS, session, and UI event handlers.
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../css/index.css';
import '../css/direction-widget.css';

import { t, setLocale, getLocale, AVAILABLE_LOCALES } from './i18n.js';
import { MODES, PRESETS } from './presets.js';
import {
  createSession,
  loadSession,
  getLastSession,
  getActiveSessionId,
  addNode,
  removeLastNode,
  deleteNodeById,
  updateNodeNote,
  getPref,
  setPref,
  deleteAllSessions,
  estimateStorageUsedKb,
} from './storage.js';
import { exportSession } from './export.js';
import { GpsManager } from './gps.js';
import { showToast, closeModal, escHtml } from './ui-utils.js';
import { DirectionWidget, degreesToCardinal } from './direction-widget.js';

// ─── State ─────────────────────────────────────────────────────────────────

let map, gpsMarker, accuracyCircle;
let mapLocked = true;
let currentSession = null;
let activeMode = 'urban';
let holdTimer = null;
let pendingPreset = null;
let pendingPhotos = [];
let placementMode = 'gps'; // 'gps' or 'crosshair'
const nodeMarkers = new Map(); // Track markers by node ID for visualization

// Direction widget state
let pendingDirection = null; // degrees (0-359) or null
let directionWidget = null;

const gps = new GpsManager({
  onPosition: handlePosition,
  onError: handleGpsError,
  onStatusChange: updateGpsButton,
});

// ─── Init ──────────────────────────────────────────────────────────────────


document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Flaneur: DOMContentLoaded event fired');

  // Restore locale preference
  const savedLocale = getPref('locale', 'en');
  setLocale(savedLocale);

  console.log('🗺️  Initializing map...');
  initMap();

  console.log('🧭 Initializing direction widget...');
  initDirectionWidget();

  console.log('🌍 Applying i18n strings...');
  applyAllStrings();

  console.log('📋 Showing session modal...');
  showSessionModal();

  // Start GPS automatically
  console.log('📍 Starting GPS...');
  gps.start();
});

function initMap() {
  console.log('🗺️  initMap() called');

  try {
    const mapEl = document.getElementById('map');
    if (!mapEl) {
      console.error('❌ Map element #map not found in DOM!');
      return;
    }
    console.log('✅ Map element found:', mapEl);

    map = L.map('map', {
      zoomControl: false,
      attributionControl: true,
    }).setView([0, 0], 18);

    console.log('✅ Leaflet map instance created:', map);

    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 21,
      maxNativeZoom: 19,
    }).addTo(map);

    console.log('✅ OSM tile layer added to map:', tileLayer);

    // Listen for tile loading events
    tileLayer.on('loading', () => console.log('🔄 Tiles loading...'));
    tileLayer.on('load', () => console.log('✅ Tiles loaded successfully'));
    tileLayer.on('tileerror', (error) => console.error('❌ Tile loading error:', error));

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    console.log('✅ Zoom control added');

    map.on('drag', () => {
      if (mapLocked) {
        mapLocked = false;
        updateLockButton();
      }
    });

    // Create crosshair reticle (hidden by default)
    createCrosshair();
    console.log('✅ Crosshair created');

    // Force map to invalidate size after DOM is ready
    setTimeout(() => {
      console.log('🔄 Invalidating map size...');
      map.invalidateSize();
      console.log('✅ Map size invalidated');
    }, 100);

    console.log('✅ Map initialization complete');
  } catch (error) {
    console.error('❌ Error in initMap():', error);
  }
}

// ─── Crosshair reticle ─────────────────────────────────────────────────────

function createCrosshair() {
  const crosshair = document.createElement('div');
  crosshair.id = 'map-crosshair';
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

function showCrosshair() {
  const el = document.getElementById('map-crosshair');
  if (el) el.style.display = 'block';
}

function hideCrosshair() {
  const el = document.getElementById('map-crosshair');
  if (el) el.style.display = 'none';
}

// ─── Direction widget ──────────────────────────────────────────────────────

function initDirectionWidget() {
  directionWidget = new DirectionWidget({
    onConfirm: (deg) => {
      pendingDirection = deg;
      updateDirectionBadge(deg);
      // Update direction display in note modal and re-show it
      const dirField = document.getElementById('note-direction-display');
      if (dirField) {
        dirField.textContent = `${Math.round(deg)}° ${degreesToCardinal(deg)}`;
        dirField.style.color = 'var(--accent)';
      }
      // Re-show note modal if it was open (pendingPreset still set)
      if (pendingPreset) {
        document.getElementById('modal-note').removeAttribute('hidden');
      }
      showToast(`Direction: ${Math.round(deg)}° ${degreesToCardinal(deg)}`, 'success');
    },
    onCancel: () => {
      // Re-show note modal if it was open
      if (pendingPreset) {
        document.getElementById('modal-note').removeAttribute('hidden');
      }
    },
  });
}

function updateDirectionBadge(deg) {
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

function clearDirection() {
  pendingDirection = null;
  updateDirectionBadge(null);
  const dirField = document.getElementById('note-direction-display');
  if (dirField) {
    dirField.textContent = 'Not set';
    dirField.style.color = 'var(--text-dim)';
  }
}

function handlePosition(pos) {
  const { lat, lon, accuracy } = pos;

  console.log(
    `📍 GPS position received: ${lat.toFixed(5)}, ${lon.toFixed(5)} (±${Math.round(accuracy)}m)`
  );

  if (!gpsMarker) {
    console.log('🎯 Creating GPS marker for first time');
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

    console.log('✅ GPS marker and accuracy circle added to map');
  } else {
    gpsMarker.setLatLng([lat, lon]);
    accuracyCircle.setLatLng([lat, lon]);
    accuracyCircle.setRadius(accuracy);
  }

  if (mapLocked) {
    console.log(`🔒 Map locked - centering on GPS position: ${lat}, ${lon}`);
    map.setView([lat, lon], map.getZoom());
  }

  // Update status bar
  document.getElementById('status-coords').textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  document.getElementById('status-accuracy').textContent = t('mapAccuracy', {
    meters: Math.round(accuracy),
  });

  if (accuracy > 50) {
    document.getElementById('status-accuracy').style.color = 'var(--warn)';
  } else {
    document.getElementById('status-accuracy').style.color = 'var(--accent-dim)';
  }
}


function handleGpsError(err) {
  console.error('❌ GPS Error:', err);
  console.error('   Error code:', err.code);
  console.error('   Error message:', err.message);

  // Don't show error toast for timeout on desktop - it's expected
  // User can use crosshair mode instead
  if (err.code === 2 || err.code === 3) {
    console.warn(
      '⚠️  GPS timeout/unavailable (expected on desktop). Use crosshair mode to place nodes manually.'
    );
    // Set map to a default location so user can navigate
    if (!gps.getCurrentPosition()) {
      // Default to somewhere reasonable (you can change this)
      map.setView([51.505, -0.09], 13); // London as default
      showToast('GPS unavailable. Pan the map and use crosshair mode (⊕) to place nodes.', 'info');
    }
    return;
  }

  const msg =
    err.code === 'UNAVAILABLE'
      ? t('errorGpsUnavailable')
      : err.code === 1 || err.code === GeolocationPositionError?.PERMISSION_DENIED
        ? t('errorGpsDenied')
        : t('errorGpsTimeout');
  showToast(msg, 'error');
}

function updateGpsButton(active) {
  console.log(`🔘 GPS status changed: ${active ? 'ON' : 'OFF'}`);

  const btn = document.getElementById('btn-gps');
  const dot = document.getElementById('gps-dot');
  if (!btn || !dot) return;
  dot.className = active ? 'gps-dot gps-dot--on' : 'gps-dot gps-dot--off';
  btn.setAttribute('aria-label', active ? t('gpsOn') : t('gpsOff'));
  btn.title = active ? t('gpsOn') : t('gpsOff');

  if (!active) {
    showToast(t('gpsBatteryWarning'), 'warn');
  }
}

// ─── Session modal ─────────────────────────────────────────────────────────

function showSessionModal() {
  const modal = document.getElementById('modal-session');
  const lastSession = getLastSession();
  const appendBtn = document.getElementById('btn-session-append');
  const appendInfo = document.getElementById('session-append-info');

  if (lastSession && lastSession.nodes.length > 0) {
    appendBtn.removeAttribute('disabled');
    const d = new Date(lastSession.createdAt).toLocaleDateString();
    appendInfo.textContent = t('sessionLastInfo', {
      count: lastSession.nodes.length,
      date: d,
    });
  } else {
    appendBtn.setAttribute('disabled', 'true');
    appendInfo.textContent = t('sessionNoExisting');
  }

  modal.removeAttribute('hidden');
}

document.getElementById('btn-session-new')?.addEventListener('click', () => {
  currentSession = createSession();
  closeModal('modal-session');
  renderPresetGrid(activeMode);
  updateNodeCount();
  maybeShowTutorial();
  // Start GPS automatically on new session
  if (!gps.isActive) {
    gps.start();
  }
});

document.getElementById('btn-session-append')?.addEventListener('click', () => {
  const last = getLastSession();
  if (last) {
    currentSession = last;
    closeModal('modal-session');
    renderPresetGrid(activeMode);
    updateNodeCount();
    // Render existing nodes on the map
    renderExistingNodes();
    // Start GPS automatically on session resume
    if (!gps.isActive) {
      gps.start();
    }
  }
});


// ─── Render existing nodes ─────────────────────────────────────────────────

function renderExistingNodes() {
  if (!currentSession) return;

  // Clear existing markers first
  nodeMarkers.forEach((marker) => marker.remove());
  nodeMarkers.clear();

  for (const node of currentSession.nodes) {
    addNodeMarker(node);
  }
}

function addNodeMarker(node) {
  // Don't add duplicates
  if (nodeMarkers.has(node.id)) return;

  // Find preset icon
  const preset = findPresetByTags(node.tags);
  const icon = preset ? preset.icon : '📍';

  // Check for direction
  const dirTag = node.tags['direction'] ?? node.tags['camera:direction'];
  const arrowHtml =
    dirTag != null
      ? `<span class="node-marker-arrow" style="transform:rotate(${dirTag}deg)">↑</span>`
      : '';

  const leafletIcon = L.divIcon({
    className: 'node-marker',
    html: `<span class="node-marker-icon">${icon}</span>${arrowHtml}`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  const dirLabel =
    dirTag != null ? `<br><small>dir: ${dirTag}° ${degreesToCardinal(Number(dirTag))}</small>` : '';

  const label = preset ? t(preset.labelKey) : 'Node';

  const marker = L.marker([node.lat, node.lon], { icon: leafletIcon })
    .bindPopup(`<b>${label}</b>${node.note ? `<br>${node.note}` : ''}${dirLabel}`)
    .addTo(map);

  nodeMarkers.set(node.id, marker);
  return marker;
}

// ─── Tutorial ──────────────────────────────────────────────────────────────

let tutorialSlide = 0;
const TUTORIAL_TOTAL = 6;

function maybeShowTutorial() {
  const seen = getPref('tutorialSeen', false);
  if (!seen) showTutorial();
}

function showTutorial() {
  tutorialSlide = 0;
  renderTutorialSlide();
  document.getElementById('modal-tutorial').removeAttribute('hidden');
}

function renderTutorialSlide() {
  const idx = tutorialSlide + 1;
  document.getElementById('tut-title').textContent = t(`tutorialSlide${idx}Title`);
  document.getElementById('tut-body').textContent = t(`tutorialSlide${idx}Body`);
  document.getElementById('tut-progress').textContent = `${idx} / ${TUTORIAL_TOTAL}`;
  document.getElementById('btn-tut-next').textContent =
    tutorialSlide === TUTORIAL_TOTAL - 1 ? t('tutorialDone') : t('tutorialNext');
}

document.getElementById('btn-tut-skip')?.addEventListener('click', () => {
  setPref('tutorialSeen', true);
  closeModal('modal-tutorial');
});

document.getElementById('btn-tut-next')?.addEventListener('click', () => {
  if (tutorialSlide < TUTORIAL_TOTAL - 1) {
    tutorialSlide++;
    renderTutorialSlide();
  } else {
    setPref('tutorialSeen', true);
    closeModal('modal-tutorial');
  }
});

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
    btn.addEventListener('click', () => {
      activeMode = mode.id;
      renderModeTabs();
      renderPresetGrid(activeMode);
    });
    container.appendChild(btn);
  }
}

// ─── Preset grid ───────────────────────────────────────────────────────────

function renderPresetGrid(modeId) {
  renderModeTabs();
  const grid = document.getElementById('preset-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const presets = PRESETS[modeId] || [];
  for (const preset of presets) {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.setAttribute('augmented-ui', 'tl-clip br-clip exe');
    btn.dataset.presetId = preset.id;
    btn.innerHTML = `<span class="preset-icon">${preset.icon}</span><span class="preset-label">${t(preset.labelKey)}</span>`;
    btn.title = t('holdForNote');

    // Tap = instant record // this was duplicating.
    // btn.addEventListener('click', (e) => {
    //   if (e.detail === 0) return; // synthetic click from hold, ignore
    //   recordNode(preset, '', []);
    // });

    // Hold = open note modal
    btn.addEventListener('pointerdown', () => {
      pendingPreset = preset;
      holdTimer = setTimeout(() => {
        holdTimer = null;
        openNoteModal(preset);
      }, 700);
    });

    btn.addEventListener('pointerup', () => {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
        // Short tap: record immediately
        recordNode(preset, '', []);
      }
    });

    btn.addEventListener('pointercancel', () => {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
    });

    grid.appendChild(btn);
  }
}

// ─── Recording ─────────────────────────────────────────────────────────────

function recordNode(preset, note, photos) {
  if (!currentSession) {
    showToast('No active session', 'error');
    return;
  }

  let lat, lon, accuracy;

  if (placementMode === 'crosshair') {
    // Force map to recalculate its size to ensure center is accurate
    // This ensures the geographic center matches the visual crosshair position
    map.invalidateSize();

    // Use map center - getCenter() returns LatLng object with precise coordinates
    const center = map.getCenter();
    // Wrap to ensure we're within valid coordinate bounds
    lat = L.Util.formatNum(center.lat, 6);
    lon = L.Util.formatNum(center.lng, 6);
    accuracy = null; // No GPS accuracy in manual mode

    console.log(`⊕ Recording at crosshair (map center): ${lat}, ${lon}`);
  } else {
    // Use GPS position
    const pos = gps.getCurrentPosition();
    if (!pos) {
      showToast(t('errorGpsTimeout'), 'error');
      return;
    }
    lat = pos.lat;
    lon = pos.lon;
    accuracy = pos.accuracy;

    console.log(`📍 Recording at GPS position: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
  }

  // Merge direction into tags if set
  const tags = { ...preset.tags };
  if (pendingDirection !== null) {
    tags['direction'] = Math.round(pendingDirection);
    // For surveillance cameras, also set camera:direction
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
  });

  console.log(`✅ Node recorded:`, node);

  // Add marker to map
  const marker = addNodeMarker(node);

  // Log marker position to verify
  if (marker) {
    const markerLatLng = marker.getLatLng();
    console.log(
      `📍 Marker placed at: ${markerLatLng.lat.toFixed(6)}, ${markerLatLng.lng.toFixed(6)}`
    );
  }

  // Haptic feedback
  if (navigator.vibrate) navigator.vibrate(60);

  // Clear direction after recording so next point starts fresh
  const savedDir = pendingDirection;
  clearDirection();

  const dirSuffix = savedDir !== null ? ` @ ${Math.round(savedDir)}°` : '';
  const modeLabel = placementMode === 'crosshair' ? ' (manual)' : '';
  showToast(t('nodeRecorded', { label: t(preset.labelKey) }) + dirSuffix + modeLabel, 'success');
  updateNodeCount();
}

// ─── Note modal ────────────────────────────────────────────────────────────

function openNoteModal(preset) {
  pendingPhotos = [];
  document.getElementById('note-preset-label').textContent = t(preset.labelKey);
  document.getElementById('note-input').value = '';
  // Show current pending direction in modal
  const dirField = document.getElementById('note-direction-display');
  if (dirField) {
    dirField.textContent =
      pendingDirection !== null
        ? `${Math.round(pendingDirection)}° ${degreesToCardinal(pendingDirection)}`
        : 'Not set';
    dirField.style.color = pendingDirection !== null ? 'var(--accent)' : 'var(--text-dim)';
  }
  updatePhotoPreview();
  document.getElementById('modal-note').removeAttribute('hidden');
  document.getElementById('note-input').focus();
}

document.getElementById('btn-note-save')?.addEventListener('click', () => {
  const note = document.getElementById('note-input').value.trim();
  if (pendingPreset) recordNode(pendingPreset, note, [...pendingPhotos]);
  pendingPreset = null;
  pendingPhotos = [];
  closeModal('modal-note');
});

document.getElementById('btn-note-cancel')?.addEventListener('click', () => {
  pendingPreset = null;
  pendingPhotos = [];
  closeModal('modal-note');
});

// Set direction from note modal — hides note modal, opens widget, widget closes back
document.getElementById('btn-set-direction')?.addEventListener('click', () => {
  // Hide note modal temporarily (don't fully close — restore after)
  document.getElementById('modal-note').setAttribute('hidden', '');
  directionWidget.open(pendingDirection);
});

// Clear direction button
document.getElementById('btn-clear-direction')?.addEventListener('click', () => {
  clearDirection();
});

// Photo attachment in note modal
document.getElementById('btn-attach-photo')?.addEventListener('click', () => {
  document.getElementById('photo-file-input').click();
});

document.getElementById('photo-file-input')?.addEventListener('change', (e) => {
  const files = Array.from(e.target.files || []);
  for (const file of files) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      pendingPhotos.push(ev.target.result);
      updatePhotoPreview();
    };
    reader.readAsDataURL(file);
  }
  e.target.value = '';
});

function updatePhotoPreview() {
  const el = document.getElementById('photo-count');
  if (el)
    el.textContent = pendingPhotos.length ? t('photoAttached', { count: pendingPhotos.length }) : '';
}

// ─── Standalone direction button (on map overlay) ─────────────────────────

document.getElementById('btn-direction')?.addEventListener('click', () => {
  directionWidget.open(pendingDirection);
});

// ─── Placement mode toggle ────────────────────────────────────────────────

document.getElementById('btn-placement-mode')?.addEventListener('click', () => {
  placementMode = placementMode === 'gps' ? 'crosshair' : 'gps';
  updatePlacementModeButton();
});

function updatePlacementModeButton() {
  const btn = document.getElementById('btn-placement-mode');
  if (!btn) return;

  if (placementMode === 'crosshair') {
    btn.textContent = '⊕';
    btn.title = 'Crosshair mode: place at map center';
    btn.style.color = 'var(--accent2)';
    showCrosshair();
    // Unlock map so user can pan
    if (mapLocked) {
      mapLocked = false;
      updateLockButton();
    }
  } else {
    btn.textContent = '📍';
    btn.title = 'GPS mode: place at current location';
    btn.style.color = 'var(--accent)';
    hideCrosshair();
  }
}

document.getElementById('btn-undo')?.addEventListener('click', () => {
  if (!currentSession) return;
  const removed = removeLastNode(currentSession);
  if (removed) {
    // Remove marker from map
    const marker = nodeMarkers.get(removed.id);
    if (marker) {
      marker.remove();
      nodeMarkers.delete(removed.id);
    }
    showToast('Undone', 'info');
    updateNodeCount();
  }
});

// ─── Map lock ──────────────────────────────────────────────────────────────

document.getElementById('btn-map-lock')?.addEventListener('click', () => {
  mapLocked = !mapLocked;
  updateLockButton();
  if (mapLocked) {
    const pos = gps.getCurrentPosition();
    if (pos) map.setView([pos.lat, pos.lon], map.getZoom());
  }
});

function updateLockButton() {
  const btn = document.getElementById('btn-map-lock');
  if (!btn) return;
  btn.textContent = mapLocked ? '🔒' : '🔓';
  btn.title = mapLocked ? t('mapLocked') : t('mapUnlocked');
}

// ─── GPS toggle ────────────────────────────────────────────────────────────

document.getElementById('btn-gps')?.addEventListener('click', () => {
  gps.toggle();
});

// ─── Export modal ──────────────────────────────────────────────────────────

document.getElementById('btn-export')?.addEventListener('click', () => {
  const info = document.getElementById('export-session-info');
  if (info && currentSession) {
    info.textContent = `${currentSession.nodes.length} nodes`;
  }
  document.getElementById('modal-export').removeAttribute('hidden');
});

['osm', 'gpx', 'geojson'].forEach((fmt) => {
  document.getElementById(`btn-export-${fmt}`)?.addEventListener('click', () => {
    if (!currentSession || !currentSession.nodes.length) {
      showToast(t('exportEmpty'), 'warn');
      return;
    }
    exportSession(currentSession, fmt);
    closeModal('modal-export');
  });
});

document.getElementById('btn-export-close')?.addEventListener('click', () => {
  closeModal('modal-export');
});

// ─── Settings panel ────────────────────────────────────────────────────────

document.getElementById('btn-menu')?.addEventListener('click', () => {
  document.getElementById('panel-settings').removeAttribute('hidden');
});

document.getElementById('btn-settings-close')?.addEventListener('click', () => {
  document.getElementById('panel-settings').setAttribute('hidden', '');
});

// Add manual location input
document.getElementById('btn-settings-location')?.addEventListener('click', () => {
  document.getElementById('panel-settings').setAttribute('hidden', '');
  openManualLocationModal();
});

document.getElementById('btn-settings-tutorial')?.addEventListener('click', () => {
  document.getElementById('panel-settings').setAttribute('hidden', '');
  showTutorial();
});


document.getElementById('btn-settings-export')?.addEventListener('click', () => {
  document.getElementById('panel-settings').setAttribute('hidden', '');
  document.getElementById('btn-export').click();
});

document.getElementById('btn-settings-clear')?.addEventListener('click', () => {
  if (confirm(t('settingsClearConfirm'))) {
    deleteAllSessions();
    currentSession = createSession();
    updateNodeCount();
    showToast('All sessions cleared', 'info');
  }
});

// Language switcher
document.getElementById('select-language')?.addEventListener('change', (e) => {
  setLocale(e.target.value);
  setPref('locale', e.target.value);
  applyAllStrings();
  renderPresetGrid(activeMode);
});

// ─── i18n: apply all strings to DOM ────────────────────────────────────────

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

  // Populate language select
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

  // Storage info
  const storageEl = document.getElementById('storage-used');
  if (storageEl) storageEl.textContent = `${estimateStorageUsedKb()} KB`;
}

// ─── Node list panel ────────────────────────────────────────────────────────

function openNodeList() {
  if (!currentSession) return;
  renderNodeList();
  document.getElementById('panel-nodelist').removeAttribute('hidden');
}

function closeNodeList() {
  document.getElementById('panel-nodelist').setAttribute('hidden', '');
}

document.getElementById('btn-open-nodelist')?.addEventListener('click', () => {
  document.getElementById('panel-settings').setAttribute('hidden', '');
  openNodeList();
});

document.getElementById('btn-nodelist-close')?.addEventListener('click', closeNodeList);

// The ↑ chevron button on the status bar
document.getElementById('btn-statusbar-list')?.addEventListener('click', openNodeList);

function renderNodeList() {
  const container = document.getElementById('nodelist-items');
  if (!container || !currentSession) return;

  const nodes = currentSession.nodes;

  // Header count
  const header = document.getElementById('nodelist-count');
  if (header) header.textContent = `${nodes.length} node${nodes.length !== 1 ? 's' : ''}`;

  // Clear container to prevent duplicates
  container.innerHTML = '';

  if (!nodes.length) {
    container.innerHTML = `<div class="nodelist-empty">No nodes recorded yet in this session.</div>`;
    return;
  }

  // Newest first for review convenience
  const sorted = [...nodes].reverse();

  for (const node of sorted) {
    const el = buildNodeRow(node);
    container.appendChild(el);
  }
}

function buildNodeRow(node) {
  // Derive a display label from tags
  const primaryTag = Object.entries(node.tags)
    .filter(([k]) => k !== 'source')
    .map(([k, v]) => `${k}=${v}`)
    .slice(0, 2)
    .join(' · ');

  // Find the preset icon by matching tags
  const icon = findPresetIcon(node.tags) || '📍';

  const time = new Date(node.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const coords = `${node.lat.toFixed(5)}, ${node.lon.toFixed(5)}`;
  const dirTag = node.tags['direction'] ?? node.tags['camera:direction'];
  const dirStr = dirTag != null ? `${dirTag}° ${degreesToCardinal(Number(dirTag))}` : '';
  const accuracyStr = node.accuracy_m != null ? `±${Math.round(node.accuracy_m)}m` : '';

  const row = document.createElement('div');
  row.className = 'nodelist-row';
  row.dataset.nodeId = node.id;

  row.innerHTML = `
    <div class="nodelist-row-header">
      <span class="nodelist-icon">${icon}</span>
      <div class="nodelist-meta">
        <span class="nodelist-tags">${primaryTag || '(no tags)'}</span>
        <span class="nodelist-sub">${time} · ${coords}${accuracyStr ? ' · ' + accuracyStr : ''}${dirStr ? ' · ⬆ ' + dirStr : ''}</span>
      </div>
      <div class="nodelist-actions">
        <button class="nodelist-btn-edit" data-id="${node.id}" augmented-ui="tl-clip br-clip exe" title="Edit note">✏</button>
        <button class="nodelist-btn-delete" data-id="${node.id}" augmented-ui="tl-clip br-clip exe" title="Delete node">✕</button>
      </div>
    </div>
    ${node.note ? `<div class="nodelist-note">${escHtml(node.note)}</div>` : ''}
  `;

  // Edit note inline
  row.querySelector('.nodelist-btn-edit').addEventListener('click', (e) => {
    e.stopPropagation();
    openNodeEditModal(node);
  });

  // Delete with confirmation
  row.querySelector('.nodelist-btn-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    openNodeDeleteConfirm(node, row);
  });

  // Tap row to pan map to that node
  row.addEventListener('click', () => {
    map.setView([node.lat, node.lon], Math.max(map.getZoom(), 18));
    closeNodeList();
  });

  return row;
}

// ── Node edit modal ──────────────────────────────────────────────────────────

let editingNodeId = null;

function openNodeEditModal(node) {
  editingNodeId = node.id;

  // Populate tag display (read-only for now — full tag editing is JOSM's job)
  const tagList = document.getElementById('nodeedit-tags');
  if (tagList) {
    tagList.innerHTML = Object.entries(node.tags)
      .filter(([k]) => k !== 'source')
      .map(([k, v]) => `<span class="nodeedit-tag"><b>${escHtml(k)}</b>=${escHtml(String(v))}</span>`)
      .join('');
  }

  const coordEl = document.getElementById('nodeedit-coords');
  if (coordEl) coordEl.textContent = `${node.lat.toFixed(6)}, ${node.lon.toFixed(6)}`;

  const noteEl = document.getElementById('nodeedit-note');
  if (noteEl) noteEl.value = node.note || '';

  const timeEl = document.getElementById('nodeedit-time');
  if (timeEl) timeEl.textContent = new Date(node.timestamp).toLocaleString();

  document.getElementById('modal-nodeedit').removeAttribute('hidden');
  noteEl?.focus();
}

document.getElementById('btn-nodeedit-save')?.addEventListener('click', () => {
  if (editingNodeId === null || !currentSession) return;
  const note = document.getElementById('nodeedit-note')?.value.trim() ?? '';
  updateNodeNote(currentSession, editingNodeId, note);
  editingNodeId = null;
  closeModal('modal-nodeedit');
  renderNodeList(); // refresh list
  showToast('Note updated', 'success');
});

document.getElementById('btn-nodeedit-cancel')?.addEventListener('click', () => {
  editingNodeId = null;
  closeModal('modal-nodeedit');
});

// ── Delete confirmation ──────────────────────────────────────────────────────

let deletingNodeId = null;
let deletingRow = null;

function openNodeDeleteConfirm(node, rowEl) {
  deletingNodeId = node.id;
  deletingRow = rowEl;

  // Show what will be deleted
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
    label.textContent = `${primaryTag || 'node'} at ${time}`;
  }

  document.getElementById('modal-nodedelete').removeAttribute('hidden');
}

document.getElementById('btn-nodedelete-confirm')?.addEventListener('click', () => {
  if (deletingNodeId === null || !currentSession) return;
  deleteNodeById(currentSession, deletingNodeId);

  // Remove marker from map
  const marker = nodeMarkers.get(deletingNodeId);
  if (marker) {
    marker.remove();
    nodeMarkers.delete(deletingNodeId);
  }

  deletingRow?.remove();
  updateNodeCount();
  // Update empty state if needed
  const container = document.getElementById('nodelist-items');
  if (container && !container.children.length) {
    container.innerHTML = `<div class="nodelist-empty">No nodes recorded yet in this session.</div>`;
  }
  const header = document.getElementById('nodelist-count');
  if (header)
    header.textContent = `${currentSession.nodes.length} node${currentSession.nodes.length !== 1 ? 's' : ''}`;
  deletingNodeId = null;
  deletingRow = null;
  closeModal('modal-nodedelete');
  showToast('Node deleted', 'warn');
});

document.getElementById('btn-nodedelete-cancel')?.addEventListener('click', () => {
  deletingNodeId = null;
  deletingRow = null;
  closeModal('modal-nodedelete');
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function findPresetIcon(tags) {
  for (const modePresets of Object.values(PRESETS)) {
    for (const preset of modePresets) {
      const match = Object.entries(preset.tags).every(([k, v]) => tags[k] === v);
      if (match) return preset.icon;
    }
  }
  return null;
}

function findPresetByTags(tags) {
  for (const modePresets of Object.values(PRESETS)) {
    for (const preset of modePresets) {
      const match = Object.entries(preset.tags).every(([k, v]) => tags[k] === v);
      if (match) return preset;
    }
  }
  return null;
}

function updateNodeCount() {
  const el = document.getElementById('status-node-count');
  if (el && currentSession) {
    el.textContent = t('nodeCount', { count: currentSession.nodes.length });
  }
}

// ─── Manual Location Modal ─────────────────────────────────────────────────

function openManualLocationModal() {
  // Pre-fill with current map center
  const center = map.getCenter();
  document.getElementById('manual-lat').value = center.lat.toFixed(6);
  document.getElementById('manual-lon').value = center.lng.toFixed(6);
  document.getElementById('modal-manual-location').removeAttribute('hidden');
  document.getElementById('manual-lat').focus();
}

document.getElementById('btn-manual-location-set')?.addEventListener('click', () => {
  const latInput = document.getElementById('manual-lat').value.trim();
  const lonInput = document.getElementById('manual-lon').value.trim();

  const lat = parseFloat(latInput);
  const lon = parseFloat(lonInput);

  if (isNaN(lat) || isNaN(lon)) {
    showToast('Invalid coordinates. Please enter valid numbers.', 'error');
    return;
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    showToast('Coordinates out of range. Lat: -90 to 90, Lon: -180 to 180', 'error');
    return;
  }

  console.log(`📍 Manual location set: ${lat}, ${lon}`);
  map.setView([lat, lon], Math.max(map.getZoom(), 16));

  // Unlock map so user can pan around
  mapLocked = false;
  updateLockButton();

  // Switch to crosshair mode
  placementMode = 'crosshair';
  updatePlacementModeButton();

  closeModal('modal-manual-location');
  showToast(`Map centered at ${lat.toFixed(4)}, ${lon.toFixed(4)}. Use crosshair mode to place nodes.`, 'success');
});

document.getElementById('btn-manual-location-cancel')?.addEventListener('click', () => {
  closeModal('modal-manual-location');
});

// Quick location buttons
document.getElementById('btn-use-current-view')?.addEventListener('click', () => {
  const center = map.getCenter();
  document.getElementById('manual-lat').value = center.lat.toFixed(6);
  document.getElementById('manual-lon').value = center.lng.toFixed(6);
});