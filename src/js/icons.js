/**
 * Flaneur OSM Recorder — Icon sprite
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Turns the SVG files in src/icons/ into one inline `<symbol>` sprite and
 * hands out `<use>` references to it.
 *
 * Why a sprite and not 66 <img> tags: the icons must work offline on first
 * paint, must recolour from CSS (`color:`), and must not cost 66 requests on
 * a phone. Inlining them once and referencing by id gives all three.
 *
 * The icons are read at BUILD time via import.meta.glob(...?raw), so the whole
 * set is bundled — there is no runtime fetch and nothing to cache. Adding an
 * SVG to src/icons/<set>/ is all it takes to make a new ref resolvable; see
 * src/icons/icon-sources.json for the provenance rules that go with it.
 *
 * Module boundary: this file returns MARKUP STRINGS. It never touches the
 * document — main.js owns the DOM and is what injects the sprite.
 */

import '../css/icons.css';

import { FALLBACK_ICON } from './presets.js';

// Vite inlines every match as a raw string at build time.
const rawFiles = import.meta.glob('../icons/*/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/**
 * `set:id` → inner SVG markup, with the document wrapper and any authoring
 * metadata removed. <title> in particular has to go: these end up inside
 * buttons that already carry a visible label, and a <title> would make a
 * screen reader announce the thing twice.
 */
const ICON_BODIES = buildBodies();

function buildBodies() {
  const bodies = {};

  for (const [path, source] of Object.entries(rawFiles)) {
    const match = path.match(/\/icons\/([^/]+)\/([^/]+)\.svg$/);
    if (!match) continue;
    const ref = `${match[1]}:${match[2]}`;

    const open = source.indexOf('<svg');
    const gt = source.indexOf('>', open);
    const close = source.lastIndexOf('</svg>');
    if (open === -1 || gt === -1 || close === -1) continue;

    bodies[ref] = source
      .slice(gt + 1, close)
      .replace(/<title\b[^>]*>[\s\S]*?<\/title>/g, '')
      .replace(/<desc\b[^>]*>[\s\S]*?<\/desc>/g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim();
  }

  return bodies;
}

/** Every ref the sprite can draw, sorted. Used by the icon audit test. */
export function availableIcons() {
  return Object.keys(ICON_BODIES).sort();
}

export function hasIcon(ref) {
  return Object.hasOwn(ICON_BODIES, ref);
}

/** DOM id for a ref. `:` is legal in an id but miserable in a CSS selector. */
function symbolId(ref) {
  return `ico-${ref.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

/**
 * The whole sprite as one hidden <svg> of <symbol>s, ready to be injected once
 * at startup. Every icon is normalised to a 24x24 viewBox by the vendoring
 * script, so the symbols can share one.
 */
export function iconSpriteMarkup() {
  const symbols = Object.entries(ICON_BODIES)
    .map(([ref, body]) => `<symbol id="${symbolId(ref)}" viewBox="0 0 24 24">${body}</symbol>`)
    .join('');

  return `<svg id="icon-sprite" aria-hidden="true" focusable="false">${symbols}</svg>`;
}

/**
 * A plated icon: `<span class="icon-tile">` wrapping an `<svg><use>`.
 *
 * The plate is not decoration. These icons are single-colour silhouettes with
 * no background of their own, and the app's own background is near-black — a
 * dark-bodied glyph dropped straight onto it is invisible. The plate supplies
 * the contrast, and `.icon-tile--invert` flips the polarity for a
 * light-bodied icon. See src/css/icons.css.
 *
 * Colour is left entirely to CSS `color:`. Several of the custom surveillance
 * icons stroke as well as fill, so styling `fill:` alone would leave the
 * thermal heat-waves and the acoustic arcs uncoloured.
 *
 * Decorative by default: these sit beside a visible text label almost
 * everywhere, so announcing them would just be noise. Pass `label` for the
 * few places where the icon stands alone (the map marker).
 *
 * @param {string} ref        `set:id`, e.g. 'temaki:bench'
 * @param {object} [opts]
 * @param {string} [opts.className] extra classes on the plate
 * @param {string} [opts.label]     accessible name; omit to mark it decorative
 * @returns {string} markup, safe to drop into innerHTML
 */
export function iconMarkup(ref, { className = '', label } = {}) {
  const resolved = hasIcon(ref) ? ref : FALLBACK_ICON;
  const classes = `icon-tile ${className}`.trim();
  const a11y = label ? ` role="img" aria-label="${escapeAttr(label)}"` : ' aria-hidden="true"';

  return (
    `<span class="${escapeAttr(classes)}"${a11y}>` +
    `<svg class="icon" aria-hidden="true" focusable="false">` +
    `<use href="#${symbolId(resolved)}"></use>` +
    `</svg></span>`
  );
}

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
