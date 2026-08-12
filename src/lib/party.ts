"use client";

/**
 * The party's own memory, across every game played tonight.
 *
 * Records live on the device already (`records.ts`), but that's an all-time
 * high score board — the console's, not the party's. This is a different
 * thing: a running scoreboard for *this visit*, closed the moment the tab
 * does. sessionStorage rather than localStorage is the whole trick — it
 * already clears itself when the party's over, so there's nothing to expire
 * or clean up on purpose.
 *
 * Players are matched across games by name, not by seat: seats are handed out
 * by scan order and mean something different in every room, but a name typed
 * into two different phones the same night is honestly the same person.
 */
import { useCallback, useEffect, useState } from "react";
import type { PlayerSlot, Seat } from "@/lib/data/gameRoom";
import type { GameId } from "@/lib/gameCatalog";

interface MatchEntry {
  name: string;
  emoji: string;
  color: string;
  score: number;
  won: boolean;
}

export interface SessionMatch {
  gameId: GameId;
  at: number;
  entries: MatchEntry[];
}

const KEY = "blopy-party";

function read(): SessionMatch[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.sessionStorage.getItem(KEY) ?? "[]") as SessionMatch[];
  } catch {
    return [];
  }
}

function write(matches: SessionMatch[]) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(matches));
  } catch {
    // Private browsing with storage denied — the match still happened, the
    // recap just won't remember it.
  }
}

/** Folds one finished match into tonight's scoreboard. */
export function recordSessionMatch(
  gameId: GameId,
  seats: Record<PlayerSlot, Seat>,
  scores: Record<PlayerSlot, number>,
  winner: PlayerSlot | null
) {
  const entries: MatchEntry[] = Object.keys(seats).map((key) => {
    const slot = Number(key);
    const seat = seats[slot];
    return { name: seat.name.trim() || "Jugador", emoji: seat.emoji, color: seat.color, score: scores[slot] ?? 0, won: slot === winner };
  });
  if (entries.length === 0) return;
  write([...read(), { gameId, at: Date.now(), entries }]);
}

export function clearParty() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}

export function useParty() {
  const [matches, setMatches] = useState<SessionMatch[]>([]);

  const refresh = useCallback(() => setMatches(read()), []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage isn't readable during render
    refresh();
  }, [refresh]);

  return { matches, refresh };
}

interface PlayerTally {
  name: string;
  emoji: string;
  color: string;
  wins: number;
  plays: number;
  points: number;
  /** Best single score, and which game it came in — for the specialist awards. */
  bestByGame: Partial<Record<GameId, number>>;
}

function tally(matches: SessionMatch[]): Map<string, PlayerTally> {
  const byName = new Map<string, PlayerTally>();
  for (const match of matches) {
    for (const e of match.entries) {
      const key = e.name.toLocaleLowerCase("es");
      const row = byName.get(key) ?? { name: e.name, emoji: e.emoji, color: e.color, wins: 0, plays: 0, points: 0, bestByGame: {} };
      row.plays += 1;
      row.points += e.score;
      if (e.won) row.wins += 1;
      row.bestByGame[match.gameId] = Math.max(row.bestByGame[match.gameId] ?? 0, e.score);
      // The most recent look wins — if someone changed their emoji mid-party,
      // the card should show who they are now, not who they were an hour ago.
      row.name = e.name;
      row.emoji = e.emoji;
      row.color = e.color;
      byName.set(key, row);
    }
  }
  return byName;
}

export interface Award {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  name: string;
  color: string;
  stat: string;
}

/**
 * Turns a pile of match results into the handful of superlatives worth
 * putting on screen. Every award needs a genuine, undisputed leader — a tie
 * for first drops the category rather than picking one arbitrarily, because
 * nothing sours a party game faster than declaring a winner who didn't win.
 */
export function computeAwards(matches: SessionMatch[]): Award[] {
  const players = [...tally(matches).values()];
  const awards: Award[] = [];
  if (players.length === 0) return awards;

  const uniqueTop = (rows: PlayerTally[], by: (p: PlayerTally) => number): PlayerTally | null => {
    const sorted = [...rows].filter((p) => by(p) > 0).sort((a, b) => by(b) - by(a));
    if (sorted.length === 0) return null;
    if (sorted.length > 1 && by(sorted[0]) === by(sorted[1])) return null;
    return sorted[0];
  };

  const mvp = uniqueTop(players, (p) => p.wins * 1000 + p.points);
  if (mvp) {
    awards.push({
      id: "mvp",
      title: "MVP de la noche",
      subtitle: mvp.wins > 0 ? `${mvp.wins} ${mvp.wins === 1 ? "partida ganada" : "partidas ganadas"}` : "el más regular",
      emoji: "👑",
      name: mvp.name,
      color: mvp.color,
      stat: String(mvp.points),
    });
  }

  if (players.length > 1) {
    const social = uniqueTop(players, (p) => p.plays);
    if (social && social.plays >= 2) {
      awards.push({
        id: "fiestero",
        title: "El más fiestero",
        subtitle: `jugó ${social.plays} partidas`,
        emoji: "🎉",
        name: social.name,
        color: social.color,
        stat: String(social.plays),
      });
    }

    // Invicto: played at least two games and won every single one.
    const flawless = players.find((p) => p.plays >= 2 && p.wins === p.plays);
    const others = players.filter((p) => p !== flawless);
    if (flawless && !others.some((p) => p.plays >= 2 && p.wins === p.plays)) {
      awards.push({
        id: "invicto",
        title: "Invicto/a",
        subtitle: `${flawless.wins} de ${flawless.wins} — sin perder ni una`,
        emoji: "🔥",
        name: flawless.name,
        color: flawless.color,
        stat: `${flawless.wins}/${flawless.plays}`,
      });
    }
  }

  const games = [...new Set(matches.map((m) => m.gameId))];
  for (const gameId of games) {
    // Only worth a card if more than one person actually posted a score —
    // "top scorer" among one person isn't an award, it's just the score.
    const inThisGame = players.filter((p) => p.bestByGame[gameId] !== undefined);
    if (inThisGame.length < 2) continue;
    const specialist = uniqueTop(inThisGame, (p) => p.bestByGame[gameId] ?? 0);
    if (!specialist) continue;
    awards.push({
      id: `best-${gameId}`,
      title: GAME_AWARD_TITLE[gameId] ?? "El mejor puesto",
      subtitle: "récord de la noche en este juego",
      emoji: GAME_AWARD_EMOJI[gameId] ?? "⭐",
      name: specialist.name,
      color: specialist.color,
      stat: String(specialist.bestByGame[gameId]),
    });
  }

  return awards;
}

const GAME_AWARD_TITLE: Partial<Record<GameId, string>> = {
  quiz: "El más listo",
  darts: "Puntería de acero",
  bowling: "Rey o reina de la bolera",
  tennis: "El mejor saque",
  karaoke: "La voz de la fiesta",
};

const GAME_AWARD_EMOJI: Partial<Record<GameId, string>> = {
  quiz: "🧠",
  darts: "🎯",
  bowling: "🎳",
  tennis: "🎾",
  karaoke: "🎤",
};
