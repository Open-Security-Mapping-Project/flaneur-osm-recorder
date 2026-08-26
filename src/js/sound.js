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
let master = null;
let enabled = false;
let lastTickAt = 0;

/** Detent ticks closer together than this are dropped, in milliseconds. */
const TICK_MIN_INTERVAL_MS = 28;

/**
 * Every sound is scheduled this far ahead of `currentTime`, in seconds.
 *
 * Scheduling at exactly `ac.currentTime` puts the start of the envelope in the
 * past: the audio thread renders in 128-sample quanta, so anything scheduled
 * mid-quantum has its first couple of milliseconds discarded. On the very first
 * sound the context has just started and `currentTime` sits on a quantum
 * boundary, so that sound alone played its full attack — which is exactly what
 * "the first click is louder" was. A small constant lead means every sound,
 * first or thousandth, renders from sample zero of its envelope.
 */
const SCHEDULE_LEAD_S = 0.02;

/** Exponential ramps cannot reach zero; this is the floor they run to. */
const SILENT = 0.0001;

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
    // One output stage for the whole app, so relative levels between sounds
    // stay fixed and there is a single place to trim overall loudness.
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    primeOutput();
  }

  // Safari and Chrome park the context until a gesture resumes it.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/**
 * Bring the audio hardware up on a context that has just been created.
 *
 * iOS is the strict case: a context that has never rendered a buffer stays mute
 * even after it reports "running" — hence the one-frame silent buffer.
 * `navigator.audioSession` (Safari 16.4+) is what lets Web Audio play with the
 * ringer switch set to silent; without it iOS routes us to the ambient
 * category and the phone's mute switch silences every sound this module makes.
 */
function primeOutput() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch {
    /* not supported — the silent switch will mute us, nothing we can do */
  }

  try {
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    src.connect(master);
    src.start();
  } catch {
    /* the context is unusable; play calls below will no-op harmlessly */
  }
}

/** Start time for a sound scheduled now. */
function startTime(ac) {
  return ac.currentTime + SCHEDULE_LEAD_S;
}

/**
 * Gain stage with a real attack. A jump straight to peak is a discontinuity —
 * it reads as a harsher, louder transient than the same sound given a couple
 * of milliseconds to rise.
 * @param {AudioContext} ac
 * @param {number} t0 absolute context time to start at
 * @param {number} peak peak amplitude
 * @param {number} attack seconds to reach peak
 * @param {number} duration total seconds to the silent floor
 */
function envelope(ac, t0, peak, attack, duration) {
  const amp = ac.createGain();
  amp.gain.setValueAtTime(SILENT, t0);
  amp.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  amp.gain.exponentialRampToValueAtTime(SILENT, t0 + duration);
  return amp;
}

/**
 * Short filtered noise burst — the body of a mechanical click.
 * @param {AudioContext} ac
 * @param {number} t0 absolute context time to start at
 * @param {number} duration seconds
 * @param {number} gain peak amplitude
 * @param {number} cutoff bandpass center in Hz
 */
function noiseBurst(ac, t0, duration, gain, cutoff) {
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

  const amp = envelope(ac, t0, gain, 0.001, duration);

  src.connect(band).connect(amp).connect(master);
  src.start(t0);
  src.stop(t0 + duration);
}

/**
 * Confirmation click for a recorded node.
 * A noise transient plus a low sine thump, so it reads as a definite "captured"
 * rather than a UI blip.
 */
export function playRecordClick() {
  const ac = audio();
  if (!ac) return;

  const t0 = startTime(ac);
  noiseBurst(ac, t0, 0.035, 0.22, 2200);

  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, t0);
  osc.frequency.exponentialRampToValueAtTime(320, t0 + 0.06);

  const amp = envelope(ac, t0, 0.16, 0.002, 0.07);

  osc.connect(amp).connect(master);
  osc.start(t0);
  osc.stop(t0 + 0.08);
}

/**
 * One detent of the compass dial — the "clickety" of dragging the bearing.
 *
 * Deliberately brief and slightly randomized: identical repeated ticks sound
 * synthetic and grating, while small pitch variation reads as a physical
 * ratchet. Rate-limited so a fast drag cannot machine-gun the output.
 *
 * The noise burst carries the texture but almost no energy — on a laptop's
 * speakers, which roll off hard below the band it sits in, it was inaudible
 * even though the same tick was clearly audible held to the ear on a phone.
 * The pitched blip underneath is what makes the tick carry on desktop.
 */
export function playDragTick() {
  const ac = audio();
  if (!ac) return;

  const now = Date.now();
  if (now - lastTickAt < TICK_MIN_INTERVAL_MS) return;
  lastTickAt = now;

  const t0 = startTime(ac);
  noiseBurst(ac, t0, 0.014, 0.1, 1500 + Math.random() * 900);

  const osc = ac.createOscillator();
  osc.type = 'triangle';
  const pitch = 1900 + Math.random() * 400;
  osc.frequency.setValueAtTime(pitch, t0);
  osc.frequency.exponentialRampToValueAtTime(pitch * 0.55, t0 + 0.018);

  const amp = envelope(ac, t0, 0.07, 0.001, 0.02);

  osc.connect(amp).connect(master);
  osc.start(t0);
  osc.stop(t0 + 0.025);
}

/** Soft confirmation used when the sound toggle is switched on. */
export function playToggleBlip() {
  const ac = audio();
  if (!ac) return;

  const t0 = startTime(ac);

  const osc = ac.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(520, t0);
  osc.frequency.exponentialRampToValueAtTime(780, t0 + 0.08);

  const amp = envelope(ac, t0, 0.12, 0.004, 0.1);

  osc.connect(amp).connect(master);
  osc.start(t0);
  osc.stop(t0 + 0.11);
}

/**
 * Start the audio context while a user gesture is still in scope.
 *
 * Safari will not start a context outside a gesture at all, so the settings
 * toggle calls this: it is the one moment we are guaranteed to be inside a
 * real tap. Everything else is handled by audio() on first use.
 */
export function unlockAudio() {
  audio();
}

export function setSoundEnabled(on) {
  enabled = !!on;
  // Deliberately does NOT create a context — it runs at page load from the
  // stored preference, where starting one would only earn an autoplay warning
  // and a suspended context. unlockAudio() does that from the toggle.
  if (!enabled && ctx) {
    ctx.close().catch(() => {});
    ctx = null;
    master = null;
  }
}

export function isSoundEnabled() {
  return enabled;
}
