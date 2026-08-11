"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import Dartboard, { BOARD_EXTENT } from "@/components/games/Dartboard";
import SoloOver from "@/components/SoloOver";
import { FLIGHT_S, aimedThrow, flightPoint, scoreAt, type Flight } from "@/lib/darts";
import { buzz, sfx, shake } from "@/lib/juice";

const DARTS = 6;
const SETTLE_MS = 900;
/** How far the sweeping guides travel, in board radii. */
const SWEEP = 0.92;

type Aiming = "x" | "y" | "flying";

/**
 * Darts on one phone.
 *
 * Aiming is two taps, not a drag: a vertical line sweeps across, you tap to
 * fix it, then a horizontal line sweeps down and you tap again. It's the
 * mechanic every arcade archery game uses, and it's the reason a five-year-old
 * can play this — one finger, no precision, and the tension of a moving line
 * does the work that a difficulty setting would otherwise have to.
 *
 * The two-player version needs a second phone and a television. This needs a
 * bus seat.
 */
export default function DartsSoloPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Aiming>("x");
  const [thrown, setThrown] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [over, setOver] = useState(false);
  const [landed, setLanded] = useState<{ x: number; y: number }[]>([]);
  const [popup, setPopup] = useState<{ x: number; y: number; label: string; id: number } | null>(null);
  /** Where the vertical guide was stopped. State, not a ref: it changes once
      per throw, and the line has to keep showing it while the horizontal one
      sweeps. */
  const [lockedX, setLockedX] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const guideXRef = useRef<SVGLineElement>(null);
  const guideYRef = useRef<SVGLineElement>(null);
  const dartRef = useRef<SVGGElement>(null);
  const rafRef = useRef(0);
  const sweepRef = useRef(0);
  /** Where the guides were stopped, in board coordinates. */
  const aim = useRef({ x: 0, y: 0 });
  const phaseRef = useRef<Aiming>("x");

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // The sweep runs for as long as the screen is up, driven straight onto the
  // line's attributes — nothing in React needs to know where it is.
  useEffect(() => {
    if (over) return;
    let raf = 0;
    const started = performance.now();
    const step = (now: number) => {
      // Speeds up as the round goes on, so the last darts are the hard ones.
      const speed = 0.0016 + thrown * 0.00022;
      const pos = Math.sin((now - started) * speed) * SWEEP;
      sweepRef.current = pos;
      const active = phaseRef.current;
      if (active === "x") {
        guideXRef.current?.setAttribute("x1", String(pos));
        guideXRef.current?.setAttribute("x2", String(pos));
      } else if (active === "y") {
        guideYRef.current?.setAttribute("y1", String(pos));
        guideYRef.current?.setAttribute("y2", String(pos));
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [thrown, over]);

  const finish = useCallback(
    (f: Flight) => {
      const hit = scoreAt(f.x, f.y);
      setLanded((l) => [...l, { x: f.x, y: f.y }]);
      setPopup({ x: f.x, y: f.y, label: hit.label, id: Date.now() });

      // A run of scoring darts multiplies — the thing that turns six throws
      // into a reason to try again.
      const nextStreak = hit.value > 0 ? streak + 1 : 0;
      const multiplier = 1 + Math.floor(nextStreak / 2) * 0.5;
      const gained = Math.round(hit.value * multiplier);
      setStreak(nextStreak);
      setScore((s) => s + gained);

      if (hit.value === 0) {
        sfx.miss();
        buzz(60);
      } else if (hit.kind === "bullseye" || hit.kind === "triple") {
        sfx.big();
        buzz([0, 40, 60, 90]);
        shake(stageRef.current, 12);
      } else {
        sfx.hit();
        if (nextStreak > 1) sfx.combo(nextStreak);
        buzz(35);
        shake(stageRef.current, 5, 180);
      }

      const count = thrown + 1;
      setThrown(count);

      setTimeout(() => {
        setPopup(null);
        dartRef.current?.setAttribute("display", "none");
        if (count >= DARTS) {
          setOver(true);
          return;
        }
        setPhase("x");
      }, SETTLE_MS);
    },
    [streak, thrown]
  );

  const fly = useCallback(
    (f: Flight) => {
      const el = dartRef.current;
      el?.removeAttribute("display");
      const started = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - started) / 1000, FLIGHT_S);
        const p = flightPoint(f, t);
        const scale = 2.4 - 1.4 * (t / FLIGHT_S);
        el?.setAttribute("transform", `translate(${p.x} ${p.y}) rotate(-16) scale(${scale})`);
        if (t < FLIGHT_S) {
          rafRef.current = requestAnimationFrame(step);
          return;
        }
        finish(f);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [finish]
  );

  function tap() {
    if (over) return;
    if (phase === "x") {
      aim.current.x = sweepRef.current;
      setLockedX(sweepRef.current);
      sfx.tap();
      buzz(20);
      setPhase("y");
      return;
    }
    if (phase === "y") {
      aim.current.y = sweepRef.current;
      sfx.launch();
      buzz(25);
      setPhase("flying");
      // Full quality: where you stopped the lines *is* the aim. The challenge
      // lives in the moving guides, so adding hidden scatter on top would only
      // read as the game cheating.
      fly(aimedThrow(aim.current.x, aim.current.y, 1));
    }
  }

  function again() {
    setPhase("x");
    setLockedX(0);
    setThrown(0);
    setScore(0);
    setStreak(0);
    setLanded([]);
    setPopup(null);
    setOver(false);
  }

  const multiplier = 1 + Math.floor(streak / 2) * 0.5;

  return (
    <main className="fixed inset-0 flex touch-none select-none flex-col bg-[#141019] text-white">
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
          {streak > 1 && (
            <p className="animate-pop-in tnum text-[11px] font-black uppercase tracking-wide text-amber-300">
              racha ×{multiplier}
            </p>
          )}
        </div>

        <div className="flex w-10 justify-end gap-1">
          {Array.from({ length: DARTS }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${i < DARTS - thrown ? "bg-white/80" : "bg-white/20"}`}
            />
          ))}
        </div>
      </div>

      <div ref={stageRef} className="flex flex-1 items-center justify-center px-4">
        <svg viewBox={`${-BOARD_EXTENT} ${-BOARD_EXTENT} ${BOARD_EXTENT * 2} ${BOARD_EXTENT * 2}`} className="w-full max-w-md">
          <Dartboard />

          {landed.map((d, i) => (
            <g key={i} transform={`translate(${d.x} ${d.y}) rotate(-16)`} opacity="0.85">
              <rect x="-0.006" y="0" width="0.012" height="0.17" fill="#dfe4ec" />
              <path d="M -0.05 0.34 L 0 0.21 L 0.05 0.34 L 0 0.29 Z" fill="#ffc94d" />
            </g>
          ))}

          {/* Aiming guides. The one you're setting is bright, the one already
              locked stays dim so you can see what you chose. */}
          {phase !== "flying" && (
            <line
              ref={guideXRef}
              x1={lockedX}
              y1={-BOARD_EXTENT}
              x2={lockedX}
              y2={BOARD_EXTENT}
              stroke={phase === "x" ? "#ffc94d" : "#ffffff"}
              strokeOpacity={phase === "x" ? 0.95 : 0.3}
              strokeWidth="0.012"
            />
          )}
          {phase === "y" && (
            <line
              ref={guideYRef}
              x1={-BOARD_EXTENT}
              y1={0}
              x2={BOARD_EXTENT}
              y2={0}
              stroke="#ffc94d"
              strokeOpacity="0.95"
              strokeWidth="0.012"
            />
          )}

          <g ref={dartRef} display="none">
            <rect x="-0.006" y="0" width="0.012" height="0.17" fill="#dfe4ec" />
            <rect x="-0.021" y="0.15" width="0.042" height="0.12" rx="0.012" fill="#6f7788" />
            <path d="M -0.062 0.41 L 0 0.26 L 0.062 0.41 L 0 0.35 Z" fill="#ffc94d" />
          </g>

          {popup && (
            <text
              key={popup.id}
              className="dart-pop"
              x={popup.x}
              y={popup.y - 0.1}
              textAnchor="middle"
              fontSize="0.19"
              fontWeight="900"
              fill="#ffc94d"
              stroke="#141019"
              strokeWidth="0.02"
              paintOrder="stroke"
            >
              {popup.label}
            </text>
          )}
        </svg>
      </div>

      <button
        onClick={tap}
        disabled={phase === "flying"}
        className="mx-4 mb-[calc(1.25rem+env(safe-area-inset-bottom))] rounded-[26px] bg-gradient-to-r from-amber-400 to-orange-500 py-5 font-heading text-2xl font-black text-white shadow-xl transition active:scale-95 disabled:opacity-40"
      >
        {phase === "x" ? "PARAR ↔" : phase === "y" ? "PARAR ↕" : "..."}
      </button>

      {over && <SoloOver game="darts" score={score} unit="puntos" onPlayAgain={again} />}
    </main>
  );
}
