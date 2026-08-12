"use client";

import { useCallback, useEffect, useState } from "react";
import type { GameId } from "@/lib/gameCatalog";

/**
 * Records live on the device, not in Firestore.
 *
 * The version this came from wrote every result to one shared document per
 * game, which is exactly right when the whole userbase is two people and
 * exactly wrong here — every player in the world would be overwriting the same
 * row. Records belong to the console the game is played on, the same way an
 * arcade cabinet keeps its own high scores. It also means a match costs zero
 * reads and zero writes.
 *
 * A record is one number and a name, not a table by seat. Seats are handed out
 * in the order people scan the QR, so "seat 3" is a different person every
 * night and keeping a column per seat would be recording noise. What a party
 * actually argues about is the single best score and who holds it.
 */
export interface GameRecord {
  best: number;
  /** Whoever was sitting there when they scored it. Empty before any match. */
  holder: string;
  plays: number;
}

const BLANK: GameRecord = { best: 0, holder: "", plays: 0 };
const KEY = "blopy-records";

type Store = Partial<Record<GameId, GameRecord>>;

/** The shape written before rooms could hold more than two people. */
interface LegacyRecord {
  [slot: number]: { best?: number; wins?: number; plays?: number } | undefined;
}

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

/**
 * Reads a game's record, folding forward anything saved by the two-seat
 * version so an existing device doesn't look like it has never played.
 */
export function recordFor(store: Store, gameId: GameId): GameRecord {
  const found = store[gameId];
  if (!found) return { ...BLANK };
  if (typeof found.best === "number") return { ...BLANK, ...found };

  const legacy = found as unknown as LegacyRecord;
  let best = 0;
  let plays = 0;
  for (const stat of Object.values(legacy)) {
    if (!stat) continue;
    best = Math.max(best, stat.best ?? 0);
    plays += stat.plays ?? 0;
  }
  // The old shape kept a best per seat but never a name, so the holder is
  // genuinely unknown rather than blank-because-nobody-played.
  return { best, holder: "", plays };
}

export interface MatchResult {
  /** Null on a draw, or when nobody scored. */
  winnerName: string | null;
  /** The winning score — what the record is measured in. */
  best: number;
}

/** Folds a finished match in and returns the game's updated record. */
export function recordMatch(gameId: GameId, result: MatchResult): GameRecord {
  const store = read();
  const current = recordFor(store, gameId);
  const beat = result.best > current.best;
  const next: GameRecord = {
    best: Math.max(current.best, result.best),
    holder: beat && result.winnerName ? result.winnerName : current.holder,
    plays: current.plays + 1,
  };
  write({ ...store, [gameId]: next });
  return next;
}

/** Did this score beat everything that came before it? */
export function isNewRecord(record: GameRecord | null, score: number) {
  if (score <= 0) return false;
  return score > (record?.best ?? 0);
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
