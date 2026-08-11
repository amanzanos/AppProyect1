"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import SoloOver from "@/components/SoloOver";
import { buzz, sfx, shake, tone } from "@/lib/juice";

/** Four pads, four notes. A major chord, so any sequence sounds musical. */
const PADS = [
  { color: "#22c55e", lit: "#86efac", hz: 392.0, emoji: "🟢" },
  { color: "#ef4444", lit: "#fca5a5", hz: 523.25, emoji: "🔴" },
  { color: "#eab308", lit: "#fde047", hz: 659.25, emoji: "🟡" },
  { color: "#3b82f6", lit: "#93c5fd", hz: 783.99, emoji: "🔵" },
] as const;

const FLASH_MS = 420;
const GAP_MS = 180;

type Mode = "watch" | "repeat" | "wrong";

/**
 * Simón dice.
 *
 * Forty-year-old design, about eighty lines, and still one of the most
 * effective toys ever made for a small child: it teaches itself in one round
 * with no words at all. It earns its place here because the sound isn't
 * decoration — the tune *is* the memory aid, which is why the pads are tuned
 * to a chord rather than given arbitrary beeps.
 */
export default function SimonPage() {
  const router = useRouter();
  const [sequence, setSequence] = useState<number[]>([]);
  const [mode, setMode] = useState<Mode>("watch");
  const [lit, setLit] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [over, setOver] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => clearTimers, []);

  const playPad = useCallback((index: number, ms = FLASH_MS) => {
    setLit(index);
    tone({ from: PADS[index].hz, ms: ms - 60, type: "triangle", gain: 0.16 });
    timers.current.push(setTimeout(() => setLit(null), ms - 60));
  }, []);

  /** Show the whole sequence, then hand over. */
  const demo = useCallback(
    (seq: number[]) => {
      setMode("watch");
      setStep(0);
      seq.forEach((pad, i) => {
        timers.current.push(setTimeout(() => playPad(pad), 600 + i * (FLASH_MS + GAP_MS)));
      });
      timers.current.push(
        setTimeout(() => setMode("repeat"), 600 + seq.length * (FLASH_MS + GAP_MS) + 120)
      );
    },
    [playPad]
  );

  const extend = useCallback(
    (previous: number[]) => {
      const next = [...previous, Math.floor(Math.random() * PADS.length)];
      setSequence(next);
      demo(next);
    },
    [demo]
  );

  /** Bumped to start a fresh game; the effect below does the scheduling. */
  const [run, setRun] = useState(0);

  const begin = useCallback(() => {
    setOver(false);
    setSequence([]);
    setStep(0);
    setLit(null);
    setRun((n) => n + 1);
  }, []);

  // Timers are an external system, so starting the first round belongs here —
  // and going through a timeout means nothing is set synchronously during the
  // effect, which is what makes renders cascade.
  useEffect(() => {
    clearTimers();
    const id = setTimeout(() => extend([]), 400);
    return () => clearTimeout(id);
  }, [run, extend]);

  function press(index: number) {
    if (mode !== "repeat" || over) return;

    if (sequence[step] !== index) {
      setMode("wrong");
      setLit(index);
      sfx.wrong();
      buzz([0, 80, 50, 80]);
      shake(stageRef.current, 14);
      // The score is the rounds completed, so a miss on round five scores four.
      timers.current.push(setTimeout(() => setOver(true), 900));
      return;
    }

    playPad(index, 260);
    buzz(18);
    const next = step + 1;

    if (next < sequence.length) {
      setStep(next);
      return;
    }

    // Round cleared.
    sfx.right();
    timers.current.push(setTimeout(() => extend(sequence), 700));
  }

  const round = sequence.length;

  return (
    <main className="fixed inset-0 flex touch-none select-none flex-col bg-[#1b1040] text-white">
      <div className="flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button
          onClick={() => router.push("/games")}
          aria-label="Salir"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 active:scale-95"
        >
          <X size={20} />
        </button>
        <div className="text-center">
          <p className="tnum font-heading text-3xl font-black leading-none">{round}</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">ronda</p>
        </div>
        <span className="w-10" />
      </div>

      <p
        className={`mt-2 text-center font-heading text-lg font-black ${
          mode === "watch" ? "text-amber-300" : mode === "wrong" ? "text-red-400" : "text-white/70"
        }`}
      >
        {mode === "watch" ? "Mira…" : mode === "wrong" ? "¡Uy!" : "¡Tu turno!"}
      </p>

      <div ref={stageRef} className="flex flex-1 items-center justify-center px-6">
        <div className="grid aspect-square w-full max-w-sm grid-cols-2 gap-3">
          {PADS.map((pad, i) => (
            <button
              key={pad.color}
              onClick={() => press(i)}
              disabled={mode !== "repeat"}
              aria-label={`Botón ${i + 1}`}
              className="rounded-[28px] transition-all duration-100 active:scale-95 disabled:cursor-default"
              style={{
                background: lit === i ? pad.lit : pad.color,
                // Lighting a pad also lifts it, so it reads on a phone held at
                // arm's length by someone who is not looking that carefully.
                transform: lit === i ? "scale(1.04)" : undefined,
                boxShadow: lit === i ? `0 0 42px ${pad.lit}` : "inset 0 -6px 0 rgba(0,0,0,0.25)",
                opacity: mode === "repeat" || lit === i ? 1 : 0.75,
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-center gap-1.5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {sequence.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i < step ? "w-5 bg-amber-300" : "w-1.5 bg-white/20"
            }`}
          />
        ))}
      </div>

      {over && <SoloOver game="simon" score={round - 1} unit="rondas" onPlayAgain={begin} />}
    </main>
  );
}
