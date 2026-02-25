/**
 * Flaneur OSM Recorder — DirectionPicker Module
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Renders a circular drag widget over an OSM map tile background.
 * User drags outward from center to set a compass bearing.
 *
 * Usage:
 *   import { DirectionPicker } from './direction-picker.js';
 *
 *   // Once, after DOM is ready:
 *   DirectionPicker.init();
 *
 *   // To open (e.g. from note modal "Set Direction" button):
 *   DirectionPicker.open({
 *     lat: currentPos.lat,
 *     lon: currentPos.lon,
 *     initialAngle: node?.tags?.direction ?? null,
 *     onConfirm({ deg, cardinal }) {
 *       // write back to node tags
 *       pendingExtraTags['direction'] = String(deg);
 *     }
 *   });
 *
 * The module manages its own DOM overlay (injected on init).
 * It shares the app's design-token CSS variables.
 */

import L from 'leaflet';

// ── Cardinal direction lookup ──────────────────────────────────────
const CARDINALS = [
  'N','NNE','NE','ENE','E','ESE','SE','SSE',
  'S','SSW','SW','WSW','W','WNW','NW','NNW',
];

export function degreesToCardinal(deg) {
  const normalized = ((deg % 360) + 360) % 360;
  const idx = Math.round(normalized / 22.5) % 16;
  return CARDINALS[idx];
}

export function normalizeAngle(deg) {
  return ((deg % 360) + 360) % 360;
}

// ── SVG layout constants ───────────────────────────────────────────
const SVG_NS  = 'http://www.w3.org/2000/svg';
const CX      = 160;   // SVG viewBox center X
const CY      = 160;   // SVG viewBox center Y
const RING_R  = 130;   // main compass ring radius (SVG units)
const BEAM_R  = 118;   // ray tip radius
const DEAD_R  = 18;    // ignore drags within this radius of center
const HALF_FOV = 20;   // half-angle of field-of-view wedge (degrees)

function polarToXY(angleDeg, r, cx = CX, cy = CY) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// ── DOM injection ──────────────────────────────────────────────────

const OVERLAY_HTML = /* html */`
<div id="dir-overlay" class="dir-overlay" role="dialog" aria-label="Direction picker" aria-modal="true" hidden>
  <div class="dir-widget-wrap">
    <div id="dir-widget">
      <div id="dir-map"></div>
      <svg id="dir-canvas" viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg">
        <circle class="dir-ring-outer" cx="160" cy="160" r="148"/>
        <circle class="dir-ring"       cx="160" cy="160" r="130"/>
        <g id="dir-ticks-minor"></g>
        <g id="dir-ticks-major"></g>
        <g id="dir-beam" style="display:none">
          <path id="dir-wedge" fill="rgba(0,255,229,0.12)" stroke="none"/>
          <line id="dir-ray"
            x1="160" y1="160" x2="160" y2="160"
            stroke="var(--accent,#00ffe5)" stroke-width="2" stroke-linecap="round"
            style="filter:drop-shadow(0 0 4px rgba(0,255,229,0.7))"/>
          <polygon id="dir-arrow"
            fill="var(--accent,#00ffe5)"
            style="filter:drop-shadow(0 0 5px rgba(0,255,229,0.8))"/>
          <circle id="dir-tip" r="5" fill="var(--accent,#00ffe5)"
            style="filter:drop-shadow(0 0 6px rgba(0,255,229,0.9))"/>
        </g>
        <circle class="dir-center-ring" cx="160" cy="160" r="14"/>
        <circle class="dir-center-dot"  cx="160" cy="160" r="7"/>
      </svg>
      <div id="dir-readout" class="dir-readout" aria-live="polite">
        <div class="dir-readout-deg"  id="dir-readout-deg">0°</div>
        <div class="dir-readout-card" id="dir-readout-card">N</div>
      </div>
    </div>

    <div class="dir-btn-row">
      <button id="btn-dir-cancel"  class="dir-btn dir-btn--ghost"  augmented-ui="tl-clip br-clip exe">Cancel</button>
      <button id="btn-dir-confirm" class="dir-btn dir-btn--primary" augmented-ui="tl-clip br-clip exe" disabled>✓ Confirm</button>
    </div>
  </div>
  <div class="dir-backdrop" id="dir-backdrop"></div>
</div>

<div id="dir-save-status" class="dir-save-status" augmented-ui="tl-clip br-clip exe" aria-live="assertive">
  <span class="dir-save-label">SAVING DIRECTION</span>
  <span class="dir-save-value" id="dir-save-value">—</span>
</div>
`;

