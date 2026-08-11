"use client";

import { useRef, useState } from "react";
import confetti from "canvas-confetti";
import { RefreshCw } from "lucide-react";
import { PRIZES, type PrizeDef } from "@/lib/prizes";
import { vibrateSuccess } from "@/lib/haptics";

const SEG = 360 / PRIZES.length;
/** Whole turns before it settles, so the stop still feels earned. */
const SPINS = 6;
const SPIN_MS = 4200;
/** How long the winning wedge is lit up before the coupon takes over. */
const HIGHLIGHT_MS = 900;

const DEEP = "#5b34c0";
const LIGHT = "#7c4dea";
const GOLD = "#f5a524";
const RIM = "#ffc94d";

/** A point at `r` (0-1 of the wheel radius), `deg` clockwise from straight up. */
function at(r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return [50 + r * 50 * Math.sin(rad), 50 - r * 50 * Math.cos(rad)] as const;
}

/** Break a prize onto two lines so it stays inside its wedge. */
function wrap(label: string) {
  if (label.length <= 10) return [label];
  const words = label.split(" ");
  const half = Math.ceil(words.length / 2);
  return [words.slice(0, half).join(" "), words.slice(half).join(" ")];
}

function wedge(a0: number, a1: number, r = 1) {
  const [x0, y0] = at(r, a0);
  const [x1, y1] = at(r, a1);
  return `M 50 50 L ${x0} ${y0} A ${r * 50} ${r * 50} 0 0 1 ${x1} ${y1} Z`;
}

/** Gold coin tumbling down the side of the wheel. */
function Coin({ className, size }: { className: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden>
      <circle cx="20" cy="20" r="19" fill="#e0921a" />
      <circle cx="20" cy="18.5" r="17" fill="#ffc94d" />
      <circle cx="20" cy="18.5" r="12.5" fill="#f5a524" />
      <text x="20" y="19.5" fontSize="13" textAnchor="middle" dominantBaseline="central" fill="#fff3cf">
        ★
      </text>
    </svg>
  );
}

interface PrizeWheelProps {
  /** Who is spinning — they name the forfeit. */
  winnerName: string;
  onClaim: (prize: PrizeDef) => void;
  onSkip: () => void;
}

/** The winner's spin: one turn of the wheel, one forfeit for the loser. */
export default function PrizeWheel({ winnerName, onClaim, onSkip }: PrizeWheelProps) {
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [lit, setLit] = useState<number | null>(null);
  const [prize, setPrize] = useState<PrizeDef | null>(null);
  const picked = useRef<{ prize: PrizeDef; index: number } | null>(null);

  function spin() {
    if (spinning || prize) return;
    setSpinning(true);
    const index = Math.floor(Math.random() * PRIZES.length);
    picked.current = { prize: PRIZES[index], index };
    // Bring the chosen wedge's middle round to the pointer at the top.
    setAngle(360 * SPINS - (index * SEG + SEG / 2));
  }

  function settle() {
    const won = picked.current;
    if (!won) return;
    setSpinning(false);
    setLit(won.index);
    vibrateSuccess();
    confetti({ particleCount: 140, spread: 90, origin: { y: 0.45 }, colors: ["#f5a524", "#8b5cf6", "#f472b6"] });
    // A beat with the wedge lit before the coupon, so you see what you landed on.
    setTimeout(() => setPrize(won.prize), HIGHLIGHT_MS);
  }

  if (prize) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-[32px] bg-white px-6 py-8 text-center shadow-2xl">
        <p className="font-heading text-2xl font-black leading-none text-violet-700">¡Prenda!</p>
        <div
          className="w-full rounded-[22px] px-5 py-6 text-white"
          style={{ background: prize.color }}
        >
          <p className="font-heading text-3xl font-black uppercase leading-none tracking-tight">{prize.label}</p>
          <p className="mt-2.5 text-sm font-semibold leading-snug text-white/85">{prize.detail}</p>
        </div>
        <button
          onClick={() => onClaim(prize)}
          className="w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-3.5 font-heading text-lg font-black text-white shadow-lg active:scale-95"
        >
          Hecho
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-sm overflow-hidden rounded-[32px] bg-white pb-8 pt-7 shadow-2xl">
      {/* Coins tumbling down the side, as in the reference. */}
      <Coin className="absolute -left-1 top-28 -rotate-12" size={34} />
      <Coin className="absolute left-6 top-48 rotate-12" size={24} />
      <Coin className="absolute left-1 top-64 -rotate-6 opacity-90" size={19} />

      <div className="px-8 text-center">
        <p className="font-heading text-3xl font-black leading-none text-violet-800">Gira la ruleta</p>
        <p className="mt-1 text-xs font-semibold text-neutral-400">
          {winnerName} gana — la prenda la paga el otro
        </p>
      </div>

      <div className="relative mx-auto mt-5 w-[86%]">
        {/* pointer */}
        <div className="absolute left-1/2 top-[-10px] z-10 h-0 w-0 -translate-x-1/2 border-x-[15px] border-t-[26px] border-x-transparent border-t-rose-500 drop-shadow-md" />

        <svg
          viewBox="0 0 100 100"
          className="aspect-square w-full drop-shadow-xl"
          style={{
            transform: `rotate(${angle}deg)`,
            transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.16, 0.86, 0.22, 1)` : undefined,
          }}
          onTransitionEnd={settle}
          aria-hidden
        >
          <circle cx="50" cy="50" r="50" fill={RIM} />
          {PRIZES.map((t, i) => (
            <path
              key={t.id}
              d={wedge(i * SEG + 0.4, (i + 1) * SEG - 0.4, 0.94)}
              fill={lit === i ? GOLD : i % 2 === 0 ? DEEP : LIGHT}
            />
          ))}
          {PRIZES.map((t, i) => {
            const mid = i * SEG + SEG / 2;
            const [x, y] = at(0.6, mid);
            const lines = wrap(t.label);
            // Past the halfway point the wedge is under the wheel, where the
            // same rotation would leave the words upside down.
            const spin = mid > 90 && mid < 270 ? mid + 180 : mid;
            return (
              <text
                key={t.id}
                x={x}
                y={y}
                fill={lit === i ? "#4a2600" : "#ffffff"}
                fontSize="4"
                fontWeight="800"
                textAnchor="middle"
                transform={`rotate(${spin} ${x} ${y})`}
              >
                {lines.map((line, n) => (
                  <tspan key={n} x={x} dy={n === 0 ? (lines.length - 1) * -2.2 : 4.6}>
                    {line}
                  </tspan>
                ))}
              </text>
            );
          })}
          {/* gold studs around the rim, like the reference */}
          {PRIZES.map((t, i) => {
            const [x, y] = at(0.97, i * SEG);
            return <circle key={t.id} cx={x} cy={y} r="1.1" fill="#fff3cf" />;
          })}
        </svg>

        <button
          onClick={spin}
          disabled={spinning || lit !== null}
          aria-label="Girar la ruleta"
          className="absolute left-1/2 top-1/2 flex h-[22%] w-[22%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-violet-700 shadow-[0_6px_16px_rgba(74,32,160,0.45)] transition active:scale-95 disabled:opacity-80"
        >
          <RefreshCw className="h-1/2 w-1/2" strokeWidth={3} />
        </button>
      </div>

      <div className="mt-6 text-center">
        <button
          onClick={onSkip}
          className="text-[11px] font-bold uppercase tracking-wide text-neutral-300 underline underline-offset-4"
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
