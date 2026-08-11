"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import PrizeWheel from "@/components/games/PrizeWheel";
import { showInterstitial } from "@/lib/ads";
import { isNewRecord, recordMatch, useGameRecord } from "@/lib/records";
import { usePlayers } from "@/lib/players";
import type { PlayerSlot } from "@/lib/data/gameRoom";
import type { GameId } from "@/lib/gameCatalog";

interface MatchOverProps {
  game: GameId;
  /** Null on a draw. */
  winner: PlayerSlot | null;
  scores: Record<PlayerSlot, number>;
  unit: string;
  onPlayAgain: () => void;
  onExit: () => void;
}

/**
 * The end of a match, shared by every game: the result, whether it beat a
 * record, and then the winner's spin of the wheel.
 *
 * This is also the one place an ad is allowed to appear. It runs between
 * matches, never over the board, and never before the result is on screen —
 * an interstitial that eats the winning moment is the fastest way to make
 * someone uninstall a party game.
 */
export default function MatchOver({ game, winner, scores, unit, onPlayAgain, onExit }: MatchOverProps) {
  const { players } = usePlayers();
  const record = useGameRecord(game);
  const [stage, setStage] = useState<"result" | "wheel" | "done">("result");
  const [beatRecord, setBeatRecord] = useState(false);
  const saved = useRef(false);

  // Folded in once. Whether it beat a record has to be judged against the
  // figures from before this match was counted, so it's worked out first.
  useEffect(() => {
    if (saved.current || record === null) return;
    saved.current = true;
    const isBest = winner ? isNewRecord(record, winner, scores[winner]) : false;
    recordMatch(game, { winner, scores });
    setBeatRecord(isBest);
  }, [record, game, winner, scores]);

  // The forfeit is paid at the table, not tracked — landing on it is all
  // the app needs to do.
  const claim = useCallback(() => setStage("done"), []);

  /** Play again, with an ad break every few matches. */
  const again = useCallback(() => {
    showInterstitial().finally(onPlayAgain);
  }, [onPlayAgain]);

  if (stage === "wheel" && winner) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,#7c4dea_0%,#3b1f86_60%,#1b1040_100%)] px-5 py-8">
        <PrizeWheel winnerName={players[winner].name} onClaim={claim} onSkip={() => setStage("done")} />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 px-8 text-center backdrop-blur-sm">
      <span className="text-5xl">🏆</span>
      <p className="font-heading text-3xl font-black text-white">
        {winner ? `¡Gana ${players[winner].name}!` : "¡Empate!"}
      </p>
      <p className="tnum font-heading text-lg font-black tracking-widest text-white/80">
        {scores[1]} · {scores[2]}
      </p>

      {beatRecord && winner && (
        <p className="animate-pop-in rounded-full bg-amber-400 px-4 py-1.5 font-heading text-xs font-black uppercase tracking-wide text-amber-950">
          ¡Récord! {scores[winner]} {unit}
        </p>
      )}

      {stage === "result" && winner ? (
        <button
          onClick={() => setStage("wheel")}
          className="mt-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-8 py-3.5 font-heading text-lg font-black text-white shadow-xl active:scale-95"
        >
          🎡 Girar la ruleta
        </button>
      ) : null}

      <div className="mt-2 flex gap-3">
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
