"use client";

import { doc, onSnapshot, runTransaction, setDoc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db, firebaseConfigured } from "@/lib/firebase";
import { ensureSignedIn } from "@/lib/data/signIn";
import { seatLook } from "@/lib/players";

/**
 * Shared plumbing for the games where a screen is the board and the phones are
 * the controllers: a room code, one QR for everybody, and a channel from each
 * phone back to the screen.
 *
 * Each controller gets its own document. Firestore only sustains about one
 * write a second to a single document, and phones writing into the same one
 * queue behind each other — inputs reached the screen whole seconds late. With
 * a document per player nobody can block anybody else, and it's the reason
 * this scales past two: the write path doesn't get busier as people join.
 *
 * Seats are claimed by the phones, not handed out by the screen. The old
 * design printed one QR per player and each code carried its slot number,
 * which caps the party at however many codes fit on a television. Now there is
 * a single code, and joining runs a transaction that takes the lowest free
 * seat — so the screen never has to know in advance how many people turned up.
 */

const ROOM_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — easy to read off a projector

/** Eight is the point where names stop fitting legibly across a TV. */
export const MAX_PLAYERS = 8;

/** 1-based seat number. Not a union any more: the party sets the size. */
export type PlayerSlot = number;

/** Who is sitting in a seat, as the whole room sees them. */
export interface Seat {
  name: string;
  color: string;
  emoji: string;
}

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

/** Every write goes through here, so one check covers every game. */
function offline() {
  return !firebaseConfigured;
}

export async function createRoom(collection: string, roomId: string, blank: object) {
  if (offline()) return;
  await ensureSignedIn();
  // Control documents are written when a seat is claimed rather than up front:
  // eight blank writes on every room creation is seven wasted in the common
  // case, and `sendControl` creates the document anyway.
  await setDoc(doc(db, collection, roomId), {
    createdAt: Date.now(),
    turn: 1,
    round: -1,
    seats: {},
    blank,
  });
}

/** Why a phone didn't get a seat, so it can say something useful. */
export type ClaimResult =
  | { ok: true; slot: PlayerSlot }
  | { ok: false; reason: "full" | "unreachable" };

/**
 * How long to wait for the seat before calling it a lost cause.
 *
 * Firestore's SDK retries a failed transaction indefinitely and never rejects
 * on its own, so without a deadline a phone on hotel wifi sits on "finding you
 * a seat" forever with nothing to tap. Fifteen seconds is well past a slow but
 * working connection and well short of the point where somebody puts the phone
 * down.
 */
const CLAIM_TIMEOUT_MS = 15_000;

/**
 * Take the lowest free seat, atomically.
 *
 * The transaction matters: two people scanning the same code at the same
 * moment is the normal case in a room full of people, not an edge case, and a
 * plain read-then-write would hand them both seat 1.
 */
export async function claimSeat(collection: string, roomId: string, name?: string): Promise<ClaimResult> {
  if (offline()) return { ok: false, reason: "unreachable" };

  const roomRef = doc(db, collection, roomId);
  const claim = (async (): Promise<ClaimResult> => {
    await ensureSignedIn();
    const slot = await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      // No room document means the screen never managed to create it — which
      // is the same "can't reach the database" problem, seen from here.
      if (!snap.exists()) throw new Error("no room");
      const seats = (snap.data().seats ?? {}) as Record<string, Seat>;
      for (let i = 1; i <= MAX_PLAYERS; i++) {
        if (seats[String(i)]) continue;
        const look = seatLook(i);
        tx.update(roomRef, { [`seats.${i}`]: { ...look, name: name?.trim() || look.name } });
        return i;
      }
      return 0;
    });
    return slot ? { ok: true, slot } : { ok: false, reason: "full" };
  })();

  try {
    return await Promise.race([
      claim,
      new Promise<ClaimResult>((resolve) =>
        setTimeout(() => resolve({ ok: false, reason: "unreachable" }), CLAIM_TIMEOUT_MS)
      ),
    ]);
  } catch {
    // A contended transaction that ran out of retries, or the room isn't there.
    return { ok: false, reason: "unreachable" };
  }
}

/** Rename yourself once you're in. One write, whenever they finish typing. */
export async function renameSeat(collection: string, roomId: string, slot: PlayerSlot, name: string) {
  if (offline()) return;
  await ensureSignedIn();
  await updateDoc(doc(db, collection, roomId), { [`seats.${slot}.name`]: name.trim() || `Jugador ${slot}` });
}

