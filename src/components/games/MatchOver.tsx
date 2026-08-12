"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import PrizeWheel from "@/components/games/PrizeWheel";
import { showInterstitial } from "@/lib/ads";
import { isNewRecord, recordMatch, useGameRecord } from "@/lib/records";
import type { PlayerSlot, Seat } from "@/lib/data/gameRoom";
import type { GameId } from "@/lib/gameCatalog";

interface MatchOverProps {
  game: GameId;
  seats: Record<PlayerSlot, Seat>;
  scores: Record<PlayerSlot, number>;
  unit: string;
  onPlayAgain: () => void;
  onExit: () => void;
}

/**
 * The end of a match, shared by every game: the final table, whether it beat a
 * record, and then the winner's spin of the wheel.
 *
 * This is also the one place an ad is allowed to appear. It runs between
 * matches, never over the board, and never before the result is on screen — an
 * interstitial that eats the winning moment is the fastest way to make someone
 * uninstall a party game.
 */
export default function MatchOver({ game, seats, scores, unit, onPlayAgain, onExit }: MatchOverProps) {
  const record = useGameRecord(game);
  const [stage, setStage] = useState<"result" | "wheel" | "done">("result");
  const [beatRecord, setBeatRecord] = useState(false);
  const saved = useRef(false);

  /** Everyone who played, best first. */
  const table = useMemo(() => {
    return Object.keys(seats)
      .map(Number)
      .map((slot) => ({ slot, seat: seats[slot], score: scores[slot] ?? 0 }))
      .sort((a, b) => b.score - a.score);
  }, [seats, scores]);

  const top = table[0];
  // A draw at the top has no winner — and with more than two playing, the tie
  // that matters is between first and second, not across the whole table.
  const drawn = table.length > 1 && table[1].score === top?.score;
  const winner = !top || drawn ? null : top;

  // Folded in once. Whether it beat a record has to be judged against the
  // figures from before this match was counted, so it's worked out first.
  useEffect(() => {
    if (saved.current || record === null) return;
    saved.current = true;
    const best = winner?.score ?? 0;
    setBeatRecord(isNewRecord(record, best));
    recordMatch(game, { winnerName: winner?.seat.name ?? null, best });
  }, [record, game, winner]);

  // The forfeit is paid at the table, not tracked — landing on it is all the
  // app needs to do.
  const claim = useCallback(() => setStage("done"), []);

  /** Play again, with an ad break every few matches. */
  const again = useCallback(() => {
    showInterstitial().finally(onPlayAgain);
  }, [onPlayAgain]);

  if (stage === "wheel" && winner) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,#7c4dea_0%,#3b1f86_60%,#1b1040_100%)] px-5 py-8">
        <PrizeWheel winnerName={winner.seat.name} onClaim={claim} onSkip={() => setStage("done")} />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 overflow-y-auto bg-black/80 px-6 py-8 text-center backdrop-blur-sm">
      <span className="text-5xl">🏆</span>
      <p className="font-heading text-3xl font-black text-white">
        {winner ? `¡Gana ${winner.seat.name}!` : "¡Empate!"}
      </p>

      {/* The full table, because with six people the interesting question is
          usually who came second-to-last. */}
      <ol className="flex w-full max-w-xs flex-col gap-1.5">
        {table.map((row, i) => (
          <li
            key={row.slot}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left"
            style={{ background: i === 0 && winner ? `${row.seat.color}33` : "rgba(255,255,255,0.06)" }}
          >
            <span className="w-4 shrink-0 text-center font-heading text-xs font-black text-white/40">{i + 1}</span>
            <span className="shrink-0 text-lg">{row.seat.emoji}</span>
            <span className="min-w-0 flex-1 truncate font-heading text-sm font-bold text-white">
              {row.seat.name}
            </span>
            <span className="tnum shrink-0 font-heading text-lg font-black text-white">{row.score}</span>
          </li>
        ))}
      </ol>

      {beatRecord && winner && (
        <p className="animate-pop-in rounded-full bg-amber-400 px-4 py-1.5 font-heading text-xs font-black uppercase tracking-wide text-amber-950">
          ¡Récord! {winner.score} {unit}
        </p>
      )}

      {stage === "result" && winner ? (
        <button
          onClick={() => setStage("wheel")}
          className="mt-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-8 py-3.5 font-heading text-lg font-black text-white shadow-xl active:scale-95"
        >
          🎡 Girar la ruleta
        </button>
      ) : null}

      <div className="mt-1 flex gap-3">
        <button
          onClick={again}
          className="flex items-center gap-1.5 rounded-full bg-white px-6 py-3 font-heading font-black text-neutral-900 active:scale-95"
        >
          <RotateCcw size={16} /> Otra
        </button>
        <button
          onClick={onExit}
          className="rounded-full bg-white/20 px-6 py-3 font-heading font-black text-white active:scale-95"
        >
          Salir
        </button>
      </div>
    </div>
  );
}
