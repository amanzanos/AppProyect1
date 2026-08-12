"use client";

import {
  createRoom,
  randomRoomCode,
  sendControl,
  useRoom,
  type ControlBase,
  type PlayerSlot,
} from "@/lib/data/gameRoom";

export { randomRoomCode };
export type { PlayerSlot };

export const QUIZ_COLLECTION = "quizGames";

/** One write per player per question. */
export interface QuizControl extends ControlBase {
  /** Which question it was for, so a late tap can't score the next one. */
  round: number;
  choice: number;
}

const BLANK = { round: -1, choice: -1 };

export function createQuizRoom(roomId: string) {
  return createRoom(QUIZ_COLLECTION, roomId, BLANK);
}

export function sendAnswer(roomId: string, player: PlayerSlot, round: number, choice: number) {
  return sendControl(QUIZ_COLLECTION, roomId, player, { round, choice });
}

export function useQuizRoom(roomId: string | null) {
  return useRoom<QuizControl>(QUIZ_COLLECTION, roomId);
}
