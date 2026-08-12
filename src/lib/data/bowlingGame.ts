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

export const BOWLING_COLLECTION = "bowlingGames";

/**
 * Only the finished delivery crosses the network — one write per ball. The
 * live aiming line stays on the phone doing the aiming, because streaming it
 * would need far more writes a second than a Firestore document will take.
 */
export interface BowlControl extends ControlBase {
  /** Where it left the foul line, in half-lane widths. */
  aim: number;
  power: number;
  /** Hook: negative bends it left. */
  spin: number;
}

const BLANK = { aim: 0, power: 0, spin: 0 };

export function createBowlingRoom(roomId: string) {
  return createRoom(BOWLING_COLLECTION, roomId, BLANK);
}

export function sendDelivery(roomId: string, player: PlayerSlot, aim: number, power: number, spin: number) {
  return sendControl(BOWLING_COLLECTION, roomId, player, { aim, power, spin });
}

export function useBowlingRoom(roomId: string | null) {
  return useRoom<BowlControl>(BOWLING_COLLECTION, roomId);
}
