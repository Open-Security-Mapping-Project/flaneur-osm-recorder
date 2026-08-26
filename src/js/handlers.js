/**
 * Flaneur OSM Recorder — Static Event Handler Registration
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Every addEventListener for an element present in index.html at load time
 * lives here, bound to a named `on*` function. No business logic in this file:
 * each handler delegates to an action exported by main.js.
 *
 * Listeners for dynamically created elements (mode tabs, preset buttons, node
 * list rows) stay in the function that creates the element — see main.js.
 */

import {
  startNewSession,
  appendToLastSession,
  newSessionFromSettings,
  dismissTutorial,
  advanceTutorial,
  showTutorial,
  saveNote,
  cancelNote,
  openDirectionFromNote,
  clearDirection,
  toggleDirectionWidget,
  openPhotoPicker,
  addPhotoFiles,
  togglePlacementMode,
  undoLastNode,
  toggleMapLock,
  toggleGps,
  openExportModal,
  exportAs,
  setExportScope,
  openSettings,
  closeSettings,
  clearAllSessions,
  changeLanguage,
  toggleSound,
  handleViewportResize,
  openNodeList,
  closeNodeList,
  saveNodeEdit,
  cancelNodeEdit,
  confirmNodeDelete,
  cancelNodeDelete,
  openManualLocationModal,
  applyManualLocation,
  cancelManualLocation,
  fillManualLocationFromMap,
  dismissTopLayer,
} from './main.js';
import { closeModal } from './ui-utils.js';

const EXPORT_FORMATS = ['osm', 'gpx', 'geojson'];

/** Bind `fn` to `event` on the element with `id`, if it exists. */
function bind(id, event, fn) {
  document.getElementById(id)?.addEventListener(event, fn);
}

// ─── Session modal ─────────────────────────────────────────────────────────

function onSessionNew() {
  startNewSession();
}

function onSessionAppend() {
  appendToLastSession();
}

/**
 * Opens the tutorial over the session modal without choosing a session.
 * modal-tutorial follows modal-session in the document, so it stacks on top;
 * closing it reveals the still-open session choice underneath.
 */
function onSessionTutorial() {
  showTutorial();
}

// ─── Tutorial ──────────────────────────────────────────────────────────────

function onTutorialSkip() {
  dismissTutorial();
}

function onTutorialNext() {
  advanceTutorial();
}

// ─── Note modal ────────────────────────────────────────────────────────────

function onNoteSave() {
  saveNote();
}

function onNoteCancel() {
  cancelNote();
}

function onSetDirection() {
  openDirectionFromNote();
}

function onClearDirection() {
  clearDirection();
}

function onAttachPhoto() {
  openPhotoPicker();
}

function onPhotoFileChange(e) {
  addPhotoFiles(e.target.files);
  e.target.value = ''; // allow re-picking the same file
}

// ─── Map overlay ───────────────────────────────────────────────────────────

function onDirectionToggle() {
  toggleDirectionWidget();
}

function onPlacementModeToggle() {
  togglePlacementMode();
}

function onUndo() {
  undoLastNode();
}

function onMapLockToggle() {
  toggleMapLock();
}

function onGpsToggle() {
  toggleGps();
}

// ─── Export ────────────────────────────────────────────────────────────────

function onExportOpen() {
  openExportModal();
}

function onExportClose() {
  closeModal('modal-export');
}

function onExportScopeSession() {
  setExportScope('session');
}

function onExportScopeAll() {
  setExportScope('all');
}

// ─── Settings ──────────────────────────────────────────────────────────────

function onMenuOpen() {
  openSettings();
}

function onSettingsClose() {
  closeSettings();
}

function onSettingsLocation() {
  openManualLocationModal();
}

function onSettingsTutorial() {
  closeSettings();
  showTutorial();
}

function onSettingsExport() {
  closeSettings();
  openExportModal();
}

function onSettingsNewSession() {
  newSessionFromSettings();
}

function onSettingsClear() {
  clearAllSessions();
}

function onSoundToggle() {
  toggleSound();
}

function onWindowResize() {
  handleViewportResize();
}

/**
 * Escape backs out of whatever is on top — the direction wheel or any open
 * modal or panel — with the same effect as that layer's own cancel.
 */
