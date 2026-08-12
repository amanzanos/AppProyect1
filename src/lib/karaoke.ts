/**
 * Karaoke: the songs, and how a performance is scored.
 *
 * Every song here is traditional or otherwise out of copyright, and the melody
 * is *data* — a list of notes — synthesised at playback rather than a recording.
 * That is a legal decision before it is a technical one: shipping a backing
 * track or a modern lyric would need licences this app is never going to have.
 * It also fits how the rest of Blopy works, where the sound is synthesised and
 * the bundle carries no audio files at all.
 *
 * Nothing in this module touches the microphone, React or Firestore, so the
 * scoring can be reasoned about — and tested — on its own.
 */

/** A written note: pitch name, how many beats it lasts, and its syllable. */
type RawNote = [pitch: string, beats: number, text: string];

interface RawSong {
  id: string;
  title: string;
  /** Whose song it is, roughly, for the picker. */
  hint: string;
  emoji: string;
  bpm: number;
  /** One inner array per line of lyric, which is also how it's shown. */
  lines: RawNote[][];
}

export interface Note {
  midi: number;
  /** Seconds from the start of the song. */
  start: number;
  dur: number;
  text: string;
  line: number;
}

export interface Song {
  id: string;
  title: string;
  hint: string;
  emoji: string;
  bpm: number;
  notes: Note[];
  /** The words, already split by line, for the big display. */
  lines: string[][];
  /** Seconds, including the count-in. */
  duration: number;
}

const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C4" / "F#3" / "Bb4" → MIDI number. */
export function midiOf(pitch: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(pitch);
  if (!m) throw new Error(`pitch ilegible: ${pitch}`);
  const [, letter, accidental, octave] = m;
  const step = SEMITONE[letter] + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);
  return (Number(octave) + 1) * 12 + step;
}

export function midiToFreq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidi(freq: number) {
  return 69 + 12 * Math.log2(freq / 440);
}

/** Beats of silence before the first note, so nobody comes in cold. */
export const COUNT_IN_BEATS = 4;

function compile(raw: RawSong): Song {
  const beat = 60 / raw.bpm;
  const notes: Note[] = [];
  let at = COUNT_IN_BEATS * beat;
  raw.lines.forEach((line, i) => {
    for (const [pitch, beats, text] of line) {
      notes.push({ midi: midiOf(pitch), start: at, dur: beats * beat, text, line: i });
      at += beats * beat;
    }
    // A breath between lines, which is also what makes the display readable.
    at += beat;
  });
  return {
    id: raw.id,
    title: raw.title,
    hint: raw.hint,
    emoji: raw.emoji,
    bpm: raw.bpm,
    notes,
    lines: raw.lines.map((line) => line.map(([, , text]) => text)),
    duration: at,
  };
}

/**
 * Four short ones. Short is deliberate: a turn that outlasts the room's
 * patience is the fastest way to end a party game, and with six people waiting
 * their turn a two-minute song means a ten-minute queue.
 */
