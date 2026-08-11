"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db, firebaseConfigured } from "@/lib/firebase";
import { DEFAULT_PLAYERS, type Players } from "@/lib/players";

/**
 * The players, as seen from a phone.
 *
 * The screen owns them — they're stored on that device — so a controller
 * reads them back off the room document rather than guessing. Falls back to
 * the generic pair, which is what an old room created before this existed
 * will hand back.
 */
export function useRoomPlayers(collection: string, roomId: string | null): Players {
  const [players, setPlayers] = useState<Players>(DEFAULT_PLAYERS);

  useEffect(() => {
    if (!roomId || !firebaseConfigured) return;
    return onSnapshot(doc(db, collection, roomId), (snap) => {
      const stored = (snap.data() as { players?: Partial<Players> | null } | undefined)?.players;
      if (!stored) return;
      setPlayers({
        1: { ...DEFAULT_PLAYERS[1], ...stored[1] },
        2: { ...DEFAULT_PLAYERS[2], ...stored[2] },
      });
    });
  }, [collection, roomId]);

  return players;
}
