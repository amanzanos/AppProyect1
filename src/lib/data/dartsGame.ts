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

const COLLECTION = "dartsGames";

/**
 * Only the finished throw crosses the network — one write per dart. The live
 * crosshair stays on the phone that is aiming, because streaming it would
 * need far more writes a second than a Firestore document will take.
 */
export interface DartThrow {
  at: number;
  /** Where the player was aiming, in board radii. */
  x: number;
  y: number;
  /** 0-1: how clean the throw was, which sets the spread. */
  quality: number;
}

interface DartControl extends ControlBase {
  x: number;
  y: number;
  quality: number;
}

const BLANK = { x: 0, y: 0, quality: 0 };

export function createDartsRoom(roomId: string, players?: object) {
  return createRoom(COLLECTION, roomId, BLANK, players);
}

export function joinDartsRoom(roomId: string, player: PlayerSlot) {
  return joinRoom(COLLECTION, roomId, player, BLANK);
}

export function sendDartThrow(roomId: string, player: PlayerSlot, x: number, y: number, quality: number) {
  return sendControl(COLLECTION, roomId, player, { x, y, quality });
}

export interface DartsRoom {
  player1Throw: DartThrow | null;
  player2Throw: DartThrow | null;
  player1Joined: boolean;
  player2Joined: boolean;
  /** Whose go it is, so a phone knows when to wait. */
  turn: PlayerSlot;
}

export function useDartsRoom(roomId: string | null): DartsRoom | null {
  const room = useRoom<DartControl>(COLLECTION, roomId);
  if (!room) return null;
  const pick = (c: DartControl | null) => (c ? { at: c.at, x: c.x, y: c.y, quality: c.quality } : null);
  return {
    player1Throw: pick(room.p1),
    player2Throw: pick(room.p2),
    player1Joined: room.joined1,
    player2Joined: room.joined2,
    turn: room.turn,
  };
}
