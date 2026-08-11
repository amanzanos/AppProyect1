export type Orientation = "portrait" | "landscape";

export type PlayerSlot = 1 | 2;

/**
 * The figure drawn on court for each side. Names and colours come from the
 * device's players at render time; only what the sprite itself needs — which
 * of the two silhouettes to draw — is fixed here.
 */
export const TENNIS_LOOKS: Record<PlayerSlot, { longHair: boolean }> = {
  1: { longHair: false },
  2: { longHair: true },
};
