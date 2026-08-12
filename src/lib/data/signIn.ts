"use client";

import { signInAnonymously } from "firebase/auth";
import { auth, firebaseConfigured } from "@/lib/firebase";

/**
 * Anonymous sign-in, on demand.
 *
 * There are no accounts in this app and there never will be — but Firestore
 * still needs to know who is knocking. Without it the only rules that would
 * let the game work are rules that let *anybody* read and write the database,
 * which for a room-code game means someone can enumerate rooms, scribble in
 * them, or simply burn the free quota for fun.
 *
 * Anonymous auth costs nothing, needs no interaction, and lets the rules say
 * `request.auth != null`. The user never sees it happen.
 *
 * The promise is kept so that four screens calling this at once produce one
 * sign-in, not four.
 */
let pending: Promise<void> | null = null;

export function ensureSignedIn(): Promise<void> {
  if (!firebaseConfigured || !auth) return Promise.resolve();
  if (auth.currentUser) return Promise.resolve();
  if (!pending) {
    pending = signInAnonymously(auth)
      .then(() => undefined)
      .catch(() => {
        // Anonymous sign-in disabled in the console, or offline. Let it go:
        // the writes that follow will fail on their own and the lobby already
        // copes with never connecting. Cleared so a later attempt can retry.
        pending = null;
      });
  }
  return pending;
}
