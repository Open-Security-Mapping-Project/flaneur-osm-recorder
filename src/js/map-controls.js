/**
 * Map control buttons: lock, undo, placement mode, crosshair
 *
 * TODO WIP. this is not fully extracted yet. It is not referenced in Main.js
 */
import { showToast } from './ui-utils.js';
import { t } from './i18n.js';

let mapLocked = true;
let placementMode = 'gps'; // 'gps' or 'crosshair'

export function getMapLocked() {
  return mapLocked;
}

export function setMapLocked(locked) {
  mapLocked = locked;
}

export function getPlacementMode() {
  return placementMode;
}

export function togglePlacementMode() {
  placementMode = placementMode === 'gps' ? 'crosshair' : 'gps';
  updatePlacementModeButton();
  return placementMode;
}

export function createCrosshair() {
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

export function showCrosshair() {
  const el = document.getElementById('map-crosshair');
  if (el) el.style.display = 'block';
}

export function hideCrosshair() {
  const el = document.getElementById('map-crosshair');
  if (el) el.style.display = 'none';
}

export function initMapControls(
  map,
  gps,
  currentSession,
  removeLastNode,
  updateNodeCount,
  nodeMarkers
) {
  // Map lock button
  document.getElementById('btn-map-lock')?.addEventListener('click', () => {
    mapLocked = !mapLocked;
    updateLockButton();
    if (mapLocked) {
      const pos = gps.getCurrentPosition();
      if (pos) map.setView([pos.lat, pos.lon], map.getZoom());
    }
  });

  // Undo button
  document.getElementById('btn-undo')?.addEventListener('click', () => {
    if (!currentSession) return;
    const removed = removeLastNode(currentSession);
    if (removed) {
      const marker = nodeMarkers.get(removed.id);
      if (marker) {
        marker.remove();
        nodeMarkers.delete(removed.id);
      }
      showToast('Undone', 'info');
      updateNodeCount();
    }
  });

  // Placement mode toggle
  document.getElementById('btn-placement-mode')?.addEventListener('click', () => {
    togglePlacementMode();
  });
}

function updateLockButton() {
  const btn = document.getElementById('btn-map-lock');
  if (!btn) return;
  btn.textContent = mapLocked ? '🔒' : '🔓';
  btn.title = mapLocked ? t('mapLocked') : t('mapUnlocked');
}

function updatePlacementModeButton() {
  const btn = document.getElementById('btn-placement-mode');
  if (!btn) return;

  if (placementMode === 'crosshair') {
    btn.textContent = '⊕';
    btn.title = 'Crosshair mode: place at map center';
    btn.style.color = 'var(--accent2)';
    showCrosshair();
  } else {
    btn.textContent = '📍';
    btn.title = 'GPS mode: place at current location';
    btn.style.color = 'var(--accent)';
    hideCrosshair();
  }
}
