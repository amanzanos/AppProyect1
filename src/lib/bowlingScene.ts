import { LANE_LENGTH } from "@/lib/bowling";

/**
 * One-point perspective down the lane, worked out explicitly so the painted
 * alley and the live ball and pins are placed by the very same function and
 * can never drift apart.
 */
export interface AlleySpec {
  width: number;
  height: number;
  /** Screen y of the foul line and of the pin deck. */
  yNear: number;
  yFar: number;
  /** Half the width on screen at each of those, covering lane plus gutters. */
  halfNear: number;
  halfFar: number;
  cx: number;
  /** Where the back wall meets the floor. */
  horizon: number;
}

/** Lane plus both gutters, in half-lane widths. */
export const EDGE = 1.32;
/** A little past the pin deck, where the pit starts. */
export const PIT = 3.2;

/**
 * The rack is only 30in deep at the end of a 60ft lane, so in true
 * perspective the triangle collapses into a line of pins. The deck is spread
 * out to the depth it needs to read as a triangle; the change is continuous
 * at the headpin, so nothing jumps as the ball arrives.
 */
const DECK_STRETCH = 5;

export function buildAlley(width: number, height: number): AlleySpec {
  return {
    width,
    height,
    yNear: height * 0.96,
    yFar: height * 0.42,
    halfNear: width * 0.62,
    halfFar: width * 0.19,
    cx: width / 2,
    horizon: height * 0.38,
  };
}

export interface Projected {
  x: number;
  y: number;
  /** 1 at the foul line, shrinking away down the lane. */
  scale: number;
}

/**
 * @param across half-lane widths, 0 down the middle
 * @param along  distance in the same units, -LANE_LENGTH at the foul line and
 *               0 at the headpin
 */
export function projectLane(spec: AlleySpec, across: number, along: number): Projected {
  // 0 at the foul line under the bowler, 1 at the pins, more in the pit.
  const view = along > 0 ? along * DECK_STRETCH : along;
  const depth = (view + LANE_LENGTH) / LANE_LENGTH;
  const ratio = spec.halfFar / spec.halfNear;
  const z = Math.max(1 + depth * (1 / ratio - 1), 0.2);
  const t = (1 - 1 / z) / (1 - ratio);
  return {
    x: spec.cx + (across / EDGE) * (spec.halfNear / z),
    y: spec.yNear + (spec.yFar - spec.yNear) * t,
    scale: 1 / z,
  };
}

/** Quad covering the strip of floor between two `across` values. */
export function laneBand(spec: AlleySpec, from: number, to: number, nearAlong = -LANE_LENGTH, farAlong = PIT) {
  const a = projectLane(spec, from, nearAlong);
  const b = projectLane(spec, to, nearAlong);
  const c = projectLane(spec, to, farAlong);
  const d = projectLane(spec, from, farAlong);
  return [a, b, c, d].map((p) => `${p.x},${p.y}`).join(" ");
}
