"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlayerSlot } from "@/lib/data/gameRoom";
import type { GameId } from "@/lib/gameCatalog";

/**
 * Records live on the device, not in Firestore.
 *
 * The version this came from wrote every result to one shared document per
 * game, which is exactly right when the whole userbase is two people and
 * exactly wrong here — every player in the world would be overwriting the
 * same row. Records belong to the console the game is played on, the same way
 * an arcade cabinet keeps its own high scores.
 *
 * It also means a match costs zero reads and zero writes.
 */
export interface PlayerStat {
  best: number;
  wins: number;
  plays: number;
}

export type GameRecord = Record<PlayerSlot, PlayerStat>;

const BLANK: PlayerStat = { best: 0, wins: 0, plays: 0 };
const KEY = "pique-records";

function blankRecord(): GameRecord {
  return { 1: { ...BLANK }, 2: { ...BLANK } };
}

type Store = Partial<Record<GameId, GameRecord>>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Nothing to do — the match still played, it just isn't remembered.
  }
}

export function recordFor(store: Store, gameId: GameId): GameRecord {
  const found = store[gameId];
  if (!found) return blankRecord();
  return { 1: { ...BLANK, ...found[1] }, 2: { ...BLANK, ...found[2] } };
}

/** Who holds the outright record for a game, and what it is. */
export function bestOf(record: GameRecord): { best: number; holder: PlayerSlot } | null {
  const best = Math.max(record[1].best, record[2].best);
  if (best === 0) return null;
  return { best, holder: record[1].best >= record[2].best ? 1 : 2 };
}

export interface MatchResult {
  /** Null on a draw. */
  winner: PlayerSlot | null;
  scores: Record<PlayerSlot, number>;
}

/** Folds a finished match in and returns the game's updated record. */
export function recordMatch(gameId: GameId, result: MatchResult): GameRecord {
  const store = read();
  const current = recordFor(store, gameId);
  const next = blankRecord();

  for (const slot of [1, 2] as const) {
    const score = result.scores[slot] ?? 0;
    next[slot] = {
      best: Math.max(current[slot].best, score),
      wins: current[slot].wins + (result.winner === slot ? 1 : 0),
      plays: current[slot].plays + 1,
    };
  }

  write({ ...store, [gameId]: next });
  return next;
}

/** Did this score beat everything that came before it? */
export function isNewRecord(record: GameRecord | null, slot: PlayerSlot, score: number) {
  if (score <= 0) return false;
  return score > (record?.[slot].best ?? 0);
}

/** Every game's record, for the hub. Re-reads when a match is folded in. */
export function useRecords() {
  const [store, setStore] = useState<Store>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage isn't readable during render
    setStore(read());
  }, []);

  const refresh = useCallback(() => setStore(read()), []);

  return { store, refresh };
}

export function useGameRecord(gameId: GameId) {
  const [record, setRecord] = useState<GameRecord | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage isn't readable during render
    setRecord(recordFor(read(), gameId));
  }, [gameId]);

  return record;
}

export function clearRecords() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Same as above.
  }
}
