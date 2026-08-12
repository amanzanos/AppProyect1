"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Mic, X } from "lucide-react";
import GameLobby from "@/components/games/GameLobby";
import MatchOver from "@/components/games/MatchOver";
import { COUNT_IN_BEATS, SONGS, midiToFreq, verdict, type Song } from "@/lib/karaoke";
import { tone } from "@/lib/juice";
import type { PlayerSlot, Seat } from "@/lib/data/gameRoom";
import {
  createKaraokeRoom,
  randomRoomCode,
  setKaraokeStage,
  useKaraokeRoom,
} from "@/lib/data/karaokeGame";

type Phase = "lobby" | "picking" | "arming" | "singing" | "over";

const STEPS = [
  { icon: "📱", text: "Todos escanean el mismo QR — hasta 8 jugadores" },
  { icon: "🎤", text: "Por turnos: el móvil del que canta es el micrófono" },
  { icon: "⭐", text: "Afina la melodía — la letra sale aquí y en su móvil" },
];

/** Seconds of lead-in between "ready" and the first beat. */
const LEAD_MS = 2600;
/** How long the score stays up before the next singer. */
const APPLAUSE_MS = 4200;

const BACKGROUND = "radial-gradient(circle at 50% -10%, #d9457f 0%, #6d1d63 45%, #26102f 100%)";

/**
 * Plays the melody as a guide, scheduled in one go.
 *
 * Every note is handed to the Web Audio clock up front rather than fired from
 * a timer, because a setTimeout per note drifts audibly over half a minute —
 * and a guide melody that drifts is worse than none, since the singer is being
 * scored against the written timing, not against what they can hear.
 */
function scheduleMelody(song: Song, startAt: number) {
  const lead = (startAt - Date.now()) / 1000;
  for (const note of song.notes) {
    const delay = lead + note.start;
    if (delay < 0) continue;
    tone({
      from: midiToFreq(note.midi),
      ms: Math.max(note.dur * 1000 - 60, 90),
      type: "sine",
      // Quiet on purpose: it has to be audible across a room without drowning
      // the singer at their own phone's microphone, which is what would make
      // the game score the television instead of the person.
      gain: 0.05,
      delay,
    });
  }
  // A count-in, so nobody has to guess when to come in.
  const beat = 60 / song.bpm;
  for (let i = 0; i < COUNT_IN_BEATS; i++) {
    const delay = lead + i * beat;
    if (delay >= 0) tone({ from: i === COUNT_IN_BEATS - 1 ? 1320 : 880, ms: 70, gain: 0.09, delay });
  }
}

