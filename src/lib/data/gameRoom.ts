"use client";

import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";

/**
 * Shared plumbing for the games where a screen is the board and the phones are
 * the controllers: a short room code, a QR each, and a channel from each phone
 * back to the screen.
 *
 * Each controller gets its own document. Firestore only sustains about one
 * write a second to a single document, and two phones writing into the same
 * one queue behind each other — inputs reached the screen whole seconds late.
 * With a document per player neither phone can ever block the other.
 */

const ROOM_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — easy to read off a projector

export type PlayerSlot = 1 | 2;

export function randomRoomCode(length = 4) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)];
  }
  return code;
}

/** Everything a controller sends carries the time it happened. */
export interface ControlBase {
  at: number;
  joined: boolean;
}

function controlDoc(collection: string, roomId: string, player: PlayerSlot) {
  return doc(db, collection, roomId, "controls", `p${player}`);
}

export async function createRoom(collection: string, roomId: string, blank: object, players?: object) {
  await setDoc(doc(db, collection, roomId), {
    createdAt: Date.now(),
    player1Joined: false,
    player2Joined: false,
    turn: 1,
    round: -1,
    // The names and colours live on the screen's device. The phones have no
    // way to know them, so the room carries them across.
    players: players ?? null,
  });
  await Promise.all(
    ([1, 2] as const).map((p) => setDoc(controlDoc(collection, roomId, p), { at: 0, joined: false, ...blank }))
  );
}

export async function joinRoom(collection: string, roomId: string, player: PlayerSlot, blank: object) {
  await setDoc(controlDoc(collection, roomId, player), { at: 0, joined: true, ...blank });
  await updateDoc(doc(db, collection, roomId), { [`player${player}Joined`]: true });
}

/** One write per input. Keep these well under a write a second per player. */
export async function sendControl(collection: string, roomId: string, player: PlayerSlot, payload: object) {
  await setDoc(controlDoc(collection, roomId, player), { at: Date.now(), joined: true, ...payload });
}

export interface RoomState<C> {
  createdAt: number;
  joined1: boolean;
  joined2: boolean;
  /** Whose go it is. Written by the screen, read by the phones so they know
      when to wait; changes a handful of times a minute, not per frame. */
  turn: PlayerSlot;
  /** Which round is live, for games where both play at once. -1 before any. */
  round: number;
  /** The latest thing each controller sent, or null before anything. */
  p1: C | null;
  p2: C | null;
}

/**
 * Merges the room document and the two control documents into one object, so
 * the split write path stays invisible to the game loop reading it.
 */
export function useRoom<C extends ControlBase>(collection: string, roomId: string | null): RoomState<C> | null {
  const [room, setRoom] = useState<RoomState<C> | null>(null);

  useEffect(() => {
    if (!roomId) return;
    const state: RoomState<C> = { createdAt: 0, joined1: false, joined2: false, turn: 1, round: -1, p1: null, p2: null };
    const publish = () => setRoom({ ...state });

    const unsubs = [
      onSnapshot(doc(db, collection, roomId), (snap) => {
        const d = snap.data() as
          | { createdAt?: number; player1Joined?: boolean; player2Joined?: boolean; turn?: PlayerSlot; round?: number }
          | undefined;
        if (!d) return;
        state.createdAt = d.createdAt ?? 0;
        state.turn = d.turn ?? 1;
        state.round = d.round ?? -1;
        state.joined1 = state.joined1 || !!d.player1Joined;
        state.joined2 = state.joined2 || !!d.player2Joined;
        publish();
      }),
      ...([1, 2] as const).map((p) =>
        onSnapshot(controlDoc(collection, roomId, p), (snap) => {
          const d = snap.data() as C | undefined;
          if (!d) return;
          const latest = d.at > 0 ? d : null;
          if (p === 1) {
            state.p1 = latest;
            state.joined1 = state.joined1 || d.joined;
          } else {
            state.p2 = latest;
            state.joined2 = state.joined2 || d.joined;
          }
          publish();
        })
      ),
    ];

    return () => unsubs.forEach((u) => u());
  }, [collection, roomId]);

  return room;
}

/** Announce whose go it is. Called by the screen between darts, not per frame. */
export async function setTurn(collection: string, roomId: string, turn: PlayerSlot) {
  await updateDoc(doc(db, collection, roomId), { turn });
}

/** Announce which round is live. One write per question, not per frame. */
export async function setRound(collection: string, roomId: string, round: number) {
  await updateDoc(doc(db, collection, roomId), { round });
}
