"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlayerSlot } from "@/lib/data/gameRoom";

/**
 * Who is playing. The couple app this came from had exactly two people baked
 * into the code; here the two seats belong to whoever picked up the phones,
 * so they are named on the device and kept in localStorage.
 *
 * Deliberately *not* in Firestore: a party game's players change every night,
 * nobody wants an account for this, and every read we don't make is free tier
 * we don't spend.
 */
export interface Player {
  name: string;
  color: string;
  emoji: string;
}

export type Players = Record<PlayerSlot, Player>;

/** Picked to stay apart on a projector and to survive colour-blind viewers. */
export const PALETTE = [
  "#e63946",
  "#f4802f",
  "#f0b429",
  "#3fa34d",
  "#1f9ec4",
  "#4b6ef5",
  "#9b5de5",
  "#ff6fb5",
] as const;

export const EMOJI = ["🦁", "🌸", "🐙", "🦊", "🐸", "🦄", "🐼", "🦈", "👾", "🤖", "🐢", "🍀"] as const;

export const DEFAULT_PLAYERS: Players = {
  1: { name: "Jugador 1", color: "#e63946", emoji: "🦁" },
  2: { name: "Jugador 2", color: "#4b6ef5", emoji: "🐙" },
};

const KEY = "blopy-players";

export function loadPlayers(): Players {
  if (typeof window === "undefined") return DEFAULT_PLAYERS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PLAYERS;
    const parsed = JSON.parse(raw) as Partial<Record<PlayerSlot, Partial<Player>>>;
    return {
      1: { ...DEFAULT_PLAYERS[1], ...parsed[1] },
      2: { ...DEFAULT_PLAYERS[2], ...parsed[2] },
    };
  } catch {
    return DEFAULT_PLAYERS;
  }
}

export function savePlayers(players: Players) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(players));
  } catch {
    // Private browsing with storage denied — the defaults still play fine.
  }
}

/** Have the seats been named, or is this the first run? */
export function playersNamed() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(KEY) !== null;
}

/**
 * Starts from the defaults and swaps in what's stored after mount, so the
 * server-rendered markup and the first client render agree.
 */
export function usePlayers() {
  const [players, setPlayers] = useState<Players>(DEFAULT_PLAYERS);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage once on mount; it isn't available during render
    setPlayers(loadPlayers());
  }, []);

  const update = useCallback((slot: PlayerSlot, patch: Partial<Player>) => {
    setPlayers((prev) => {
      const next: Players = { ...prev, [slot]: { ...prev[slot], ...patch } };
      savePlayers(next);
      return next;
    });
  }, []);

  return { players, update };
}