export default function KaraokePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("lobby");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  const [song, setSong] = useState<Song | null>(null);
  const [playing, setPlaying] = useState<Record<PlayerSlot, Seat>>({});
  const [order, setOrder] = useState<PlayerSlot[]>([]);
  const [at, setAt] = useState(0);
  const [take, setTake] = useState(0);
  const [scores, setScores] = useState<Record<PlayerSlot, number>>({});
  const [elapsed, setElapsed] = useState(0);

  const room = useKaraokeRoom(roomId);
  const roomRef = useRef(room);
  /** When the first beat lands, in wall-clock time. Shared with the phone. */
  const startAtRef = useRef(0);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    const id = randomRoomCode();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot random room code minted on mount; Math.random() can't run during render
    setRoomId(id);
    createKaraokeRoom(id);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const origin = window.location.origin;
    QRCode.toDataURL(`${origin}/games/karaoke/play?room=${roomId}`, {
      margin: 1,
      width: 320,
      color: { dark: "#6d1d63", light: "#ffffff" },
    }).then(setQr);
  }, [roomId]);

  const singer = order[at];
  const live = singer ? room?.controls[singer] : null;

  /** Hand the microphone to the next singer, or wrap the game up. */
  const callUp = useCallback(
    (index: number, chosen: Song, list: PlayerSlot[]) => {
      if (index >= list.length) {
        setPhase("over");
        return;
      }
      setAt(index);
      setPhase("arming");
      const nextTake = index + 1;
      setTake(nextTake);
      if (roomId) {
        setKaraokeStage(roomId, { song: chosen.id, singer: list[index], take: nextTake, startAt: 0 });
      }
    },
    [roomId]
  );

  const start = useCallback(
    (chosen: Song) => {
      const seats = roomRef.current?.seats ?? {};
      const list = Object.keys(seats).map(Number).sort((a, b) => a - b);
      setSong(chosen);
      setPlaying(seats);
      setOrder(list);
      setScores(Object.fromEntries(list.map((s) => [s, 0])));
      callUp(0, chosen, list);
    },
    [callUp]
  );

  // The singer's phone says when its microphone is live; only then is there any
  // point counting anybody in.
  useEffect(() => {
    if (phase !== "arming" || !song || !singer || !roomId) return;
    if (!live?.ready || live.take !== take) return;
    const startAt = Date.now() + LEAD_MS;
    startAtRef.current = startAt;
    setKaraokeStage(roomId, { startAt });
    scheduleMelody(song, startAt);
    /* eslint-disable react-hooks/set-state-in-effect -- reacting to a remote
       event: the singer's phone reported its microphone open over Firestore,
       which is exactly the external system this effect subscribes to. */
    setPhase("singing");
    setElapsed(-LEAD_MS / 1000);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [phase, live, take, song, singer, roomId]);

  // The song clock, which drives the lyric highlight and nothing else — the
  // scoring all happens on the phone holding the microphone. Negative until
  // the first beat, which is what puts the count-in on screen.
  useEffect(() => {
    if (phase !== "singing" || !song) return;
    const id = setInterval(() => {
      setElapsed((Date.now() - startAtRef.current) / 1000);
    }, 60);
    return () => clearInterval(id);
  }, [phase, song]);

  // Keep the running score, and move on when the performance is done.
  useEffect(() => {
    if (phase !== "singing" || !song || !singer) return;
    if (live?.take === take && typeof live.score === "number") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the score arrives from the singer's phone through Firestore; there is nowhere else to fold it in
      setScores((s) => (s[singer] === live.score ? s : { ...s, [singer]: live.score }));
    }
    const finished = (live?.take === take && live.done) || elapsed > song.duration + 1.5;
    if (!finished) return;
    const id = setTimeout(() => callUp(at + 1, song, order), APPLAUSE_MS);
    return () => clearTimeout(id);
  }, [phase, live, take, elapsed, song, singer, at, order, callUp]);

  if (phase === "lobby") {
    return (
      <div className="fixed inset-0 z-[999]">
        <GameLobby
          title="KARAOKE"
          emoji="🎤"
          background={BACKGROUND}
          steps={STEPS}
          roomId={roomId}
          qr={qr}
          seats={room?.seats ?? {}}
          minPlayers={1}
          onStart={() => setPhase("picking")}
          onExit={() => router.push("/games")}
        />
      </div>
    );
  }

  if (phase === "picking") {
    return (
      <div
        className="fixed inset-0 z-[999] overflow-y-auto px-5 py-8 text-white"
        style={{ background: BACKGROUND }}
      >
        <h1 className="text-center font-heading text-2xl font-black">Elegid canción</h1>
        <p className="mt-1 text-center text-xs text-white/60">
          La cantáis todos por turnos — a ver quién afina mejor
        </p>
        <div className="mx-auto mt-5 grid max-w-lg gap-3">
          {SONGS.map((s) => (
            <button
              key={s.id}
              onClick={() => start(s)}
              className="flex items-center gap-3 rounded-3xl bg-white/10 p-4 text-left backdrop-blur-sm active:scale-95"
            >
              <span className="text-3xl">{s.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-heading text-lg font-black">{s.title}</span>
                <span className="block text-xs text-white/60">{s.hint}</span>
              </span>
              <span className="shrink-0 text-xs font-bold text-white/40">{Math.round(s.duration)}s</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "over" || !song) {
    return (
      <div className="fixed inset-0 z-[999] bg-[#26102f]">
        <MatchOver
          game="karaoke"
          seats={playing}
          scores={scores}
          unit="puntos"
          onPlayAgain={() => setPhase("picking")}
          onExit={() => router.push("/games")}
        />
      </div>
    );
  }

  const who = singer ? playing[singer] : null;
  const current = song.notes.filter((n) => elapsed >= n.start).at(-1) ?? null;
  const lineIndex = current?.line ?? 0;
  const done = (live?.take === take && live.done) || elapsed > song.duration;
  const shown = scores[singer ?? 0] ?? 0;

  return (
    <div className="fixed inset-0 z-[999] flex flex-col text-white" style={{ background: BACKGROUND }}>
      <div className="flex items-center justify-between gap-3 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button
          onClick={() => setPhase("lobby")}
          aria-label="Salir"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 active:scale-95"
        >
          <X size={20} />
        </button>

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl bg-black/30 px-3 py-1.5">
          {order.map((slot) => (
            <div key={slot} className="flex items-center gap-1.5" style={{ opacity: slot === singer ? 1 : 0.45 }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: playing[slot].color }} />
              <span className="text-[11px] font-bold text-white/70">{playing[slot].name}</span>
              <span className="tnum font-heading text-lg font-black leading-none">{scores[slot] ?? 0}</span>
            </div>
          ))}
        </div>

        <span className="w-16 shrink-0 text-right text-[11px] font-bold text-white/50">
          {at + 1}/{order.length}
        </span>
      </div>

      {phase === "arming" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <span className="animate-float text-6xl">🎤</span>
          <p className="font-heading text-3xl font-black">Le toca a {who?.name}</p>
          <p className="max-w-[34ch] text-sm leading-snug text-white/70">
            Coge tu móvil y dale a <strong>¡Me toca!</strong> — hace falta el micrófono para puntuarte
          </p>
          <p className="mt-2 flex items-center gap-2 rounded-full bg-black/30 px-4 py-2 text-sm font-bold">
            <Mic size={15} /> {song.emoji} {song.title}
          </p>
        </div>
      ) : (
        <>
          <div className="mx-4 mt-3 h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-pink-300 to-amber-300 transition-[width] duration-100"
              style={{ width: `${Math.min(Math.max(elapsed / song.duration, 0), 1) * 100}%` }}
            />
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
            {elapsed < 0 ? (
              <p className="font-heading text-6xl font-black">{Math.ceil(-elapsed)}</p>
            ) : done ? (
              <>
                <p className="font-heading text-2xl font-black text-white/70">{who?.name}</p>
                <p className="tnum font-heading text-7xl font-black">{shown}</p>
                <p className="font-heading text-xl font-black text-amber-300">{verdict(shown)}</p>
              </>
            ) : (
              <>
                {/* The line being sung, big enough for the whole room to join in. */}
                <p className="flex max-w-4xl flex-wrap justify-center gap-x-2 font-heading text-[clamp(1.75rem,5vw,3.5rem)] font-black leading-tight">
                  {song.notes
                    .filter((n) => n.line === lineIndex)
                    .map((n, i) => (
                      <span
                        key={i}
                        style={{
                          opacity: current && n.start <= current.start ? 1 : 0.4,
                          color: current && n.start === current.start ? "#fde68a" : undefined,
                        }}
                      >
                        {n.text}
                      </span>
                    ))}
                </p>
                {song.lines[lineIndex + 1] && (
                  <p className="max-w-3xl text-[clamp(0.9rem,2vw,1.35rem)] font-bold text-white/35">
                    {song.lines[lineIndex + 1].join(" ")}
                  </p>
                )}
              </>
            )}
          </div>

          <p className="pb-[calc(1rem+env(safe-area-inset-bottom))] text-center text-xs font-semibold">
            <span style={{ color: who?.color }}>Canta {who?.name}</span>
            <span className="text-white/40"> · {song.title}</span>
          </p>
        </>
      )}
    </div>
  );
}
