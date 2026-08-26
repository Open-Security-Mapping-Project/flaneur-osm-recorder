/**
 * Flaneur OSM Recorder — Sound Effects
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Short UI sounds synthesized with the Web Audio API.
 *
 * Why synthesis rather than sample files (e.g. from opengameart.org):
 *   - No new dependency and no binary assets. CLAUDE.md asks us to prefer Web
 *     APIs over added weight, and REQUIREMENTS.md R2.3 limits outbound requests.
 *   - Nothing extra to precache, so offline behavior is unchanged.
 *   - No third-party license or attribution to track in a GPL project.
 *   - A few hundred bytes of code instead of a few hundred KB of audio.
 *
 * No DOM access — this module is pure logic, driven by main.js.
 */

let ctx = null;
let enabled = false;
let lastTickAt = 0;

/** Detent ticks closer together than this are dropped, in milliseconds. */
const TICK_MIN_INTERVAL_MS = 28;

/**
 * Browsers only allow an AudioContext to start inside a user gesture, so this
 * is called lazily from the first sound a real interaction produces.
 * Returns null when audio is unavailable or disabled.
 */
function audio() {
  if (!enabled) return null;

  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }

  // Safari and Chrome park the context until a gesture resumes it.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/**
 * Short filtered noise burst — the body of a mechanical click.
 * @param {AudioContext} ac
 * @param {number} duration seconds
 * @param {number} gain peak amplitude
 * @param {number} cutoff bandpass center in Hz
 */
function noiseBurst(ac, duration, gain, cutoff) {
  const frames = Math.max(1, Math.floor(ac.sampleRate * duration));
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);

  // Exponentially decaying white noise: the decay is what stops it reading as
  // a harsh "sh" and makes it a click instead.
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 3);
  }

  const src = ac.createBufferSource();
  src.buffer = buffer;

  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = cutoff;
  band.Q.value = 0.8;

  const amp = ac.createGain();
  amp.gain.setValueAtTime(gain, ac.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);

  src.connect(band).connect(amp).connect(ac.destination);
  src.start();
  src.stop(ac.currentTime + duration);
}

/**
 * Confirmation click for a recorded node.
 * A noise transient plus a low sine thump, so it reads as a definite "captured"
 * rather than a UI blip.
 */
export function playRecordClick() {
  const ac = audio();
  if (!ac) return;

  noiseBurst(ac, 0.035, 0.22, 2200);

  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(320, ac.currentTime + 0.06);
  amp.gain.setValueAtTime(0.16, ac.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.07);

  osc.connect(amp).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 0.08);
}

/**
 * One detent of the compass dial — the "clickety" of dragging the bearing.
 *
 * Deliberately quiet, brief and slightly randomized: identical repeated ticks
 * sound synthetic and grating, while small pitch variation reads as a physical
 * ratchet. Rate-limited so a fast drag cannot machine-gun the output.
 */
export function playDragTick() {
  const ac = audio();
  if (!ac) return;

  const now = Date.now();
  if (now - lastTickAt < TICK_MIN_INTERVAL_MS) return;
  lastTickAt = now;

  noiseBurst(ac, 0.012, 0.05, 1500 + Math.random() * 900);
}

/** Soft confirmation used when the sound toggle is switched on. */
export function playToggleBlip() {
  const ac = audio();
  if (!ac) return;

  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(520, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(780, ac.currentTime + 0.08);
  amp.gain.setValueAtTime(0.12, ac.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.1);

  osc.connect(amp).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 0.11);
}

export function setSoundEnabled(on) {
  enabled = !!on;
  if (!enabled && ctx) {
    ctx.close().catch(() => {});
    ctx = null;
  }
}

export function isSoundEnabled() {
  return enabled;
}
