/**
 * Flaneur OSM Recorder — Direction Widget
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * A compass-rose drag widget overlaid on the map layer.
 * User drags from center outward to set a bearing (0-359°).
 * Displays degrees + cardinal direction live as they drag.
 *
 * Usage:
 *   import { DirectionWidget } from './direction-widget.js';
 *   const widget = new DirectionWidget({
 *     onConfirm: (degrees) => { ... },
 *     onCancel:  ()        => { ... },
 *   });
 *   widget.open();   // show over map
 *   widget.close();  // hide
 */

// Cardinal / intercardinal label from degrees (0=N, 90=E, 180=S, 270=W)
export function degreesToCardinal(deg) {
  const d = ((deg % 360) + 360) % 360;
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE',
                'S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const idx = Math.round(d / 22.5) % 16;
  return dirs[idx];
}

export class DirectionWidget {
  /**
   * @param {{ onConfirm: (deg: number) => void, onCancel: () => void }} opts
   */
  constructor({ onConfirm, onCancel }) {
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;

    this._deg = null; // null = no direction set yet
    this._dragging = false;
    this._el = null; // overlay DOM element
    this._svg = null;

    this._build();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  open(initialDeg = null) {
    this._deg = initialDeg;
    this._render(initialDeg);
    this._el.removeAttribute('hidden');
    // Prevent map interaction while widget is open
    this._el.style.pointerEvents = 'all';
    this._el.style.display = 'flex';
  }

  close() {
    this._el.setAttribute('hidden', '');
    this._el.style.pointerEvents = 'none';
    this._el.style.display = 'none';
  }

  getCurrentDegrees() {
    return this._deg;
  }

  // ── Build DOM ──────────────────────────────────────────────────────────────

  _build() {
    const el = document.createElement('div');
    el.id = 'direction-widget';
    el.setAttribute('hidden', '');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Set direction');
    // Make sure it's hidden by default
    el.style.display = 'none';
    // Removed inline styles - now in direction-widget.css

    // SVG canvas — sized via CSS, intrinsic 300×300
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 300 300');
    svg.setAttribute('width', '300');
    svg.setAttribute('height', '300');
    // Removed inline styles - now in direction-widget.css

    svg.innerHTML = this._svgContent();
    el.appendChild(svg);

    // Degree + cardinal readout below the circle
    const readout = document.createElement('div');
    readout.id = 'dir-readout';
    // Removed inline styles - now in direction-widget.css
    readout.textContent = '— °  —';
    el.appendChild(readout);

    // Action buttons row
    const btnRow = document.createElement('div');
    btnRow.style.cssText = [
      'position: absolute',
      'bottom: calc(50% - 230px)',
      'left: 50%',
      'transform: translateX(-50%)',
      'display: flex',
      'gap: 12px',
      'pointer-events: all',
    ].join(';');

    const cancelBtn = this._makeBtn('Cancel', 'ghost');
    const confirmBtn = this._makeBtn('Set Direction ✓', 'primary');
    confirmBtn.id = 'dir-confirm-btn';

    cancelBtn.addEventListener('click', () => {
      this.close();
      this.onCancel();
    });
    confirmBtn.addEventListener('click', () => {
      if (this._deg !== null) {
        this.close();
        this.onConfirm(this._deg);
      }
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(confirmBtn);
    el.appendChild(btnRow);

    // Attach pointer events to SVG
    this._attachPointerEvents(svg);

    // Mount inside map-wrap so it sits over the map
    document.getElementById('map-wrap')?.appendChild(el) ?? document.body.appendChild(el);

    this._el = el;
    this._svg = svg;
  }

  _svgContent() {
    // Static SVG elements. The dynamic arrow/line are rendered via _render().
    return `
      <!-- Outer ring -->
      <circle cx="150" cy="150" r="138"
        fill="none" stroke="rgba(0,255,229,0.18)" stroke-width="1.5"/>

      <!-- Tick marks: major every 45°, minor every 15° -->
      ${this._ticks()}

      <!-- Cardinal labels -->
      ${this._cardinalLabels()}

      <!-- Centre reticle rings -->
      <circle cx="150" cy="150" r="54"
        fill="rgba(0,255,229,0.04)" stroke="rgba(0,255,229,0.25)" stroke-width="1"/>
      <circle cx="150" cy="150" r="6"
        fill="var(--accent, #00ffe5)" opacity="0.9"/>
      <circle cx="150" cy="150" r="18"
        fill="none" stroke="rgba(0,255,229,0.35)" stroke-width="1"
        stroke-dasharray="4 4"/>

      <!-- Drag hint text (hidden once dragging starts) -->
      <text id="dir-drag-hint" x="150" y="162"
        text-anchor="middle" font-family="Share Tech Mono, monospace"
        font-size="10" fill="rgba(0,255,229,0.45)" letter-spacing="0.05em">
        DRAG TO SET
      </text>

      <!-- Dynamic group: arrow + readout arc (updated by _render) -->
      <g id="dir-dynamic"></g>
    `;
  }

  _ticks() {
    const lines = [];
    for (let a = 0; a < 360; a += 15) {
      const isMajor = a % 45 === 0;
      const inner = isMajor ? 118 : 126;
      const outer = 138;
      const rad = ((a - 90) * Math.PI) / 180;
      const x1 = 150 + inner * Math.cos(rad);
      const y1 = 150 + inner * Math.sin(rad);
      const x2 = 150 + outer * Math.cos(rad);
      const y2 = 150 + outer * Math.sin(rad);
      const stroke = isMajor ? 'rgba(0,255,229,0.55)' : 'rgba(0,255,229,0.2)';
      const w = isMajor ? 1.5 : 0.75;
      lines.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}"
        x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
        stroke="${stroke}" stroke-width="${w}"/>`);
    }
    return lines.join('\n');
  }

  _cardinalLabels() {
    const cards = [
      { label: 'N', deg: 0, color: '#ff3c6e' },
      { label: 'E', deg: 90, color: 'rgba(0,255,229,0.7)' },
      { label: 'S', deg: 180, color: 'rgba(0,255,229,0.7)' },
      { label: 'W', deg: 270, color: 'rgba(0,255,229,0.7)' },
    ];
    return cards
      .map(({ label, deg, color }) => {
        const rad = ((deg - 90) * Math.PI) / 180;
        const r = 106;
        const x = (150 + r * Math.cos(rad)).toFixed(1);
        const y = (150 + r * Math.sin(rad) + 4).toFixed(1); // +4 for text baseline
        return `<text x="${x}" y="${y}" text-anchor="middle"
        font-family="Share Tech Mono, monospace" font-size="13"
        font-weight="bold" fill="${color}" letter-spacing="0.05em">${label}</text>`;
      })
      .join('\n');
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  _render(deg) {
    const dynGroup = this._svg?.querySelector('#dir-dynamic');
    const hint = this._svg?.querySelector('#dir-drag-hint');
    const readout = this._el?.querySelector('#dir-readout');
    if (!dynGroup) return;

    if (deg === null) {
      dynGroup.innerHTML = '';
      if (readout) readout.textContent = '— °  —';
      if (hint) hint.style.display = '';
      return;
    }

    if (hint) hint.style.display = 'none';

    const rad = ((deg - 90) * Math.PI) / 180;
    const cx = 150,
      cy = 150;
    const tipR = 128; // arrowhead tip radius
    const tailR = 20; // tail start radius

    const tipX = cx + tipR * Math.cos(rad);
    const tipY = cy + tipR * Math.sin(rad);
    const tailX = cx + tailR * Math.cos(rad + Math.PI);
    const tailY = cy + tailR * Math.sin(rad + Math.PI);

    // Arrowhead: two side lines
    const headLen = 16;
    const headAngle = 0.42; // radians
    const h1x = tipX + headLen * Math.cos(rad + Math.PI - headAngle);
    const h1y = tipY + headLen * Math.sin(rad + Math.PI - headAngle);
    const h2x = tipX + headLen * Math.cos(rad + Math.PI + headAngle);
    const h2y = tipY + headLen * Math.sin(rad + Math.PI + headAngle);

    // Sector/arc fill to visually indicate the direction slice
    const arcR = 52;
    const startRad = -Math.PI / 2; // 12 o'clock
    const arcStartX = cx + arcR * Math.cos(startRad);
    const arcStartY = cy + arcR * Math.sin(startRad);
    const arcEndX = cx + arcR * Math.cos(rad);
    const arcEndY = cy + arcR * Math.sin(rad);
    const largeArc = deg > 180 ? 1 : 0;

    dynGroup.innerHTML = `
      <!-- Direction sector fill -->
      <path d="M ${cx} ${cy}
               L ${arcStartX.toFixed(2)} ${arcStartY.toFixed(2)}
               A ${arcR} ${arcR} 0 ${largeArc} 1
               ${arcEndX.toFixed(2)} ${arcEndY.toFixed(2)} Z"
        fill="rgba(0,255,229,0.12)" stroke="none"/>

      <!-- Direction line with glow -->
      <line x1="${tailX.toFixed(2)}" y1="${tailY.toFixed(2)}"
            x2="${tipX.toFixed(2)}"  y2="${tipY.toFixed(2)}"
        stroke="rgba(0,255,229,0.3)" stroke-width="6" stroke-linecap="round"/>
      <line x1="${tailX.toFixed(2)}" y1="${tailY.toFixed(2)}"
            x2="${tipX.toFixed(2)}"  y2="${tipY.toFixed(2)}"
        stroke="#00ffe5" stroke-width="2.5" stroke-linecap="round"/>

      <!-- Arrowhead -->
      <line x1="${tipX.toFixed(2)}" y1="${tipY.toFixed(2)}"
            x2="${h1x.toFixed(2)}"  y2="${h1y.toFixed(2)}"
        stroke="#00ffe5" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="${tipX.toFixed(2)}" y1="${tipY.toFixed(2)}"
            x2="${h2x.toFixed(2)}"  y2="${h2y.toFixed(2)}"
        stroke="#00ffe5" stroke-width="2.5" stroke-linecap="round"/>

      <!-- Tip dot -->
      <circle cx="${tipX.toFixed(2)}" cy="${tipY.toFixed(2)}" r="4"
        fill="#00ffe5" opacity="0.9"/>
    `;

    if (readout) {
      const cardinal = degreesToCardinal(deg);
      readout.textContent = `${Math.round(deg)}°  ${cardinal}`;
    }

    // Update confirm button appearance
    const confirmBtn = this._el?.querySelector('#dir-confirm-btn');
    if (confirmBtn) {
      confirmBtn.style.opacity = '1';
      confirmBtn.style.pointerEvents = 'all';
    }
  }

  // ── Pointer events ─────────────────────────────────────────────────────────

  _attachPointerEvents(svg) {
    const getAngle = (e) => {
      const rect = svg.getBoundingClientRect();
      // SVG intrinsic is 300×300, scale to actual rendered size
      const scaleX = 300 / rect.width;
      const scaleY = 300 / rect.height;
      const x = (e.clientX - rect.left) * scaleX - 150;
      const y = (e.clientY - rect.top) * scaleY - 150;
      // Only register a direction if drag is at least 12px from center
      if (Math.hypot(x, y) < 12) return null;
      let deg = (Math.atan2(y, x) * 180) / Math.PI + 90;
      if (deg < 0) deg += 360;
      return Math.round(deg) % 360;
    };

    svg.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      svg.setPointerCapture(e.pointerId);
      this._dragging = true;
      const deg = getAngle(e);
      if (deg !== null) {
        this._deg = deg;
        this._render(deg);
      }
    });

    svg.addEventListener('pointermove', (e) => {
      if (!this._dragging) return;
      e.preventDefault();
      const deg = getAngle(e);
      if (deg !== null) {
        this._deg = deg;
        this._render(deg);
      }
    });

    svg.addEventListener('pointerup', (e) => {
      this._dragging = false;
      svg.releasePointerCapture(e.pointerId);
    });

    svg.addEventListener('pointercancel', () => {
      this._dragging = false;
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _makeBtn(label, variant) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.className = `btn-${variant}`;
    btn.setAttribute('augmented-ui', 'tl-clip br-clip exe');
    btn.style.cssText = [
      'font-family: "Share Tech Mono", monospace',
      'font-size: 12px',
      'letter-spacing: 0.08em',
      'text-transform: uppercase',
      'padding: 8px 18px',
      'border: none',
      'cursor: pointer',
      '--aug-tl: 7px',
      '--aug-br: 7px',
      '--aug-border-all: 1px',
    ].join(';');

    if (variant === 'primary') {
      btn.style.cssText += [
        ';background: rgba(0,255,229,0.14)',
        'color: var(--accent, #00ffe5)',
        '--aug-border-bg: var(--accent, #00ffe5)',
        'opacity: 0.5',
      ].join(';');
    } else {
      btn.style.cssText += [
        ';background: transparent',
        'color: var(--text-dim, #607080)',
        '--aug-border-bg: var(--border, #1a2840)',
      ].join(';');
    }
    return btn;
  }
}