/** Give up a seat, so somebody else can take it. */
export async function leaveSeat(collection: string, roomId: string, slot: PlayerSlot) {
  if (offline()) return;
  await ensureSignedIn();
  try {
    await updateDoc(doc(db, collection, roomId), { [`seats.${slot}`]: null });
  } catch {
    // Leaving is best-effort: the room is disposable either way.
  }
}

/** One write per input. Keep these well under a write a second per player. */
export async function sendControl(collection: string, roomId: string, player: PlayerSlot, payload: object) {
  if (offline()) return;
  await ensureSignedIn();
  await setDoc(controlDoc(collection, roomId, player), { at: Date.now(), joined: true, ...payload });
}

export interface RoomState<C> {
  createdAt: number;
  /** Whose go it is. Written by the screen, read by the phones so they know
      when to wait; changes a handful of times a minute, not per frame. */
  turn: PlayerSlot;
  /** Which round is live, for games where everyone plays at once. -1 before any. */
  round: number;
  /** Who is in, by seat number. */
  seats: Record<PlayerSlot, Seat>;
  /** The claimed seats in order — the play order, and the scoreboard order. */
  slots: PlayerSlot[];
  /** The latest thing each controller sent, by seat. */
  controls: Record<PlayerSlot, C | null>;
}

const EMPTY_SEATS: Record<PlayerSlot, Seat> = {};

/**
 * Merges the room document and every control document into one object, so the
 * split write path stays invisible to the game loop reading it.
 */
export function useRoom<C extends ControlBase>(collection: string, roomId: string | null): RoomState<C> | null {
  const [room, setRoom] = useState<RoomState<C> | null>(null);

  useEffect(() => {
    if (!roomId || !firebaseConfigured) return;
    // Captured, because the narrowing above does not reach into `subscribe`:
    // that function could in principle be called later, when roomId is null
    // again.
    const room = roomId;
    const state: RoomState<C> = {
      createdAt: 0,
      turn: 1,
      round: -1,
      seats: EMPTY_SEATS,
      slots: [],
      controls: {},
    };
    const publish = () => setRoom({ ...state, controls: { ...state.controls } });

    // Subscribing before the anonymous sign-in lands gets a terminal
    // permission-denied that kills the listener for good — it does not retry.
    let live = true;
    let unsubs: (() => void)[] = [];
    void ensureSignedIn().then(() => {
      if (live) unsubs = subscribe();
    });

    function subscribe() {
      return [
        onSnapshot(doc(db, collection, room), (snap) => {
          const d = snap.data() as
            | { createdAt?: number; turn?: number; round?: number; seats?: Record<string, Seat | null> }
            | undefined;
          if (!d) return;
          state.createdAt = d.createdAt ?? 0;
          state.turn = d.turn ?? 1;
          state.round = d.round ?? -1;
          const seats: Record<PlayerSlot, Seat> = {};
          for (const [key, seat] of Object.entries(d.seats ?? {})) {
            // A seat given up is written as null rather than deleted, so the
            // room document keeps a stable shape.
            if (seat) seats[Number(key)] = seat;
          }
          state.seats = seats;
          state.slots = Object.keys(seats)
            .map(Number)
            .sort((a, b) => a - b);
          publish();
        }),
        // Every seat is watched from the start, claimed or not. Listening to a
        // handful of documents that may never exist is cheaper than tearing
        // subscriptions up and down as people wander in.
        ...Array.from({ length: MAX_PLAYERS }, (_, i) => i + 1).map((p) =>
          onSnapshot(controlDoc(collection, room, p), (snap) => {
            const d = snap.data() as C | undefined;
            state.controls[p] = d && d.at > 0 ? d : null;
            publish();
          })
        ),
      ];
    }

    return () => {
      live = false;
      unsubs.forEach((u) => u());
    };
  }, [collection, roomId]);

  return room;
}

/** Announce whose go it is. Called by the screen between turns, not per frame. */
export async function setTurn(collection: string, roomId: string, turn: PlayerSlot) {
  if (offline()) return;
  await ensureSignedIn();
  await updateDoc(doc(db, collection, roomId), { turn });
}

/** Announce which round is live. One write per round, not per frame. */
export async function setRound(collection: string, roomId: string, round: number) {
  if (offline()) return;
  await ensureSignedIn();
  await updateDoc(doc(db, collection, roomId), { round });
}

/** The seat after this one, wrapping — the turn order for the turn-based games. */
export function nextSlot(slots: PlayerSlot[], current: PlayerSlot): PlayerSlot {
  if (slots.length === 0) return current;
  const i = slots.indexOf(current);
  return slots[(i + 1) % slots.length] ?? slots[0];
}
