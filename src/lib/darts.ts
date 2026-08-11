/**
 * Board geometry, scoring and dart flight for the darts game.
 *
 * Everything is in "board radii": the centre of the bull is (0, 0) and the
 * outer edge of the double ring is at radius 1, with y growing downwards to
 * match screen coordinates. That way a landing point drops straight into the
 * SVG with no conversion, and the scoring can be unit-tested on its own.
 */

/** A standard board, read clockwise from the 20 at the top. */
export const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

// Real board measurements (mm from centre), divided through by the 170mm
// outer double so they land in board radii.
export const R_INNER_BULL = 6.35 / 170;
export const R_OUTER_BULL = 15.9 / 170;
export const R_TRIPLE_IN = 99 / 170;
export const R_TRIPLE_OUT = 107 / 170;
export const R_DOUBLE_IN = 162 / 170;

export type HitKind = "miss" | "single" | "double" | "triple" | "bull" | "bullseye";

export interface Hit {
  kind: HitKind;
  /** The sector landed in; 0 for the bull and for a miss. */
  sector: number;
  value: number;
  /** Short label to show under the score, e.g. "Triple 20". */
  label: string;
}

/** Which numbered sector a point falls in. */
export function sectorAt(x: number, y: number) {
  // Measured clockwise from straight up, which is where the 20 sits.
  const deg = (Math.atan2(x, -y) * 180) / Math.PI;
  const from20 = (deg + 369) % 360; // +360 to go positive, +9 so 20 straddles 0
  return SECTORS[Math.floor(from20 / 18) % 20];
}

export function scoreAt(x: number, y: number): Hit {
  const r = Math.hypot(x, y);
  if (r <= R_INNER_BULL) return { kind: "bullseye", sector: 0, value: 50, label: "¡Diana!" };
  if (r <= R_OUTER_BULL) return { kind: "bull", sector: 0, value: 25, label: "Centro" };
  if (r > 1) return { kind: "miss", sector: 0, value: 0, label: "Fuera" };

  const sector = sectorAt(x, y);
  if (r >= R_TRIPLE_IN && r <= R_TRIPLE_OUT) {
    return { kind: "triple", sector, value: sector * 3, label: `Triple ${sector}` };
  }
  if (r >= R_DOUBLE_IN) {
    return { kind: "double", sector, value: sector * 2, label: `Doble ${sector}` };
  }
  return { kind: "single", sector, value: sector, label: `${sector}` };
}

/**
 * The throw is a plain projectile: the dart leaves from below the board and
 * gravity pulls it back down over a fixed flight time, so where it crosses
 * the board is decided by the launch velocities rather than placed by hand.
 */
export const FLIGHT_S = 0.62;
export const LAUNCH_Y = 2.0;
const GRAVITY = 11;

export interface Flight {
  /** Where it ends up on the board. */
  x: number;
  y: number;
  vx: number;
  vUp: number;
}

/**
 * How far out the crosshair is allowed to go. Aiming used to run off the
 * board and most darts missed entirely; a steady hand can now always keep the
 * aim on a scoring bed, and the only thing that throws it off is the throw.
 */
export const AIM_LIMIT = 0.9;

export function clampAim(x: number, y: number) {
  const r = Math.hypot(x, y);
  if (r <= AIM_LIMIT) return { x, y };
  const k = AIM_LIMIT / r;
  return { x: x * k, y: y * k };
}

/** Board radii of spread on the sloppiest possible throw. */
const MAX_SPREAD = 0.34;

/** Rough normal deviate — three uniforms is plenty for a bit of scatter. */
function gauss() {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 0.5;
}

/**
 * Throws at the point the player was aiming at. The launch velocities are the
 * ones that would put the dart exactly there, nudged by however cleanly the
 * throw was made; the flight is then simulated from those, so the landing
 * point still falls out of the physics rather than being placed by hand.
 *
 * @param quality 0-1, from how well the throwing action was performed
 */
export function aimedThrow(tx: number, ty: number, quality: number): Flight {
  const spread = MAX_SPREAD * (1 - Math.min(Math.max(quality, 0), 1));
  // A velocity error of e over the flight becomes a landing error of e * T.
  const jitter = spread / FLIGHT_S;
  const vUp = (LAUNCH_Y + 0.5 * GRAVITY * FLIGHT_S ** 2 - ty) / FLIGHT_S + gauss() * jitter;
  const vx = tx / FLIGHT_S + gauss() * jitter;
  return {
    x: vx * FLIGHT_S,
    y: LAUNCH_Y - vUp * FLIGHT_S + 0.5 * GRAVITY * FLIGHT_S ** 2,
    vx,
    vUp,
  };
}

/** Where the dart is `t` seconds into its flight. */
export function flightPoint(f: Flight, t: number) {
  return {
    x: f.vx * t,
    y: LAUNCH_Y - f.vUp * t + 0.5 * GRAVITY * t * t,
  };
}
