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

export const TENNIS_COLLECTION = "tennisGames";

/** Tennis is the one duel: two seats, one each side of the net. */
export const TENNIS_MAX_PLAYERS = 2;

export interface TennisControl extends ControlBase {
  power: number;
}

export function createTennisRoom(roomId: string) {
  return createRoom(TENNIS_COLLECTION, roomId, { power: 0 });
}

export function sendTennisHit(roomId: string, player: PlayerSlot, power: number) {
  return sendControl(TENNIS_COLLECTION, roomId, player, { power });
}

export function useTennisRoom(roomId: string | null) {
  return useRoom<TennisControl>(TENNIS_COLLECTION, roomId);
}
