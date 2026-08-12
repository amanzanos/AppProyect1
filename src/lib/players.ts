"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Who is playing.
 *
 * The couple app this came from had exactly two people baked into the code.
 * Here the seats belong to whoever picked up a phone, and there can be up to
 * eight of them, so a seat's look is derived from its number and its name
 * comes from the phone sitting in it.
 *
 * Deliberately *not* an account: a party game's players change every night,
 * nobody wants to sign up for this, and every read we don't make is free tier
 * we don't spend. What little is remembered lives in localStorage on the
 * screen's own device.
 *
 * No import from gameRoom on purpose — that module needs `seatLook`, and a
 * cycle between the two would only be safe by accident.
 */
export interface Player {
  name: string;
  color: string;
  emoji: string;
}

/** Seat numbers are 1-based; the party decides how many there are. */
export type Players = Record<number, Player>;

/** Picked to stay apart on a projector and to survive colour-blind viewers. */
export const PALETTE = [
  "#e63946",
  "#4b6ef5",
  "#3fa34d",
  "#f0b429",
  "#9b5de5",
  "#f4802f",
  "#1f9ec4",
  "#ff6fb5",
] as const;

export const EMOJI = ["🦁", "🐙", "🐸", "🦊", "🦄", "🐼", "🦈", "🌸"] as const;

/**
 * What seat N looks like before anybody renames themselves. Pure, so the
 * screen and the phones always agree without having to ask each other.
 */
export function seatLook(slot: number): Player {
  const i = (slot - 1) % PALETTE.length;
  return { name: `Jugador ${slot}`, color: PALETTE[i], emoji: EMOJI[i] };
}

export const DEFAULT_PLAYERS: Players = {
  1: seatLook(1),
  2: seatLook(2),
};

const KEY = "blopy-players";

export function loadPlayers(): Players {
  if (typeof window === "undefined") return DEFAULT_PLAYERS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PLAYERS;
    const parsed = JSON.parse(raw) as Partial<Record<number, Partial<Player>>>;
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

  const update = useCallback((slot: number, patch: Partial<Player>) => {
    setPlayers((prev) => {
      const next: Players = { ...prev, [slot]: { ...prev[slot], ...patch } };
      savePlayers(next);
      return next;
    });
  }, []);

  return { players, update };
}