const OVERLAY_CSS = /* css */`
.dir-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(7,11,20,0.55);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}
.dir-overlay[hidden] { display: none; }

.dir-widget-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  z-index: 1;
}

#dir-widget {
  position: relative;
  width: min(300px, 88vw);
  height: min(300px, 88vw);
  border-radius: 50%;
  overflow: hidden;
  box-shadow:
    0 0 0 1px var(--accent-dim, #00a89a),
    0 0 40px rgba(0,255,229,0.14),
    0 0 0 7px rgba(7,11,20,0.7);
}

#dir-map {
  position: absolute;
  inset: 0;
  width: 100%; height: 100%;
  border-radius: 50%;
  filter: brightness(0.42) saturate(0.55);
  pointer-events: none;
}

#dir-canvas {
  position: absolute;
  inset: 0; width: 100%; height: 100%;
  border-radius: 50%;
  touch-action: none;
  cursor: crosshair;
  overflow: visible;
}

.dir-ring       { fill:none; stroke:rgba(0,255,229,0.15); stroke-width:1; }
.dir-ring-outer { fill:none; stroke:rgba(0,255,229,0.07); stroke-width:1; stroke-dasharray:4 8; }

.dir-cardinal-tick       { stroke:rgba(0,255,229,0.22); stroke-width:1; }
.dir-cardinal-tick-major { stroke:rgba(0,255,229,0.5);  stroke-width:1.5; }
.dir-cardinal-label {
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px; fill:rgba(0,255,229,0.5);
  text-anchor:middle; dominant-baseline:middle;
}
.dir-cardinal-label--nsew {
  font-size: 13px; font-weight:bold; fill:rgba(0,255,229,0.72);
}

.dir-center-dot  { fill: var(--accent,#00ffe5); filter:drop-shadow(0 0 6px rgba(0,255,229,0.8)); }
.dir-center-ring {
  fill:none; stroke:var(--accent,#00ffe5); stroke-width:1.5; opacity:0.35;
  animation: dir-ring-pulse 1.4s ease-in-out infinite;
}
@keyframes dir-ring-pulse {
  0%   { r:14; opacity:0.35; }
  50%  { r:22; opacity:0.08; }
  100% { r:14; opacity:0.35; }
}

.dir-readout {
  position:absolute; bottom:17%; left:50%;
  transform:translateX(-50%);
  text-align:center; pointer-events:none;
  opacity:0; transition:opacity 0.15s;
}
.dir-readout.visible { opacity:1; }
.dir-readout-deg {
  font-family:'Share Tech Mono',monospace;
  font-size: clamp(22px, 8vw, 30px);
  color: var(--accent,#00ffe5); line-height:1;
  text-shadow: 0 0 14px rgba(0,255,229,0.6);
}
.dir-readout-card {
  font-family:'Share Tech Mono',monospace;
  font-size:13px; color:var(--accent-dim,#00a89a);
  letter-spacing:0.1em; margin-top:2px;
}

.dir-btn-row {
  display:flex; gap:10px;
}
.dir-btn {
  font-family:'Share Tech Mono',monospace;
  font-size:11px; letter-spacing:0.12em; text-transform:uppercase;
  padding:8px 20px; border:none; cursor:pointer;
  --aug-tl:7px; --aug-br:7px;
  --aug-border-all:1px;
  transition: background 0.15s, opacity 0.15s;
}
.dir-btn--primary {
  background:rgba(0,255,229,0.1); color:var(--accent,#00ffe5);
  --aug-border-bg: var(--accent,#00ffe5);
}
.dir-btn--primary:hover:not(:disabled) { background:rgba(0,255,229,0.2); }
.dir-btn--primary:disabled { opacity:0.3; cursor:not-allowed; }
.dir-btn--ghost {
  background:transparent; color:var(--text-dim,#607080);
  --aug-border-bg: var(--border,#1a2840);
}
.dir-btn--ghost:hover { color:var(--text,#c8dce8); }

.dir-backdrop {
  position:fixed; inset:0; z-index:-1; cursor:default;
}

/* Save-status flash — upper right */
.dir-save-status {
  position:fixed;
  top: max(14px, env(safe-area-inset-top, 14px));
  right: 14px;
  z-index: 2000;
  font-family:'Share Tech Mono',monospace;
  font-size:11px; letter-spacing:0.08em;
  padding:7px 14px;
  background:var(--bg-modal,#0a0f1c);
  border:1px solid var(--accent-dim,#00a89a);
  color:var(--accent,#00ffe5);
  pointer-events:none;
  opacity:0; transform:translateY(-6px);
  transition:opacity 0.18s, transform 0.18s;
  --aug-tl:6px; --aug-br:6px;
  --aug-border-all:1px; --aug-border-bg:var(--accent-dim,#00a89a);
  line-height:1.6;
}
.dir-save-status.visible { opacity:1; transform:translateY(0); }
.dir-save-label { color:var(--text-dim,#607080); font-size:9px; display:block; letter-spacing:0.15em; margin-bottom:1px; }
.dir-save-value { color:var(--accent,#00ffe5); font-size:15px; font-weight:bold; }
`;

