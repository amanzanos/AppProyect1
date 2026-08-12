"use client";

/**
 * Sound and feel.
 *
 * Every note here is synthesised with WebAudio rather than played from a file.
 * That is a deliberate trade: no audio assets means nothing to download,
 * nothing to license, and no weight added to a Play Store build — and a
 * handful of oscillator blips is exactly the vocabulary an arcade game wants
 * anyway. A kid taps a thing and it goes *ping*; that is most of what makes a
 * game feel alive.
 *
 * Browsers refuse to make noise until the user has touched the page, so the
 * context is created on the first interaction and reused after that.
 */

const MUTE_KEY = "blopy-muted";

let ctx: AudioContext | null = null;
let muted: boolean | null = null;

function isMuted() {
  if (muted === null) {
    try {
      muted = window.localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      muted = false;
    }
  }
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    window.localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    // Nothing to do; it just won't be remembered next time.
  }
}

export function getMuted() {
  if (typeof window === "undefined") return false;
  return isMuted();
}

function audio() {
  if (typeof window === "undefined" || isMuted()) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  // Suspended is the normal state until the page has been touched, and after
  // the app comes back from the background.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export interface ToneOptions {
  /** Hz at the start. */
  from: number;
  /** Hz at the end — a slide up reads as a win, down as a miss. */
  to?: number;
  ms?: number;
  type?: OscillatorType;
  gain?: number;
  /** Seconds from now, for building little melodies. */
  delay?: number;
}

export function tone({ from, to = from, ms = 120, type = "sine", gain = 0.14, delay = 0 }: ToneOptions) {
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + delay;
  const end = start + ms / 1000;

  const osc = ac.createOscillator();
  const vol = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), end);

  // A hard start or stop on a raw oscillator clicks. The tiny ramps are what
  // separate "a note" from "a pop".
  vol.gain.setValueAtTime(0.0001, start);
  vol.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  vol.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(vol).connect(ac.destination);
  osc.start(start);
  osc.stop(end + 0.02);
}

/** A short burst of noise — impacts, pins, a dart going in. */
function thud(ms = 90, gain = 0.2, cutoff = 900) {
  const ac = audio();
  if (!ac) return;
  const frames = Math.floor((ac.sampleRate * ms) / 1000);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    // Decaying white noise. The square of the envelope makes it read as a
    // knock rather than a hiss.
    const fade = 1 - i / frames;
    data[i] = (Math.random() * 2 - 1) * fade * fade;
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = cutoff;
  const vol = ac.createGain();
  vol.gain.value = gain;
  src.connect(filter).connect(vol).connect(ac.destination);
  src.start();
}

/** Rising arpeggio — the higher the step, the bigger the win. */
function fanfare(steps: number[], gap = 0.075) {
  steps.forEach((hz, i) => tone({ from: hz, ms: 150, type: "triangle", gain: 0.13, delay: i * gap }));
}

export const sfx = {
  /** Any ordinary tap on a button. */
  tap: () => tone({ from: 520, to: 700, ms: 55, type: "square", gain: 0.06 }),
  /** A dart leaving the hand, a ball leaving the lane. */
  launch: () => tone({ from: 300, to: 900, ms: 160, type: "sawtooth", gain: 0.07 }),
  /** Something landing where it should. */
  hit: () => {
    thud(70, 0.16, 1200);
    tone({ from: 660, ms: 70, type: "square", gain: 0.08 });
  },
  /** Landing on nothing. */
  miss: () => tone({ from: 340, to: 140, ms: 260, type: "sawtooth", gain: 0.09 }),
  /** Each step of a combo, climbing so a run *sounds* like a run. */
  combo: (streak: number) =>
    tone({ from: 480 + Math.min(streak, 8) * 90, ms: 90, type: "triangle", gain: 0.11 }),
  /** A correct answer. */
  right: () => fanfare([660, 880]),
  /** A wrong one. Short and soft — never punishing. */
  wrong: () => tone({ from: 300, to: 200, ms: 200, type: "sine", gain: 0.09 }),
  /** A strike, a bullseye, anything worth shouting about. */
  big: () => fanfare([523, 659, 784, 1047]),
  /** End of a run. */
  finish: () => fanfare([523, 659, 784], 0.09),
  /** A star lighting up on the results screen. */
  star: (index: number) => tone({ from: 700 + index * 200, ms: 180, type: "triangle", gain: 0.13 }),
  /** Countdown ticks in the last seconds. */
  tick: () => tone({ from: 900, ms: 45, type: "square", gain: 0.05 }),
};

/** Phone buzz, where the device has one. Silently ignored where it doesn't. */
export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported, or blocked. Not worth reacting to.
  }
}

/**
 * Knocks an element about for a moment. Driven straight onto the style rather
 * than through React, because it runs per frame and nothing else on the
 * screen has changed.
 */
export function shake(el: HTMLElement | SVGElement | null, strength = 8, ms = 260) {
  if (!el) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const started = performance.now();
  const step = (now: number) => {
    const t = (now - started) / ms;
    if (t >= 1) {
      el.style.transform = "";
      return;
    }
    // Decays to nothing, so it settles rather than stopping dead.
    const power = strength * (1 - t);
    const x = (Math.random() * 2 - 1) * power;
    const y = (Math.random() * 2 - 1) * power;
    el.style.transform = `translate(${x}px, ${y}px)`;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