const RAW_SONGS: RawSong[] = [
  {
    id: "estrellita",
    title: "Estrellita",
    hint: "La nana de siempre",
    emoji: "⭐",
    bpm: 104,
    lines: [
      [
        ["C4", 1, "Es"], ["C4", 1, "tre"], ["G4", 1, "lli"], ["G4", 1, "ta"],
        ["A4", 1, "dón"], ["A4", 1, "de"], ["G4", 2, "estás"],
      ],
      [
        ["F4", 1, "me"], ["F4", 1, "pre"], ["E4", 1, "gun"], ["E4", 1, "to"],
        ["D4", 1, "quién"], ["D4", 1, "se"], ["C4", 2, "rás"],
      ],
      [
        ["G4", 1, "En"], ["G4", 1, "el"], ["F4", 1, "cie"], ["F4", 1, "lo"],
        ["E4", 1, "o"], ["E4", 1, "en"], ["D4", 2, "el mar"],
      ],
      [
        ["G4", 1, "un"], ["G4", 1, "dia"], ["F4", 1, "man"], ["F4", 1, "te"],
        ["E4", 1, "de"], ["E4", 1, "ver"], ["D4", 2, "dad"],
      ],
      [
        ["C4", 1, "Es"], ["C4", 1, "tre"], ["G4", 1, "lli"], ["G4", 1, "ta"],
        ["A4", 1, "dón"], ["A4", 1, "de"], ["G4", 2, "estás"],
      ],
      [
        ["F4", 1, "me"], ["F4", 1, "pre"], ["E4", 1, "gun"], ["E4", 1, "to"],
        ["D4", 1, "quién"], ["D4", 1, "se"], ["C4", 2, "rás"],
      ],
    ],
  },
  {
    id: "cumpleanos",
    title: "Cumpleaños feliz",
    hint: "La que sabe todo el mundo",
    emoji: "🎂",
    bpm: 112,
    lines: [
      [
        ["G3", 0.5, "Cum"], ["G3", 0.5, "ple"], ["A3", 1, "a"], ["G3", 1, "ños"],
        ["C4", 1, "fe"], ["B3", 2, "liz"],
      ],
      [
        ["G3", 0.5, "Cum"], ["G3", 0.5, "ple"], ["A3", 1, "a"], ["G3", 1, "ños"],
        ["D4", 1, "fe"], ["C4", 2, "liz"],
      ],
      [
        ["G3", 0.5, "Te"], ["G3", 0.5, "de"], ["G4", 1, "se"], ["E4", 1, "a"],
        ["C4", 1, "mos"], ["B3", 1, "to"], ["A3", 2, "dos"],
      ],
      [
        ["F4", 0.5, "Cum"], ["F4", 0.5, "ple"], ["E4", 1, "a"], ["C4", 1, "ños"],
        ["D4", 1, "fe"], ["C4", 2, "liz"],
      ],
    ],
  },
  {
    id: "martinillo",
    title: "Martinillo",
    hint: "La del canon, para cantar a gritos",
    emoji: "🔔",
    bpm: 108,
    lines: [
      [["C4", 1, "Mar"], ["D4", 1, "ti"], ["E4", 1, "ni"], ["C4", 1, "llo"]],
      [["C4", 1, "Mar"], ["D4", 1, "ti"], ["E4", 1, "ni"], ["C4", 1, "llo"]],
      [["E4", 1, "dón"], ["F4", 1, "de"], ["G4", 2, "estás"]],
      [["E4", 1, "dón"], ["F4", 1, "de"], ["G4", 2, "estás"]],
      [
        ["G4", 0.5, "To"], ["A4", 0.5, "ca"], ["G4", 0.5, "la"], ["F4", 0.5, "cam"],
        ["E4", 1, "pa"], ["C4", 1, "na"],
      ],
      [
        ["G4", 0.5, "To"], ["A4", 0.5, "ca"], ["G4", 0.5, "la"], ["F4", 0.5, "cam"],
        ["E4", 1, "pa"], ["C4", 1, "na"],
      ],
      [["C4", 1, "din"], ["G3", 1, "don"], ["C4", 2, "dan"]],
      [["C4", 1, "din"], ["G3", 1, "don"], ["C4", 2, "dan"]],
    ],
  },
  {
    id: "cucaracha",
    title: "La cucaracha",
    hint: "Para los que no se saben nada",
    emoji: "🐞",
    bpm: 132,
    lines: [
      [["C4", 0.5, "La"], ["C4", 0.5, "cu"], ["C4", 0.5, "ca"], ["F4", 1, "ra"], ["A4", 1.5, "cha"]],
      [["C4", 0.5, "la"], ["C4", 0.5, "cu"], ["C4", 0.5, "ca"], ["F4", 1, "ra"], ["A4", 1.5, "cha"]],
      [
        ["F4", 0.5, "ya"], ["F4", 0.5, "no"], ["E4", 0.5, "pue"], ["E4", 0.5, "de"],
        ["D4", 0.5, "ca"], ["D4", 0.5, "mi"], ["C4", 2, "nar"],
      ],
    ],
  },
];

export const SONGS: Song[] = RAW_SONGS.map(compile);

export function songById(id: string): Song | null {
  return SONGS.find((s) => s.id === id) ?? null;
}

/**
 * How well a sung pitch matches a written one, ignoring which octave it came
 * out in.
 *
 * Octave-blind on purpose: the same melody sung by a bass and by a child is
 * two octaves apart and both are right. Scoring the absolute pitch would just
 * be scoring how closely the singer's range happens to match whatever octave
 * the song was written in.
 */
export function pitchAccuracy(sungMidi: number, targetMidi: number): number {
  let diff = (sungMidi - targetMidi) % 12;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  const off = Math.abs(diff);
  // A semitone out still counts — nobody sings a party game in tune, and a
  // scale that only rewards perfection reads as broken rather than as hard.
  if (off <= 1) return 1;
  if (off >= 3) return 0;
  return 1 - (off - 1) / 2;
}

/** Which note is meant to be sounding at this point in the song. */
export function noteAt(song: Song, seconds: number): Note | null {
  return song.notes.find((n) => seconds >= n.start && seconds < n.start + n.dur) ?? null;
}

/**
 * Turns a run of per-note accuracies into the number on the scoreboard.
 *
 * Weighted by how long each note is held, so a long note carries the weight it
 * deserves rather than counting the same as a passing syllable.
 */
export function scorePerformance(hits: { note: Note; accuracy: number }[]): number {
  if (hits.length === 0) return 0;
  let weighted = 0;
  let total = 0;
  for (const { note, accuracy } of hits) {
    weighted += accuracy * note.dur;
    total += note.dur;
  }
  return Math.round((weighted / total) * 1000);
}

/** What to say about a score, which is most of the fun of a karaoke game. */
export function verdict(score: number): string {
  if (score >= 850) return "¡Estrella del karaoke!";
  if (score >= 700) return "¡Muy bien!";
  if (score >= 500) return "Se te ha entendido";
  if (score >= 300) return "Eso ha sido… valiente";
  return "Mejor bailando";
}