// ── Module state ───────────────────────────────────────────────────

let _initialized = false;
let _leafletMap = null;
let _mapReady = false;
let _currentAngle = null;
let _dragging = false;
let _onConfirm = null;
let _saveStatusTimer = null;

// ── Build SVG tick marks ───────────────────────────────────────────

function buildTicks() {
  const minorGroup = document.getElementById('dir-ticks-minor');
  const majorGroup = document.getElementById('dir-ticks-major');
  if (!minorGroup || !majorGroup) return;

  const majorDefs = [
    { deg: 0,   label: 'N',   nsew: true  },
    { deg: 45,  label: 'NE',  nsew: false },
    { deg: 90,  label: 'E',   nsew: true  },
    { deg: 135, label: 'SE',  nsew: false },
    { deg: 180, label: 'S',   nsew: true  },
    { deg: 225, label: 'SW',  nsew: false },
    { deg: 270, label: 'W',   nsew: true  },
    { deg: 315, label: 'NW',  nsew: false },
  ];

  for (const { deg, label, nsew } of majorDefs) {
    const inner = polarToXY(deg, RING_R - 10);
    const outer = polarToXY(deg, RING_R + 2);
    const tick  = document.createElementNS(SVG_NS, 'line');
    tick.setAttribute('x1', inner.x); tick.setAttribute('y1', inner.y);
    tick.setAttribute('x2', outer.x); tick.setAttribute('y2', outer.y);
    tick.setAttribute('class', 'dir-cardinal-tick-major');
    majorGroup.appendChild(tick);

    const lp = polarToXY(deg, RING_R + 18);
    const txt = document.createElementNS(SVG_NS, 'text');
    txt.setAttribute('x', lp.x);
    txt.setAttribute('y', lp.y);
    txt.setAttribute('class', `dir-cardinal-label${nsew ? ' dir-cardinal-label--nsew' : ''}`);
    txt.textContent = label;
    majorGroup.appendChild(txt);
  }

  for (let d = 0; d < 360; d += 10) {
    if (d % 45 === 0) continue;
    const inner = polarToXY(d, RING_R - 6);
    const outer = polarToXY(d, RING_R);
    const tick  = document.createElementNS(SVG_NS, 'line');
    tick.setAttribute('x1', inner.x); tick.setAttribute('y1', inner.y);
    tick.setAttribute('x2', outer.x); tick.setAttribute('y2', outer.y);
    tick.setAttribute('class', 'dir-cardinal-tick');
    minorGroup.appendChild(tick);
  }
}

// ── Update beam SVG ────────────────────────────────────────────────

