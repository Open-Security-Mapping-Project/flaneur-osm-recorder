/**
 * Flaneur OSM Recorder — Direction Picker Integration
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * This file documents the additions needed in main.js and index.html
 * to wire up the direction picker. These are PATCHES to existing files,
 * not standalone code.
 *
 * ════════════════════════════════════════════════════════════════════
 * 1. IMPORT — add to top of src/js/main.js
 * ════════════════════════════════════════════════════════════════════
 */

import { DirectionPicker } from './direction-picker.js';
// Add to the DOMContentLoaded init block:
//   DirectionPicker.init();


/**
 * ════════════════════════════════════════════════════════════════════
 * 2. PRESET METADATA — in presets.js, add supportsDirection flag
 *    to any preset that should offer a "Set Direction" button.
 *    All surveillance and street_lamp presets should have this.
 * ════════════════════════════════════════════════════════════════════
 *
 * Example — add to surveillance presets in presets.js:
 *
 *   {
 *     id: 'survd_fixed_angle',
 *     labelKey: 'presetSurvDetailFixed',
 *     icon: '📹',
 *     supportsDirection: true,      // ← add this flag
 *     tags: { man_made: 'surveillance', ... },
 *   }
 *
 * Presets that benefit from direction:
 *   surveillance_detail: all
 *   surveillance: surv_fixed, surv_ptz
 *   urban: urban_streetlight, urban_camera
 *   power: pow_lamp, pow_floodlight
 */


/**
 * ════════════════════════════════════════════════════════════════════
 * 3. STATE — add to top of main.js state block
 * ════════════════════════════════════════════════════════════════════
 */

let pendingDirection = null; // { deg: number, cardinal: string } | null


/**
 * ════════════════════════════════════════════════════════════════════
 * 4. NOTE MODAL — modifications to openNoteModal() in main.js
 * ════════════════════════════════════════════════════════════════════
 */

function openNoteModal_PATCHED(preset) {
  pendingPhotos    = [];
  pendingDirection = null;

  document.getElementById('note-preset-label').textContent = t(preset.labelKey);
  document.getElementById('note-input').value = '';
  updatePhotoPreview();

  // Show / hide direction button based on preset capability
  const dirRow = document.getElementById('dir-btn-row');
  const dirBtn = document.getElementById('btn-set-direction');
  const dirReadout = document.getElementById('dir-current-readout');

  if (dirRow) {
    const supports = preset.supportsDirection === true;
    dirRow.style.display = supports ? 'flex' : 'none';
  }
  if (dirReadout) dirReadout.textContent = '';

  document.getElementById('modal-note').removeAttribute('hidden');
  document.getElementById('note-input').focus();
}


/**
 * ════════════════════════════════════════════════════════════════════
 * 5. DIRECTION BUTTON HANDLER — add to main.js
 * ════════════════════════════════════════════════════════════════════
 */

document.getElementById('btn-set-direction')?.addEventListener('click', () => {
  const pos = gps.getCurrentPosition();
  DirectionPicker.open({
    lat: pos?.lat ?? null,
    lon: pos?.lon ?? null,
    initialAngle: pendingDirection?.deg ?? null,
    onConfirm({ deg, cardinal }) {
      pendingDirection = { deg, cardinal };
      // Update the inline readout in the note modal
      const el = document.getElementById('dir-current-readout');
      if (el) el.textContent = `${deg}° ${cardinal}`;
    },
  });
});


/**
 * ════════════════════════════════════════════════════════════════════
 * 6. RECORD NODE — patch recordNode() to include direction tag
 * ════════════════════════════════════════════════════════════════════
 *
 * In the existing recordNode(preset, note, photos) function,
 * change the addNode call to include direction in tags:
 */

function recordNode_PATCHED(preset, note, photos) {
  if (!currentSession) { showToast('No active session', 'error'); return; }

  const pos = gps.getCurrentPosition();
  if (!pos) { showToast(t('errorGpsTimeout'), 'error'); return; }

  // Merge direction into tags if set
  const tags = { ...preset.tags };
  if (pendingDirection != null) {
    tags['direction'] = String(pendingDirection.deg);
    // Also store the cardinal as a human-readable note supplement
  }

  const node = addNode(currentSession, {
    lat: pos.lat,
    lon: pos.lon,
    accuracy: pos.accuracy,
    tags,
    note,
    photos,
  });

  // Drop marker with direction indicator
  const iconHtml = pendingDirection
    ? `<span class="node-marker-icon">${preset.icon}</span>
       <span class="node-marker-dir" style="
         position:absolute; bottom:-12px; left:50%; transform:translateX(-50%);
         font-family:'Share Tech Mono',monospace; font-size:9px;
         color:var(--accent,#00ffe5); white-space:nowrap;">
         ${pendingDirection.deg}°${pendingDirection.cardinal}
       </span>`
    : `<span class="node-marker-icon">${preset.icon}</span>`;

  const icon = L.divIcon({
    className: 'node-marker',
    html: iconHtml,
    iconSize: [28, 40],
    iconAnchor: [14, 14],
  });

  const popupContent = [
    `<b>${t(preset.labelKey)}</b>`,
    pendingDirection ? `Direction: ${pendingDirection.deg}° ${pendingDirection.cardinal}` : '',
    note ? note : '',
  ].filter(Boolean).join('<br>');

  L.marker([pos.lat, pos.lon], { icon })
    .bindPopup(popupContent)
    .addTo(map);

  if (navigator.vibrate) navigator.vibrate(60);
  showToast(t('nodeRecorded', { label: t(preset.labelKey) }), 'success');
  updateNodeCount();

  // Reset after recording
  pendingDirection = null;
}


/**
 * ════════════════════════════════════════════════════════════════════
 * 7. HTML ADDITION — note modal direction row (add inside modal-note)
 *    Paste this block AFTER the photo attachment row in index.html
 * ════════════════════════════════════════════════════════════════════
 *
 * <!-- Direction picker row — shown only for direction-capable presets -->
 * <div id="dir-btn-row" class="btn-row" style="display:none; align-items:center; gap:8px; margin-top:8px;">
 *   <button id="btn-set-direction" class="btn-ghost" augmented-ui="tl-clip br-clip exe"
 *     style="display:flex; align-items:center; gap:6px; flex:1;">
 *     <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
 *          stroke="currentColor" stroke-width="2">
 *       <circle cx="12" cy="12" r="10"/>
 *       <line x1="12" y1="2" x2="12" y2="6"/>
 *       <line x1="12" y1="18" x2="12" y2="22"/>
 *       <line x1="2" y1="12" x2="6" y2="12"/>
 *       <line x1="18" y1="12" x2="22" y2="12"/>
 *       <circle cx="12" cy="12" r="2" fill="currentColor"/>
 *     </svg>
 *     Set Direction
 *   </button>
 *   <span id="dir-current-readout"
 *     style="font-family:'Share Tech Mono',monospace; font-size:12px;
 *            color:var(--accent); min-width:80px; text-align:right;">
 *   </span>
 * </div>
 */
