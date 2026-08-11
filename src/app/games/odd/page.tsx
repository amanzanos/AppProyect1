"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import SoloOver from "@/components/SoloOver";
import { buzz, sfx, shake } from "@/lib/juice";

const ROUND_MS = 45_000;
/** Wrong taps cost time rather than ending the run. */
const PENALTY_MS = 3000;

/**
 * Grid size by level. It stops growing at 6×6 — beyond that the squares are
 * smaller than a fingertip on a phone and it becomes a game about your
 * eyesight rather than your attention.
 */
function gridFor(level: number) {
  return Math.min(2 + Math.floor(level / 2), 6);
}

/**
 * How different the odd one is, as a fraction of a full hue step. Shrinks
 * with every level, which is the entire difficulty curve — no other knob.
 */
function contrastFor(level: number) {
  return Math.max(0.06, 0.42 - level * 0.028);
}

interface Board {
  size: number;
  odd: number;
  base: string;
  different: string;
}

/**
 * A board is a pure function of the level and a seed, rather than something
 * that reaches for Math.random() as it renders. The seed is bumped in the tap
 * handler, which keeps rendering side-effect free and means a board can be
 * rebuilt identically at any point.
 */
function makeBoard(level: number, seed: number): Board {
  const size = gridFor(level);
  // Cheap deterministic hash — plenty for choosing a hue and a square.
  const mix = (n: number) => {
    const x = Math.sin(seed * 374.761 + n * 91.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const hue = Math.floor(mix(1) * 360);
  const light = 58;
  const delta = contrastFor(level) * 40;
  return {
    size,
    odd: Math.floor(mix(2) * size * size),
    base: `hsl(${hue} 72% ${light}%)`,
    // Only lightness moves. Changing hue as well makes it far easier, and
    // unfair to anyone colour-blind.
    different: `hsl(${hue} 72% ${light + delta}%)`,
  };
}

/**
 * Spot the odd square.
 *
 * About a hundred lines, no assets, no physics — and the format behind a
 * whole genre of enormously popular puzzle apps. It works because the
 * difficulty is one continuous number rather than a set of levels somebody
 * had to design, so it fits any age automatically: a four-year-old plays the
 * first few boards, an adult grinds toward level twenty.
 */
export default function OddPage() {
  const router = useRouter();
  const [level, setLevel] = useState(0);
  const [seed, setSeed] = useState(1);
  const [left, setLeft] = useState(ROUND_MS);
  const [over, setOver] = useState(false);
  const [wrong, setWrong] = useState<number | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  /** Wall-clock deadline. Owned by the effect below, adjusted by taps. */
  const deadline = useRef(0);
  /** Bumped to start a fresh run; the clock effect keys off it. */
  const [run, setRun] = useState(0);

  const begin = useCallback(() => {
    setLevel(0);
    setSeed((n) => n + 1);
    setLeft(ROUND_MS);
    setWrong(null);
    setOver(false);
    setRun((n) => n + 1);
  }, []);

  const board = makeBoard(level, seed);

  // The clock is an external system, so it lives entirely in here: reading
  // the time during render (or in a callback built during render) is what
  // makes a component impure.
  useEffect(() => {
    deadline.current = Date.now() + ROUND_MS;
    const id = setInterval(() => {
      const remaining = Math.max(deadline.current - Date.now(), 0);
      setLeft(remaining);
      if (remaining > 0 && remaining <= 5000 && remaining % 1000 < 110) sfx.tick();
      if (remaining === 0) {
        setOver(true);
        clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }, [run]);

  function tap(index: number) {
    if (over) return;

    if (index !== board.odd) {
      // Time, not lives. A timer running down is tension; a life lost is a
      // punishment, and one of those makes children stop playing.
      deadline.current -= PENALTY_MS;
      setWrong(index);
      sfx.wrong();
      buzz([0, 70, 40, 70]);
      shake(stageRef.current, 10);
      setTimeout(() => setWrong(null), 320);
      return;
    }

    setLevel(level + 1);
    setSeed((n) => n + 1);
    sfx.combo(level + 1);
    buzz(22);
    // A small time bonus, so a good run can outlast the clock.
    deadline.current += 1200;
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
          <p className="tnum font-heading text-3xl font-black leading-none">{level}</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">aciertos</p>
        </div>
        <p className={`tnum w-10 text-right font-heading text-2xl font-black ${seconds <= 5 ? "text-red-400" : ""}`}>
          {seconds}
        </p>
      </div>

      <div className="mx-4 mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-sky-500 transition-[width] duration-100"
          style={{ width: `${Math.min((left / ROUND_MS) * 100, 100)}%` }}
        />
      </div>

      <div ref={stageRef} className="flex flex-1 items-center justify-center px-5">
        <div
          className="grid aspect-square w-full max-w-sm gap-2"
          style={{ gridTemplateColumns: `repeat(${board.size}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: board.size * board.size }).map((_, i) => (
            <button
              key={i}
              onClick={() => tap(i)}
              aria-label={`Casilla ${i + 1}`}
              className="rounded-2xl transition-transform active:scale-90"
              style={{
                background: i === board.odd ? board.different : board.base,
                outline: wrong === i ? "3px solid #f87171" : undefined,
              }}
            />
          ))}
        </div>
      </div>

      <p className="pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center text-xs font-semibold text-white/40">
        Toca el cuadrado que no es igual
      </p>

      {over && <SoloOver game="odd" score={level} unit="aciertos" onPlayAgain={begin} />}
    </main>
  );
}