function updateBeam(angleDeg) {
  const beam  = document.getElementById('dir-beam');
  const ray   = document.getElementById('dir-ray');
  const arrow = document.getElementById('dir-arrow');
  const tip   = document.getElementById('dir-tip');
  const wedge = document.getElementById('dir-wedge');
  if (!beam) return;

  beam.style.display = 'block';

  const tipPt  = polarToXY(angleDeg, BEAM_R);
  const nearPt = polarToXY(angleDeg, 22);

  ray.setAttribute('x1', nearPt.x); ray.setAttribute('y1', nearPt.y);
  ray.setAttribute('x2', tipPt.x);  ray.setAttribute('y2', tipPt.y);

  // Arrowhead
  const A = 9;
  const rad = (angleDeg - 90) * (Math.PI / 180);
  const ax = tipPt.x, ay = tipPt.y;
  const bx = ax - A * Math.cos(rad) + (A * 0.5) * Math.sin(rad);
  const by = ay - A * Math.sin(rad) - (A * 0.5) * Math.cos(rad);
  const cx = ax - A * Math.cos(rad) - (A * 0.5) * Math.sin(rad);
  const cy = ay - A * Math.sin(rad) + (A * 0.5) * Math.cos(rad);
  arrow.setAttribute('points', `${ax},${ay} ${bx},${by} ${cx},${cy}`);

  tip.setAttribute('cx', tipPt.x);
  tip.setAttribute('cy', tipPt.y);

  // FOV wedge
  const lp = polarToXY(angleDeg - HALF_FOV, RING_R * 0.85);
  const rp = polarToXY(angleDeg + HALF_FOV, RING_R * 0.85);
  wedge.setAttribute('d',
    `M ${CX} ${CY} L ${lp.x} ${lp.y} A ${RING_R * 0.85} ${RING_R * 0.85} 0 0 1 ${rp.x} ${rp.y} Z`
  );
}

// ── Readout update ─────────────────────────────────────────────────

function updateReadout(deg) {
  const rounded  = Math.round(normalizeAngle(deg));
  const cardinal = degreesToCardinal(rounded);
  const readout  = document.getElementById('dir-readout');
  const degEl    = document.getElementById('dir-readout-deg');
  const cardEl   = document.getElementById('dir-readout-card');
  if (!readout) return;
  readout.classList.add('visible');
  degEl.textContent  = `${rounded}°`;
  cardEl.textContent = cardinal;
  updateBeam(deg);
  return { deg: rounded, cardinal };
}

// ── Pointer → SVG coordinate conversion ───────────────────────────

function svgCoords(svg, e) {
  const rect   = svg.getBoundingClientRect();
  const scale  = 320 / rect.width;
  const source = e.touches ? e.touches[0] : e;
  return {
    x: (source.clientX - rect.left) * scale,
    y: (source.clientY - rect.top)  * scale,
  };
}

function angleFromCenter(x, y) {
  const rad = Math.atan2(y - CY, x - CX);
  return normalizeAngle((rad * 180 / Math.PI) + 90);
}

function distFromCenter(x, y) {
  return Math.sqrt((x - CX) ** 2 + (y - CY) ** 2);
}

// ── Leaflet background map ─────────────────────────────────────────

function initLeafletMap(lat, lon) {
  const mapEl = document.getElementById('dir-map');
  if (!mapEl) return;

  if (_leafletMap) {
    _leafletMap.setView([lat ?? 51.505, lon ?? -0.09], 18);
    _leafletMap.invalidateSize();
    return;
  }

  _leafletMap = L.map('dir-map', {
    zoomControl:       false,
    attributionControl:false,
    dragging:          false,
    touchZoom:         false,
    scrollWheelZoom:   false,
    doubleClickZoom:   false,
    keyboard:          false,
    tap:               false,
  }).setView([lat ?? 51.505, lon ?? -0.09], 18);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(_leafletMap);

  _mapReady = true;
}

// ── Flash save status ──────────────────────────────────────────────

function flashSaveStatus(deg, cardinal) {
  const el  = document.getElementById('dir-save-status');
  const val = document.getElementById('dir-save-value');
  if (!el) return;
  val.textContent = `${deg}° ${cardinal}`;
  el.classList.add('visible');
  clearTimeout(_saveStatusTimer);
  _saveStatusTimer = setTimeout(() => el.classList.remove('visible'), 750);
}

