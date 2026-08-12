"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mic } from "lucide-react";
import ControllerShell from "@/components/games/ControllerShell";
import { MIC_CONSTRAINTS, detectPitch } from "@/lib/pitch";
import { freqToMidi, noteAt, pitchAccuracy, scorePerformance, songById, verdict, type Note } from "@/lib/karaoke";
import { KARAOKE_COLLECTION, sendKaraokeScore, sendReady, useKaraokeRoom } from "@/lib/data/karaokeGame";
import { vibrateSuccess } from "@/lib/haptics";
import type { PlayerSlot } from "@/lib/data/gameRoom";

/** Buffer handed to the detector. 2048 at 44.1kHz is ~46ms — long enough to
    hold a couple of cycles of a low voice, short enough to follow a run. */
const FRAME = 2048;
/** How often the pitch is sampled. Well above what a melody needs, and far
    below what would keep the phone's audio thread busy. */
const SAMPLE_MS = 45;

type Mic = { ctx: AudioContext; stream: MediaStream; analyser: AnalyserNode };

async function openMic(): Promise<Mic> {
  const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctor();
  if (ctx.state === "suspended") await ctx.resume();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = FRAME;
  ctx.createMediaStreamSource(stream).connect(analyser);
  return { ctx, stream, analyser };
}

function closeMic(mic: Mic | null) {
  if (!mic) return;
  mic.stream.getTracks().forEach((t) => t.stop());
  void mic.ctx.close();
}

/**
 * The singer's phone.
 *
 * Everything about the voice happens here and stays here: the microphone, the
 * pitch detection and the scoring. Only the running total goes to the screen,
 * once per line. That isn't a shortcut — pitch has to be sampled twenty times a
 * second and Firestore takes about one write a second, so a design where the
 * television did the scoring could not exist.
 */
