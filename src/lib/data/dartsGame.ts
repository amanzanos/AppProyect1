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

export const DARTS_COLLECTION = "dartsGames";

/**
 * Only the finished throw crosses the network — one write per dart. The live
 * crosshair stays on the phone that is aiming, because streaming it would
 * need far more writes a second than a Firestore document will take.
 */
export interface DartControl extends ControlBase {
  /** Where the player was aiming, in board radii. */
  x: number;
  y: number;
  /** 0-1: how clean the throw was, which sets the spread. */
  quality: number;
}

const BLANK = { x: 0, y: 0, quality: 0 };

export function createDartsRoom(roomId: string) {
  return createRoom(DARTS_COLLECTION, roomId, BLANK);
}

export function sendDartThrow(roomId: string, player: PlayerSlot, x: number, y: number, quality: number) {
  return sendControl(DARTS_COLLECTION, roomId, player, { x, y, quality });
}

export function useDartsRoom(roomId: string | null) {
  return useRoom<DartControl>(DARTS_COLLECTION, roomId);
}
