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

const COLLECTION = "bowlingGames";

/**
 * Only the finished delivery crosses the network — one write per ball. The
 * live aiming line stays on the phone doing the aiming, because streaming it
 * would need far more writes a second than a Firestore document will take.
 */
export interface Delivery {
  at: number;
  /** Where it left the foul line, in half-lane widths. */
  aim: number;
  power: number;
  /** Hook: negative bends it left. */
  spin: number;
}

interface BowlControl extends ControlBase {
  aim: number;
  power: number;
  spin: number;
}

const BLANK = { aim: 0, power: 0, spin: 0 };

export function createBowlingRoom(roomId: string, players?: object) {
  return createRoom(COLLECTION, roomId, BLANK, players);
}

export function joinBowlingRoom(roomId: string, player: PlayerSlot) {
  return joinRoom(COLLECTION, roomId, player, BLANK);
}

export function sendDelivery(roomId: string, player: PlayerSlot, aim: number, power: number, spin: number) {
  return sendControl(COLLECTION, roomId, player, { aim, power, spin });
}

export interface BowlingRoom {
  player1Ball: Delivery | null;
  player2Ball: Delivery | null;
  player1Joined: boolean;
  player2Joined: boolean;
  turn: PlayerSlot;
}

export function useBowlingRoom(roomId: string | null): BowlingRoom | null {
  const room = useRoom<BowlControl>(COLLECTION, roomId);
  if (!room) return null;
  const pick = (c: BowlControl | null) => (c ? { at: c.at, aim: c.aim, power: c.power, spin: c.spin } : null);
  return {
    player1Ball: pick(room.p1),
    player2Ball: pick(room.p2),
    player1Joined: room.joined1,
    player2Joined: room.joined2,
    turn: room.turn,
  };
}
