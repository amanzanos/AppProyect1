"use client";

import { useCallback, useEffect, useState } from "react";
import type { GameId } from "@/lib/gameCatalog";

/**
 * Solo runs: one phone, one player, a score to beat.
 *
 * The two-player games need a second phone and a big screen, which is a lot
 * to ask before anyone has decided they like this. Solo is the front door —
 * open the app, tap once, play.
 *
 * Progress is three stars per game rather than a raw number, because "1.240
 * points" means nothing to a seven-year-old and three stars means everything.
 */

export interface StarBands {
  /** Score needed for one, two and three stars. */
  one: number;
  two: number;
  three: number;
}

/** Tuned so a first go usually gets one star and three takes real practice. */
export const STAR_BANDS: Record<GameId, StarBands> = {
  darts: { one: 60, two: 130, three: 200 },
  bowling: { one: 45, two: 80, three: 110 },
  quiz: { one: 400, two: 800, three: 1200 },
  tennis: { one: 6, two: 14, three: 25 },
  // Tuned from playtests below: a first go lands one star, three takes work.
  moles: { one: 15, two: 35, three: 60 },
  simon: { one: 4, two: 8, three: 13 },
  odd: { one: 6, two: 14, three: 24 },
};

export function starsFor(gameId: GameId, score: number) {
  const band = STAR_BANDS[gameId];
  if (score >= band.three) return 3;
  if (score >= band.two) return 2;
  if (score >= band.one) return 1;
  return 0;
}

/** What's still to beat, for the nudge under the score. */
export function nextTarget(gameId: GameId, score: number) {
  const band = STAR_BANDS[gameId];
  if (score < band.one) return band.one;
  if (score < band.two) return band.two;
  if (score < band.three) return band.three;
  return null;
}

interface SoloBest {
  score: number;
  stars: number;
  runs: number;
}

const KEY = "blopy-solo";
const BLANK: SoloBest = { score: 0, stars: 0, runs: 0 };

type Store = Partial<Record<GameId, SoloBest>>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

export function soloBest(store: Store, gameId: GameId): SoloBest {
  return { ...BLANK, ...store[gameId] };
}

/** Files a finished run. Returns whether it beat the previous best. */
export function recordSolo(gameId: GameId, score: number) {
  const store = read();
  const previous = soloBest(store, gameId);
  const beaten = score > previous.score;
  const next: SoloBest = {
    score: Math.max(previous.score, score),
    stars: Math.max(previous.stars, starsFor(gameId, score)),
    runs: previous.runs + 1,
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...store, [gameId]: next }));
  } catch {
    // The run still happened, it just isn't remembered.
  }
  return { beaten, best: next };
}

/** Total stars across every game — the one number the hub shows off. */
export function totalStars(store: Store) {
  return Object.values(store).reduce((sum, entry) => sum + (entry?.stars ?? 0), 0);
}

export function useSolo() {
  const [store, setStore] = useState<Store>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage isn't readable during render
    setStore(read());
  }, []);

  const refresh = useCallback(() => setStore(read()), []);

  return { store, refresh };
}
