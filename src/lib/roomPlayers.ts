"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { db, firebaseConfigured } from "@/lib/firebase";
import { ensureSignedIn } from "@/lib/data/signIn";
import { claimSeat, renameSeat, type PlayerSlot, type Seat } from "@/lib/data/gameRoom";
import { seatLook } from "@/lib/players";

/**
 * The room's seats, as seen from a phone.
 *
 * The screen no longer owns the players — the phones name themselves — so a
 * controller reads the seat list straight off the room document.
 */
export function useRoomSeats(collection: string, roomId: string | null): Record<PlayerSlot, Seat> {
  const [seats, setSeats] = useState<Record<PlayerSlot, Seat>>({});

  useEffect(() => {
    if (!roomId || !firebaseConfigured) return;
    let live = true;
    let unsub: (() => void) | null = null;
    void ensureSignedIn().then(() => {
      if (!live) return;
      unsub = onSnapshot(doc(db, collection, roomId), (snap) => {
        const stored = (snap.data() as { seats?: Record<string, Seat | null> } | undefined)?.seats;
        const next: Record<PlayerSlot, Seat> = {};
        for (const [key, seat] of Object.entries(stored ?? {})) {
          if (seat) next[Number(key)] = seat;
        }
        setSeats(next);
      });
    });
    return () => {
      live = false;
      unsub?.();
    };
  }, [collection, roomId]);

  return seats;
}

function seatKey(collection: string, roomId: string) {
  return `blopy-seat-${collection}-${roomId}`;
}

export type SeatStatus = "claiming" | "seated" | "full" | "unreachable" | "offline";

/**
 * Claims a seat for this phone and hangs onto it.
 *
 * The seat number is remembered against the room code, so locking the phone,
 * switching apps or reloading mid-game puts you back in the same chair rather
 * than taking a second one and leaving a ghost on the scoreboard.
 */
export function useMySeat(collection: string, roomId: string | null) {
  const [slot, setSlot] = useState<PlayerSlot | null>(null);
  const [claimed, setClaimed] = useState<Exclude<SeatStatus, "offline">>("claiming");
  /** Bumped by the retry button to run the claim again. */
  const [attempt, setAttempt] = useState(0);
  // Whether there's a backend at all is a build-time fact, not something to
  // discover and store — derived here so the effect never has to set it.
  const status: SeatStatus = firebaseConfigured ? claimed : "offline";
  const seats = useRoomSeats(collection, roomId);
  // Claiming runs a transaction; without this guard React mounting the effect
  // twice in development would burn a second seat on every load.
  const claiming = useRef(false);

  useEffect(() => {
    if (!roomId || !firebaseConfigured || claiming.current) return;
    claiming.current = true;
    setClaimed("claiming");

    const key = seatKey(collection, roomId);
    let live = true;

    void (async () => {
      let remembered = 0;
      try {
        remembered = Number(window.localStorage.getItem(key) ?? 0);
      } catch {
        // Storage denied; fall through to claiming a fresh seat.
      }
      if (remembered > 0) {
        if (!live) return;
        setSlot(remembered);
        setClaimed("seated");
        return;
      }
      const result = await claimSeat(collection, roomId);
      if (!live) return;
      if (result.ok) {
        try {
          window.localStorage.setItem(key, String(result.slot));
        } catch {
          // You keep the seat for this page view; a reload would take a fresh
          // one. Better than refusing to let somebody play.
        }
        setSlot(result.slot);
        setClaimed("seated");
      } else {
        setClaimed(result.reason);
        // Let the retry button have another go.
        claiming.current = false;
      }
    })();

    return () => {
      live = false;
    };
  }, [collection, roomId, attempt]);

  const me: Seat = (slot ? seats[slot] : null) ?? seatLook(slot ?? 1);

  const rename = useCallback(
    (name: string) => {
      if (!roomId || !slot) return;
      void renameSeat(collection, roomId, slot, name);
    },
    [collection, roomId, slot]
  );

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { slot, me, seats, status, rename, retry };
}