// ── Drag event binding ─────────────────────────────────────────────

function bindDrag() {
  const svg     = document.getElementById('dir-canvas');
  const confirm = document.getElementById('btn-dir-confirm');
  if (!svg) return;

  function onDown(e) {
    const { x, y } = svgCoords(svg, e);
    if (distFromCenter(x, y) < DEAD_R) return;
    _dragging    = true;
    _currentAngle = angleFromCenter(x, y);
    updateReadout(_currentAngle);
    e.preventDefault();
  }

  function onMove(e) {
    if (!_dragging) return;
    e.preventDefault();
    const { x, y } = svgCoords(svg, e);
    if (distFromCenter(x, y) < DEAD_R) return;
    _currentAngle = angleFromCenter(x, y);
    updateReadout(_currentAngle);
  }

  function onUp() {
    if (!_dragging) return;
    _dragging = false;
    if (_currentAngle != null && confirm) {
      confirm.removeAttribute('disabled');
    }
  }

  svg.addEventListener('pointerdown',   onDown,  { passive: false });
  svg.addEventListener('pointermove',   onMove,  { passive: false });
  svg.addEventListener('pointerup',     onUp);
  svg.addEventListener('pointercancel', onUp);
  svg.addEventListener('touchstart',    onDown,  { passive: false });
  svg.addEventListener('touchmove',     onMove,  { passive: false });
  svg.addEventListener('touchend',      onUp);
}

function bindButtons() {
  document.getElementById('btn-dir-confirm')?.addEventListener('click', () => {
    if (_currentAngle == null) return;
    const deg      = Math.round(normalizeAngle(_currentAngle));
    const cardinal = degreesToCardinal(deg);
    if (_onConfirm) _onConfirm({ deg, cardinal });
    flashSaveStatus(deg, cardinal);
    close();
  });

  document.getElementById('btn-dir-cancel')?.addEventListener('click', close);
  document.getElementById('dir-backdrop')?.addEventListener('click',   close);
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Call once after DOMContentLoaded. Injects overlay HTML + CSS.
 */
export function init() {
  if (_initialized) return;
  _initialized = true;

  // Inject styles
  const style = document.createElement('style');
  style.textContent = OVERLAY_CSS;
  document.head.appendChild(style);

  // Inject HTML
  const wrapper = document.createElement('div');
  wrapper.innerHTML = OVERLAY_HTML;
  document.body.appendChild(wrapper);

  buildTicks();
  bindDrag();
  bindButtons();
}

/**
 * Open the direction picker.
 * @param {object} opts
 * @param {number|null} opts.lat         — GPS latitude for map centering
 * @param {number|null} opts.lon         — GPS longitude for map centering
 * @param {number|null} opts.initialAngle — pre-existing direction (degrees) or null
 * @param {function}    opts.onConfirm   — called with { deg, cardinal }
 */
export function open({ lat = null, lon = null, initialAngle = null, onConfirm } = {}) {
  _currentAngle = initialAngle;
  _onConfirm    = onConfirm;
  _dragging     = false;

  const overlay  = document.getElementById('dir-overlay');
  const confirm  = document.getElementById('btn-dir-confirm');
  const readout  = document.getElementById('dir-readout');
  const beam     = document.getElementById('dir-beam');

  if (confirm)  confirm.setAttribute('disabled', '');
  if (readout)  readout.classList.remove('visible');
  if (beam)     beam.style.display = 'none';

  if (initialAngle != null) {
    updateReadout(initialAngle);
    if (confirm) confirm.removeAttribute('disabled');
  }

  initLeafletMap(lat, lon);
  setTimeout(() => _leafletMap?.invalidateSize(), 60);

  overlay?.removeAttribute('hidden');
}

export function close() {
  document.getElementById('dir-overlay')?.setAttribute('hidden', '');
  _currentAngle = null;
  _onConfirm    = null;
}

// Named export for convenience
export const DirectionPicker = { init, open, close, degreesToCardinal, normalizeAngle };