function KaraokePad({ room, slot }: { room: string; slot: PlayerSlot }) {
  const state = useKaraokeRoom(room);
  const stage = state?.stage;
  const song = songById(stage?.song ?? "");
  const take = stage?.take ?? 0;
  const myTurn = stage?.singer === slot;
  const startAt = stage?.startAt ?? 0;

  const [armed, setArmed] = useState(false);
  const [denied, setDenied] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [cents, setCents] = useState<number | null>(null);
  const [syllable, setSyllable] = useState<string>("");
  const [countdown, setCountdown] = useState<number | null>(null);

  const micRef = useRef<Mic | null>(null);
  /** Accuracy samples for the note being sung, folded in when it ends. */
  const hitsRef = useRef<{ note: Note; accuracy: number }[]>([]);
  const currentRef = useRef<{ note: Note; hits: number; sum: number } | null>(null);
  const lineRef = useRef(-1);
  const takeRef = useRef(-1);

  // A new turn wipes the last one, so a second go doesn't start with the first
  // performance's score already on the board.
  useEffect(() => {
    if (takeRef.current === take) return;
    takeRef.current = take;
    hitsRef.current = [];
    currentRef.current = null;
    lineRef.current = -1;
    setScore(0);
    setFinished(false);
    setArmed(false);
    setCents(null);
    setSyllable("");
  }, [take]);

  useEffect(() => () => closeMic(micRef.current), []);

  const arm = useCallback(async () => {
    try {
      micRef.current = await openMic();
      setArmed(true);
      setDenied(false);
      sendReady(room, slot, take);
      vibrateSuccess();
    } catch {
      // Denied, or no microphone. Saying so beats a button that does nothing.
      setDenied(true);
    }
  }, [room, slot, take]);

  // The performance itself: sample the microphone, score against the written
  // note, and report a running total at the end of each line.
  useEffect(() => {
    if (!armed || !myTurn || !song || !startAt || finished) return;
    const analyser = micRef.current?.analyser;
    const rate = micRef.current?.ctx.sampleRate;
    if (!analyser || !rate) return;

    const buf = new Float32Array(analyser.fftSize);

    const id = setInterval(() => {
      const seconds = (Date.now() - startAt) / 1000;

      if (seconds < 0) {
        setCountdown(Math.ceil(-seconds));
        return;
      }
      setCountdown(null);

      if (seconds > song.duration) {
        // Fold in whatever the last note collected, then report the total once.
        const open = currentRef.current;
        if (open) hitsRef.current.push({ note: open.note, accuracy: open.hits ? open.sum / open.hits : 0 });
        currentRef.current = null;
        const total = scorePerformance(hitsRef.current);
        setScore(total);
        setFinished(true);
        sendKaraokeScore(room, slot, take, total, true);
        return;
      }

      const note = noteAt(song, seconds);
      const open = currentRef.current;
      if (open && open.note !== note) {
        // A note is only worth anything if it was actually sung: no samples
        // means silence, which scores zero rather than being skipped.
        hitsRef.current.push({ note: open.note, accuracy: open.hits ? open.sum / open.hits : 0 });
        currentRef.current = null;
      }
      if (!note) {
        setCents(null);
        return;
      }
      if (!currentRef.current) currentRef.current = { note, hits: 0, sum: 0 };
      setSyllable(note.text);

      analyser.getFloatTimeDomainData(buf);
      const reading = detectPitch(buf, rate);
      if (reading) {
        const sung = freqToMidi(reading.hz);
        const accuracy = pitchAccuracy(sung, note.midi);
        currentRef.current.hits += 1;
        currentRef.current.sum += accuracy;
        // How far off, folded into one octave, for the needle.
        let diff = (sung - note.midi) % 12;
        if (diff > 6) diff -= 12;
        if (diff < -6) diff += 12;
        setCents(diff);
      } else {
        setCents(null);
      }

      // One write per line: eight or so over a whole song, which keeps the
      // screen's running score honest without going near the write limit.
      if (note.line !== lineRef.current) {
        if (lineRef.current >= 0) {
          const running = scorePerformance(hitsRef.current);
          setScore(running);
          sendKaraokeScore(room, slot, take, running, false);
        }
        lineRef.current = note.line;
      }
    }, SAMPLE_MS);

    return () => clearInterval(id);
  }, [armed, myTurn, song, startAt, finished, room, slot, take]);

  if (!myTurn) {
    const who = stage?.singer ? state?.seats[stage.singer]?.name : null;
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <span className="text-5xl">🎤</span>
        <p className="font-heading text-xl font-black">
          {who ? `Canta ${who}` : "Mira la pantalla grande"}
        </p>
        <p className="text-sm text-white/60">
          {song ? `${song.emoji} ${song.title} — tu turno llega enseguida` : "Esperando a que empiece"}
        </p>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <span className="text-5xl">🌟</span>
        <p className="tnum font-heading text-6xl font-black">{score}</p>
        <p className="font-heading text-lg font-black text-amber-300">{verdict(score)}</p>
        <p className="mt-2 text-sm text-white/60">Pásale el móvil al siguiente</p>
      </div>
    );
  }

  if (!armed) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
        <span className="animate-float text-6xl">🎤</span>
        <p className="font-heading text-2xl font-black">¡Te toca!</p>
        {song && <p className="text-sm text-white/70">{song.emoji} {song.title}</p>}
        <button
          onClick={arm}
          className="mt-1 flex items-center gap-2 rounded-full bg-white px-9 py-4 font-heading text-lg font-extrabold text-neutral-800 shadow-xl active:scale-95"
        >
          <Mic size={20} /> ¡Me toca!
        </button>
        <p className="max-w-[28ch] text-xs text-white/60">
          {denied
            ? "No me has dado el micrófono. Actívalo en los permisos del navegador y vuelve a darle."
            : "Hace falta el micrófono para puntuar cómo afinas. Canta cerca del móvil."}
        </p>
      </div>
    );
  }

  const off = cents ?? 0;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      {countdown !== null ? (
        <p className="font-heading text-7xl font-black">{countdown}</p>
      ) : (
        <>
          <p className="font-heading text-5xl font-black">{syllable || "…"}</p>

          {/* The needle: dead centre is in tune, and which way it leans says
              whether to reach up or come down. */}
          <div className="relative h-3 w-full max-w-[280px] rounded-full bg-white/15">
            <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/40" />
            <span
              className="absolute top-1/2 h-7 w-7 -translate-y-1/2 rounded-full border-2 border-white shadow-lg transition-[left,background-color] duration-75"
              style={{
                left: `calc(${50 + Math.max(-1, Math.min(1, off / 6)) * 50}% - 0.875rem)`,
                background: cents === null ? "#6b7280" : Math.abs(off) <= 1 ? "#34d399" : "#f472b6",
              }}
            />
          </div>
          <p className="text-xs font-bold text-white/60">
            {cents === null
              ? "Canta más fuerte"
              : Math.abs(off) <= 1
                ? "¡Afinadísimo!"
                : off > 0
                  ? "Un poco más grave"
                  : "Un poco más agudo"}
          </p>

          <p className="tnum font-heading text-3xl font-black">{score}</p>
        </>
      )}
    </div>
  );
}

function KaraokeControllerInner() {
  const room = useSearchParams().get("room");
  return (
    <ControllerShell collection={KARAOKE_COLLECTION} room={room} emoji="🎤">
      {({ slot }) => <KaraokePad room={room!} slot={slot} />}
    </ControllerShell>
  );
}

export default function KaraokeControllerPage() {
  return (
    <Suspense fallback={null}>
      <KaraokeControllerInner />
    </Suspense>
  );
}
