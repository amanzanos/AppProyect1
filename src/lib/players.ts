/**
 * What a seat looks like.
 *
 * The couple app this came from had exactly two people baked into the code,
 * named on the device they shared. Here the seats belong to whoever picked up
 * a phone, there can be up to eight of them, and each phone names itself when
 * it joins — so a seat's colour and emoji are all that has to be agreed in
 * advance, and they come from its number.
 *
 * Deliberately *not* an account, and no longer stored at all: a party's players
 * change every night, nobody wants to sign up for this, and there is nothing
 * left worth remembering between sessions.
 *
 * No import from gameRoom on purpose — that module needs `seatLook`, and a
 * cycle between the two would only ever be safe by accident.
 */
export interface Player {
  name: string;
  color: string;
  emoji: string;
}

/** Picked to stay apart on a projector and to survive colour-blind viewers. */
export const PALETTE = [
  "#e63946",
  "#4b6ef5",
  "#3fa34d",
  "#f0b429",
  "#9b5de5",
  "#f4802f",
  "#1f9ec4",
  "#ff6fb5",
] as const;

export const EMOJI = ["🦁", "🐙", "🐸", "🦊", "🦄", "🐼", "🦈", "🌸"] as const;

/**
 * What seat N looks like before anybody renames themselves. Pure, so the
 * screen and the phones always agree without having to ask each other.
 */
export function seatLook(slot: number): Player {
  const i = (slot - 1) % PALETTE.length;
  return { name: `Jugador ${slot}`, color: PALETTE[i], emoji: EMOJI[i] };
}