function onDocumentKeydown(e) {
  if (e.key !== 'Escape') return;
  if (dismissTopLayer()) e.preventDefault();
}

function onLanguageChange(e) {
  changeLanguage(e.target.value);
}

// ─── Node list ─────────────────────────────────────────────────────────────

function onNodeListOpen() {
  openNodeList();
}

function onNodeListClose() {
  closeNodeList();
}

function onNodeEditSave() {
  saveNodeEdit();
}

function onNodeEditCancel() {
  cancelNodeEdit();
}

function onNodeDeleteConfirm() {
  confirmNodeDelete();
}

function onNodeDeleteCancel() {
  cancelNodeDelete();
}

// ─── Manual location ───────────────────────────────────────────────────────

function onManualLocationSet() {
  applyManualLocation();
}

function onManualLocationCancel() {
  cancelManualLocation();
}

function onUseCurrentView() {
  fillManualLocationFromMap();
}

// ─── Registration ──────────────────────────────────────────────────────────

/**
 * Wire every static element. Called once from main.js after DOMContentLoaded.
 */
export function registerHandlers() {
  // Session modal
  bind('btn-session-new', 'click', onSessionNew);
  bind('btn-session-append', 'click', onSessionAppend);
  bind('btn-session-tutorial', 'click', onSessionTutorial);

  // Tutorial
  bind('btn-tut-skip', 'click', onTutorialSkip);
  bind('btn-tut-next', 'click', onTutorialNext);

  // Note modal
  bind('btn-note-save', 'click', onNoteSave);
  bind('btn-note-cancel', 'click', onNoteCancel);
  bind('btn-set-direction', 'click', onSetDirection);
  bind('btn-clear-direction', 'click', onClearDirection);
  bind('btn-attach-photo', 'click', onAttachPhoto);
  bind('photo-file-input', 'change', onPhotoFileChange);

  // Map overlay
  bind('btn-direction', 'click', onDirectionToggle);
  bind('btn-placement-mode', 'click', onPlacementModeToggle);
  bind('btn-undo', 'click', onUndo);
  bind('btn-map-lock', 'click', onMapLockToggle);
  bind('btn-gps', 'click', onGpsToggle);

  // Export
  bind('btn-export', 'click', onExportOpen);
  bind('btn-export-scope-session', 'click', onExportScopeSession);
  bind('btn-export-scope-all', 'click', onExportScopeAll);
  bind('btn-export-close', 'click', onExportClose);
  for (const fmt of EXPORT_FORMATS) {
    // Arrow closes over `fmt`; exportAs holds the logic.
    bind(`btn-export-${fmt}`, 'click', () => exportAs(fmt));
  }

  // Settings
  bind('btn-menu', 'click', onMenuOpen);
  bind('btn-settings-close', 'click', onSettingsClose);
  bind('btn-settings-location', 'click', onSettingsLocation);
  bind('btn-settings-tutorial', 'click', onSettingsTutorial);
  bind('btn-settings-export', 'click', onSettingsExport);
  bind('btn-settings-newsession', 'click', onSettingsNewSession);
  bind('btn-settings-clear', 'click', onSettingsClear);
  bind('btn-settings-sound', 'click', onSoundToggle);
  bind('select-language', 'change', onLanguageChange);

  // Escape backs out of the topmost open layer.
  document.addEventListener('keydown', onDocumentKeydown);

  // Viewport changes (phone URL bar collapsing, rotation) resize the map
  // container without Leaflet noticing.
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('orientationchange', onWindowResize);

  // Node list
  bind('btn-open-nodelist', 'click', onNodeListOpen);
  bind('btn-statusbar-list', 'click', onNodeListOpen);
  bind('btn-nodelist-close', 'click', onNodeListClose);
  bind('btn-nodelist-close-x', 'click', onNodeListClose);
  bind('btn-nodeedit-save', 'click', onNodeEditSave);
  bind('btn-nodeedit-cancel', 'click', onNodeEditCancel);
  bind('btn-nodedelete-confirm', 'click', onNodeDeleteConfirm);
  bind('btn-nodedelete-cancel', 'click', onNodeDeleteCancel);

  // Manual location
  bind('btn-manual-location-set', 'click', onManualLocationSet);
  bind('btn-manual-location-cancel', 'click', onManualLocationCancel);
  bind('btn-use-current-view', 'click', onUseCurrentView);
}
