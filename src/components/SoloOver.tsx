"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { RotateCcw, Star } from "lucide-react";
import { showInterstitial } from "@/lib/ads";
import { buzz, sfx } from "@/lib/juice";
import { nextTarget, recordSolo, starsFor } from "@/lib/solo";
import type { GameId } from "@/lib/gameCatalog";

/** "puntos" -> "punto". Spanish plurals here are all a trailing -s. */
function singular(unit: string) {
  return unit.endsWith("s") ? unit.slice(0, -1) : unit;
}

/**
 * The end of a solo run.
 *
 * The stars land one at a time with a rising note each, which is the whole
 * point of the screen: a number going up is information, three stars thumping
 * in one after another is a reason to press "otra vez".
 */
export default function SoloOver({
  game,
  score,
  unit,
  onPlayAgain,
}: {
  game: GameId;
  score: number;
  unit: string;
  onPlayAgain: () => void;
}) {
  const router = useRouter();
  const stars = starsFor(game, score);
  const [shown, setShown] = useState(0);
  const [result, setResult] = useState<{ beaten: boolean; best: number } | null>(null);
  // Filing a run is not idempotent — it bumps the run counter and moves the
  // best. React runs this effect twice in development, which counted every
  // run as two and turned "new record" into "your record" on the very run
  // that set it.
  const filed = useRef(false);

  useEffect(() => {
    if (filed.current) return;
    filed.current = true;
    const run = recordSolo(game, score);
    setResult({ beaten: run.beaten, best: run.best.score });

    const timers = [
      // Each star gets its own beat so they read as three events, not one.
      ...Array.from({ length: stars }, (_, i) =>
        setTimeout(() => {
          setShown(i + 1);
          sfx.star(i);
          buzz(30);
        }, 350 + i * 420)
      ),
      setTimeout(
        () => {
          if (stars === 3) {
            confetti({ particleCount: 160, spread: 100, origin: { y: 0.4 }, colors: ["#ffc94d", "#8b5cf6", "#4ade80"] });
            sfx.big();
          } else if (stars === 0) {
            sfx.finish();
          }
        },
        350 + stars * 420
      ),
    ];
    return () => timers.forEach(clearTimeout);
  }, [game, score, stars]);

  const target = nextTarget(game, score);

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[radial-gradient(circle_at_50%_0%,#4b2ea8_0%,#2b1a5e_55%,#1b1040_100%)] px-8 text-center">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <Star
            key={i}
            size={54}
            strokeWidth={2}
            className={`transition-all duration-300 ${
              i < shown ? "scale-110 text-amber-300" : "scale-90 text-white/15"
            }`}
            fill={i < shown ? "currentColor" : "none"}
          />
        ))}
      </div>

      <div>
        <p className="tnum font-heading text-6xl font-black leading-none text-white">{score}</p>
        <p className="mt-1 text-sm font-bold uppercase tracking-[0.2em] text-white/40">{unit}</p>
      </div>

      {result?.beaten && score > 0 ? (
        <p className="animate-pop-in rounded-full bg-amber-400 px-5 py-2 font-heading text-sm font-black uppercase tracking-wide text-amber-950">
          ¡Nuevo récord!
        </p>
      ) : (
        result && result.best > 0 && (
          <p className="tnum text-sm font-semibold text-white/45">Tu récord: {result.best}</p>
        )
      )}

      {target !== null && (
        <p className="tnum max-w-[26ch] text-sm leading-snug text-white/60">
          {target - score} {target - score === 1 ? singular(unit) : unit} más para la siguiente
          estrella
        </p>
      )}

      <div className="mt-2 flex flex-col items-center gap-3">
        <button
          onClick={() => {
            sfx.tap();
            showInterstitial().finally(onPlayAgain);
          }}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-10 py-4 font-heading text-xl font-black text-white shadow-xl active:scale-95"
        >
          <RotateCcw size={20} strokeWidth={3} /> Otra vez
        </button>
        <button
          onClick={() => {
            sfx.tap();
            router.push("/games");
          }}
          className="rounded-full bg-white/15 px-8 py-3 font-heading font-black text-white active:scale-95"
        >
          Menú
        </button>
      </div>
    </div>
  );
}
