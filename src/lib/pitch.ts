/**
 * Working out what note somebody is singing, from the microphone.
 *
 * Autocorrelation rather than an FFT: a sung vowel is a rich harmonic stack,
 * and the loudest bin of its spectrum is very often a harmonic rather than the
 * fundamental — which is why naive FFT pitch trackers report notes an octave
 * (or a fifth) high on exactly the voices people use to sing. Correlating the
 * signal against a delayed copy of itself finds the period the whole waveform
 * repeats at, harmonics and all.
 *
 * This runs on the phone, never on the screen. It has to: pitch has to be
 * sampled tens of times a second and Firestore sustains about one write a
 * second, so streaming a voice to the television is not on the table. The
 * phone holds the microphone anyway, so it is also the honest place to do it.
 */

/** Below this the buffer is silence or room noise, not singing. */
const RMS_GATE = 0.012;
/** Nothing sung lands outside this, and it keeps the lag search cheap. */
const MIN_HZ = 80;
const MAX_HZ = 1100;
/** How periodic the buffer has to look before its pitch is believed at all. */
const MIN_CLARITY = 0.55;
/**
 * A shorter period this close to the best one wins.
 *
 * The autocorrelation of a voice peaks again at every whole multiple of the
 * true period, and those later peaks are often a hair taller than the first.
 * Taking the tallest is exactly how a detector reports everything an octave
 * low; preferring the earliest peak that is nearly as good fixes it.
 */
const OCTAVE_BIAS = 0.85;

export interface PitchReading {
  hz: number;
  /** 0-1, how convincingly periodic the buffer was. */
  clarity: number;
}

/**
 * The fundamental frequency in the buffer, or null for silence, noise, or
 * anything too unclear to call.
 */
export function detectPitch(buf: Float32Array, sampleRate: number): PitchReading | null {
  const size = buf.length;

  let rms = 0;
  for (let i = 0; i < size; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / size);
  // The gate is what stops the game scoring the television's own guide melody
  // leaking across the room: a voice into a held phone is far louder at the
  // microphone than a speaker several metres away.
  if (rms < RMS_GATE) return null;

  const minLag = Math.max(2, Math.floor(sampleRate / MAX_HZ));
  const maxLag = Math.min(Math.floor(sampleRate / MIN_HZ), size - 2);
  if (maxLag <= minLag) return null;

  // Normalised autocorrelation, so a peak's height means "how periodic" rather
  // than "how loud", and the thresholds above can be fixed numbers.
  const corr = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let energyA = 0;
    let energyB = 0;
    for (let i = 0; i < size - lag; i++) {
      sum += buf[i] * buf[i + lag];
      energyA += buf[i] * buf[i];
      energyB += buf[i + lag] * buf[i + lag];
    }
    const norm = Math.sqrt(energyA * energyB);
    corr[lag] = norm > 0 ? sum / norm : 0;
  }

  // Every local maximum, then the earliest one that is close enough to the
  // best — see OCTAVE_BIAS.
  let best = 0;
  let bestLag = -1;
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (corr[lag] > corr[lag - 1] && corr[lag] >= corr[lag + 1] && corr[lag] > best) {
      best = corr[lag];
      bestLag = lag;
    }
  }
  if (bestLag < 0 || best < MIN_CLARITY) return null;

  for (let lag = minLag + 1; lag < bestLag; lag++) {
    if (corr[lag] > corr[lag - 1] && corr[lag] >= corr[lag + 1] && corr[lag] >= best * OCTAVE_BIAS) {
      bestLag = lag;
      break;
    }
  }

  // Parabolic interpolation through the peak and its neighbours. Without it the
  // reported pitch can only ever be sampleRate/(whole number of samples), and
  // up at the top of a singing range consecutive lags are most of a semitone
  // apart — enough to fail a note that was actually sung in tune.
  const y0 = corr[bestLag - 1];
  const y1 = corr[bestLag];
  const y2 = corr[bestLag + 1];
  const denom = 2 * (2 * y1 - y0 - y2);
  const shift = denom !== 0 ? (y2 - y0) / denom : 0;
  const refined = bestLag + Math.max(-1, Math.min(1, shift));

  const hz = sampleRate / refined;
  if (hz < MIN_HZ || hz > MAX_HZ) return null;
  return { hz, clarity: corr[bestLag] };
}

/** How the microphone is opened, kept in one place so every caller agrees. */
export const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    // All three would otherwise fight the singer: the gain rider pumps on held
    // notes, and both cancellers are tuned to treat a sustained tone as noise
    // worth removing.
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  },
  video: false,
};
