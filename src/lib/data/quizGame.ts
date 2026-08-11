"use client";

import {
  createRoom,
  joinRoom,
  randomRoomCode,
  sendControl,
  useRoom,
  type ControlBase,
  type PlayerSlot,
} from "@/lib/data/gameRoom";

export { randomRoomCode };
export type { PlayerSlot };

const COLLECTION = "quizGames";

/** One write per player per question. */
export interface Answer {
  at: number;
  /** Which question it was for, so a late tap can't score the next one. */
  round: number;
  choice: number;
}

interface QuizControl extends ControlBase {
  round: number;
  choice: number;
}

const BLANK = { round: -1, choice: -1 };

export function createQuizRoom(roomId: string, players?: object) {
  return createRoom(COLLECTION, roomId, BLANK, players);
}

export function joinQuizRoom(roomId: string, player: PlayerSlot) {
  return joinRoom(COLLECTION, roomId, player, BLANK);
}

export function sendAnswer(roomId: string, player: PlayerSlot, round: number, choice: number) {
  return sendControl(COLLECTION, roomId, player, { round, choice });
}

export interface QuizRoom {
  player1Answer: Answer | null;
  player2Answer: Answer | null;
  player1Joined: boolean;
  player2Joined: boolean;
  /** The question the screen is showing, or -1 between questions. */
  round: number;
}

export function useQuizRoom(roomId: string | null): QuizRoom | null {
  const room = useRoom<QuizControl>(COLLECTION, roomId);
  if (!room) return null;
  const pick = (c: QuizControl | null) => (c ? { at: c.at, round: c.round, choice: c.choice } : null);
  return {
    player1Answer: pick(room.p1),
    player2Answer: pick(room.p2),
    player1Joined: room.joined1,
    player2Joined: room.joined2,
    round: room.round,
  };
}
