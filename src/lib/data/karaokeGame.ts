"use client";

import {
  createRoom,
  randomRoomCode,
  sendControl,
  setStage,
  useRoom,
  type ControlBase,
  type PlayerSlot,
  type Stage,
} from "@/lib/data/gameRoom";

export { randomRoomCode };
export type { PlayerSlot };

export const KARAOKE_COLLECTION = "karaokeGames";

/**
 * What the screen publishes about the performance in progress.
 *
 * `startAt` is an absolute wall-clock time a couple of seconds in the future,
 * not "start now". Both devices wait for it and then run their own clock, so
 * the lyrics on the phone, the lyrics on the television and the guide melody
 * all line up without anything having to stream a clock over Firestore — which
 * it could not do anyway at one write a second. The residual error is the two
 * devices' clock skew, which on anything with a network time source is far
 * below the length of a syllable.
 */
export interface KaraokeStage extends Stage {
  song: string;
  /** Whose turn it is to sing. */
  singer: number;
  /** Bumped for each performance, so a phone can tell a new one has begun. */
  take: number;
  /** Epoch milliseconds. 0 means "not counting in yet". */
  startAt: number;
}

/**
 * The singer's phone reports in a handful of times per song — once when the
 * microphone is live, then a running score at the end of each line. That is
 * well inside one write a second; the pitch itself never leaves the phone.
 */
export interface KaraokeControl extends ControlBase {
  take: number;
  /** The microphone is open and this phone is ready to be counted in. */
  ready: boolean;
  score: number;
  done: boolean;
}

const BLANK = { take: -1, ready: false, score: 0, done: false };

export function createKaraokeRoom(roomId: string) {
  return createRoom(KARAOKE_COLLECTION, roomId, BLANK);
}

export function setKaraokeStage(roomId: string, patch: Partial<KaraokeStage>) {
  return setStage(KARAOKE_COLLECTION, roomId, patch as Stage);
}

export function sendReady(roomId: string, player: PlayerSlot, take: number) {
  return sendControl(KARAOKE_COLLECTION, roomId, player, { take, ready: true, score: 0, done: false });
}

export function sendKaraokeScore(
  roomId: string,
  player: PlayerSlot,
  take: number,
  score: number,
  done: boolean
) {
  return sendControl(KARAOKE_COLLECTION, roomId, player, { take, ready: true, score, done });
}

export function useKaraokeRoom(roomId: string | null) {
  return useRoom<KaraokeControl, KaraokeStage>(KARAOKE_COLLECTION, roomId);
}
