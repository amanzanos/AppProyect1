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

const COLLECTION = "tennisGames";

export interface TennisHit {
  at: number;
  power: number;
}

interface TennisControl extends ControlBase {
  power: number;
}

export interface TennisRoom {
  createdAt: number;
  player1Hit: TennisHit | null;
  player2Hit: TennisHit | null;
  player1Joined: boolean;
  player2Joined: boolean;
}

export function createTennisRoom(roomId: string, players?: object) {
  return createRoom(COLLECTION, roomId, { power: 0 }, players);
}

export function joinTennisRoom(roomId: string, player: PlayerSlot) {
  return joinRoom(COLLECTION, roomId, player, { power: 0 });
}

export function sendTennisHit(roomId: string, player: PlayerSlot, power: number) {
  return sendControl(COLLECTION, roomId, player, { power });
}

export function useTennisRoom(roomId: string | null): TennisRoom | null {
  const room = useRoom<TennisControl>(COLLECTION, roomId);
  if (!room) return null;
  return {
    createdAt: room.createdAt,
    player1Hit: room.p1 && { at: room.p1.at, power: room.p1.power },
    player2Hit: room.p2 && { at: room.p2.at, power: room.p2.power },
    player1Joined: room.joined1,
    player2Joined: room.joined2,
  };
}
