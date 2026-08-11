"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import SoloOver from "@/components/SoloOver";
import { buzz, sfx, shake } from "@/lib/juice";

const HOLES = 9;
const ROUND_MS = 30_000;
/** How long a mole stays up at the start, and at the very end. */
const SHOW_START = 1250;
const SHOW_END = 520;
/** Gap between one popping and the next. */
const GAP_START = 620;
const GAP_END = 240;
/** Roughly one in six is a bomb, once they start appearing. */
const BOMB_AFTER_MS = 6000;
const BOMB_CHANCE = 0.17;

type Critter = { hole: number; bomb: boolean; id: number } | null;

/**
 * Whack-a-mole.
 *
 * The simplest game in here by a distance — a grid, a timer and one thing at
 * a time — and almost certainly the one a small child plays the longest. It
 * needs no instructions: something pops up, you hit it.
 *
 * The bombs are what stop it being a metronome. Without something you must
 * *not* hit, tapping every hole as fast as possible is the optimal strategy
 * and the game plays itself.
 */
export default function MolesPage() {
  const router = useRouter();
  const [critter, setCritter] = useState<Critter>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [left, setLeft] = useState(ROUND_MS);
  const [over, setOver] = useState(false);
  const [flash, setFlash] = useState<{ hole: number; good: boolean; id: number } | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const startedAt = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hit = useRef(false);
  const nextId = useRef(1);
  /** Bumped to start a fresh round; both effects below key off it. */
  const [run, setRun] = useState(0);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    // Replaced rather than emptied in place — a ref holding a growing array
    // that everything mutates is how these get impossible to reason about.
    timers.current = [];
  };

  const remember = (id: ReturnType<typeof setTimeout>) => {
    timers.current = [...timers.current, id];
  };

  /** Difficulty is a straight ramp across the round, not steps. */
  const pace = useCallback((elapsed: number) => {
    const t = Math.min(elapsed / ROUND_MS, 1);
    return {
      show: SHOW_START + (SHOW_END - SHOW_START) * t,
      gap: GAP_START + (GAP_END - GAP_START) * t,
      bombs: elapsed > BOMB_AFTER_MS,
    };
  }, []);

  /** The loop schedules itself, so it goes through a ref — a useCallback
      can't reference the binding it is being assigned to. */
  const popRef = useRef<() => void>(() => {});

  const pop = useCallback(() => {
    const elapsed = Date.now() - startedAt.current;
    if (elapsed >= ROUND_MS) {
      setOver(true);
      return;
    }
    const { show, gap, bombs } = pace(elapsed);
    hit.current = false;
    const next: Critter = {
      hole: Math.floor(Math.random() * HOLES),
      bomb: bombs && Math.random() < BOMB_CHANCE,
      id: nextId.current++,
    };
    setCritter(next);

    remember(
      setTimeout(() => {
        setCritter(null);
        // Letting a mole escape breaks the run; letting a bomb go is correct.
        if (!hit.current && !next.bomb) setStreak(0);
        remember(setTimeout(() => popRef.current(), gap));
      }, show)
    );
  }, [pace]);

  useEffect(() => {
    popRef.current = pop;
  }, [pop]);

  const begin = useCallback(() => {
    setScore(0);
    setStreak(0);
    setLeft(ROUND_MS);
    setCritter(null);
    setOver(false);
    setRun((n) => n + 1);
  }, []);

  // Timers and the clock are external systems, so the whole round lives in
  // effects keyed on the run counter. Reading the time or scheduling work
  // during render is what makes a component impure.
  useEffect(() => {
    clearTimers();
    startedAt.current = Date.now();
    remember(setTimeout(pop, 500));
    return clearTimers;
  }, [run, pop]);

  // The clock, and the last-five-seconds ticking that makes people panic.
  useEffect(() => {
    const id = setInterval(() => {
      const remaining = Math.max(ROUND_MS - (Date.now() - startedAt.current), 0);
      setLeft(remaining);
      if (remaining > 0 && remaining <= 5000 && remaining % 1000 < 110) sfx.tick();
      if (remaining === 0) {
        setOver(true);
        clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }, [run]);

  function whack(hole: number) {
    if (over || !critter || critter.hole !== hole || hit.current) return;
    hit.current = true;
    const wasBomb = critter.bomb;
    setCritter(null);
    setFlash({ hole, good: !wasBomb, id: critter.id });

    if (wasBomb) {
      // Costs points and the run, but never ends the game — a kid who just
      // lost everything on one tap puts the phone down.
      setScore((s) => Math.max(0, s - 3));
      setStreak(0);
      sfx.miss();
      buzz([0, 60, 40, 60]);
      shake(stageRef.current, 14);
      return;
    }

    const nextStreak = streak + 1;
    setStreak(nextStreak);
    setScore((s) => s + 1 + Math.floor(nextStreak / 5));
    sfx.combo(nextStreak);
    buzz(25);
  }

  const seconds = Math.ceil(left / 1000);

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
          <p className="tnum font-heading text-3xl font-black leading-none">{score}</p>
          {streak > 2 && (
            <p className="animate-pop-in tnum text-[11px] font-black uppercase tracking-wide text-amber-300">
              ×{streak} seguidos
            </p>
          )}
        </div>
        <p className={`tnum w-10 text-right font-heading text-2xl font-black ${seconds <= 5 ? "text-red-400" : ""}`}>
          {seconds}
        </p>
      </div>

      <div className="mx-4 mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-lime-300 to-amber-400 transition-[width] duration-100"
          style={{ width: `${(left / ROUND_MS) * 100}%` }}
        />
      </div>

      <div ref={stageRef} className="flex flex-1 items-center justify-center px-5">
        <div className="grid w-full max-w-sm grid-cols-3 gap-3">
          {Array.from({ length: HOLES }).map((_, hole) => {
            const here = critter?.hole === hole ? critter : null;
            const lit = flash?.hole === hole ? flash : null;
            return (
              <button
                key={hole}
                onClick={() => whack(hole)}
                aria-label={`Agujero ${hole + 1}`}
                // Holes need to read as holes from across a room: a lighter
                // fill than the page, a lit rim, and a deep inner shadow.
                className="relative flex aspect-square items-center justify-center rounded-3xl bg-[#3b2570] ring-1 ring-white/10 shadow-[inset_0_10px_18px_rgba(0,0,0,0.55),0_2px_0_rgba(255,255,255,0.06)] active:scale-95"
              >
                {here && (
                  <span key={here.id} className="animate-pop-in text-[13vw] leading-none sm:text-5xl">
                    {here.bomb ? "💣" : "🐹"}
                  </span>
                )}
                {lit && !here && (
                  <span
                    key={lit.id}
                    className="animate-pop-in absolute inset-2 rounded-2xl"
                    style={{ background: lit.good ? "rgba(74,222,128,0.35)" : "rgba(248,113,113,0.4)" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <p className="pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center text-xs font-semibold text-white/40">
        Dale a los topos · esquiva las bombas
      </p>

      {over && <SoloOver game="moles" score={score} unit="puntos" onPlayAgain={begin} />}
    </main>
  );
}
