import type { Orientation } from "@/lib/tennisTypes";

/**
 * The court is drawn with an explicit one-point perspective projection rather
 * than a CSS 3D transform. Doing the maths ourselves means the static SVG
 * (court lines, net, stands) and the live sprites (ball, players) are placed
 * by the exact same function, so they can never drift out of alignment.
 *
 * There are two cameras. Head-on sits low behind one baseline and the court
 * runs away up the screen — right for a tall phone screen. Side-on sits off
 * one tramline and the court lies left↔right across the screen, which is what
 * fills a wide projector. Only the projection differs: the simulation always
 * speaks in the same court coordinates.
 */
export interface SceneSpec {
  width: number;
  height: number;
  horizon: number;
  /** Screen y of the near and far edges of the court. Head-on those are the
      two baselines; side-on they're the two sidelines. */
  yNear: number;
  yFar: number;
  /** Half the court's on-screen extent at each of those edges. */
  halfNear: number;
  halfFar: number;
  cx: number;
  /** Camera at the side of the court, so the court lies left↔right. */
  sideOn: boolean;
  /** Screen px the far edge of the court is pushed sideways relative to the
      near one. Straight-on, everything running away from the camera collapses
      onto a vertical line — the net included, which then reads as a post
      rather than a net. Leaning the depth axis over turns it into the
      three-quarter view arcade tennis games use. */
  shear: number;
  /** Scene px per foot of court at the near edge. Heights written in feet then
      read the same under either camera. */
  unit: number;
}

const COURT_LENGTH_FT = 78;
const COURT_WIDTH_FT = 36;

/**
 * Built from the real container size so the scene always fills the screen
 * edge to edge — no letterbox bars, no cropping.
 */
export function buildScene(width: number, height: number, orientation: Orientation): SceneSpec {
  if (orientation === "landscape") {
    // Looking in from the side: the court's long axis spans the screen, and
    // the shallow near/far span is the 36ft width, so the perspective is
    // gentle compared to the head-on camera.
    const halfNear = width * 0.41;
    const shear = width * 0.14;
    // A tennis court is a bit over twice as long as it is wide, so the depth
    // it takes up on screen has to stay well under its length however tall the
    // viewport is. Taking the depth straight from the height made the court
    // deeper than it was long on a phone held upright, which is the one thing
    // that can't look like a tennis court.
    const depth = Math.min(height * 0.56, 2 * halfNear * 0.62);
    const yNear = height * 0.96;
    return {
      width,
      height,
      horizon: Math.max(yNear - depth - height * 0.1, height * 0.18),
      yFar: yNear - depth,
      yNear,
      halfNear,
      halfFar: width * 0.28,
      // The lean pushes the far half right, so the court is re-centred by
      // half of it to keep even margins down both sides.
      cx: width / 2 - shear / 2,
      sideOn: true,
      shear,
      unit: (2 * halfNear) / COURT_LENGTH_FT,
    };
  }

  const halfNear = width * 0.66;
  return {
    width,
    height,
    horizon: height * 0.33,
    yFar: height * 0.41,
    yNear: height * 1.02,
    halfNear,
    halfFar: width * 0.12,
    cx: width / 2,
    sideOn: false,
    shear: 0,
    unit: (2 * halfNear) / COURT_WIDTH_FT,
  };
}

export interface Projected {
  x: number;
  y: number;
  /** 1 at the near edge of the court, shrinking towards the far one. */
  scale: number;
}

/**
 * @param across 0-100 across the court (0 = left tramline head-on)
 * @param along  0-100 down the court (100 = the baseline the head-on camera
 *               sits behind, and the left-hand end when seen from the side).
 *               Values outside that range are valid: the ball runs past a
 *               baseline before a point is given.
 */
export function project(spec: SceneSpec, across: number, along: number): Projected {
  // Whichever court axis runs into the screen drives the perspective; the
  // other one spreads sideways across it.
  const depth = spec.sideOn ? 1 - across / 100 : 1 - along / 100;
  const lateral = spec.sideOn ? 1 - along / 100 : across / 100;

  const ratio = spec.halfFar / spec.halfNear;
  // Uniform steps in world depth compress towards the horizon as 1/z.
  const z = Math.max(1 + depth * (1 / ratio - 1), 0.25);
  const halfWidth = spec.halfNear / z;
  // 0 at the near edge of the court, 1 at the far one.
  const t = (1 - 1 / z) / (1 - ratio);
  const y = spec.yNear + (spec.yFar - spec.yNear) * t;
  const x = spec.cx + (lateral - 0.5) * 2 * halfWidth + spec.shear * t;
  return { x, y, scale: 1 / z };
}

/**
 * Quad joining two projected points, `width` scene px wide measured
 * perpendicular to the segment on screen and tapering with depth. Working off
 * the on-screen direction rather than a fixed axis is what lets the same
 * markings draw correctly under both cameras — a line that runs up the screen
 * in one runs across it in the other.
 */
function ribbon(a: Projected, b: Projected, width: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const ha = (width * a.scale) / 2;
  const hb = (width * b.scale) / 2;
  return [
    [a.x + nx * ha, a.y + ny * ha],
    [b.x + nx * hb, b.y + ny * hb],
    [b.x - nx * hb, b.y - ny * hb],
    [a.x - nx * ha, a.y - ny * ha],
  ]
    .map((p) => p.join(","))
    .join(" ");
}

/** Quad for a painted line between any two points on the court. */
export function courtLine(
  spec: SceneSpec,
  from: [across: number, along: number],
  to: [across: number, along: number],
  width = 9
) {
  return ribbon(project(spec, from[0], from[1]), project(spec, to[0], to[1]), width);
}

/** Quad for a line running the length of the court at a fixed `across`. */
export function lineDownCourt(spec: SceneSpec, across: number, width = 12) {
  return courtLine(spec, [across, 100], [across, 0], width);
}

/** Quad for a line running the width of the court at a fixed `along`. */
export function lineAcrossCourt(spec: SceneSpec, along: number, from = 0, to = 100, width = 9) {
  return courtLine(spec, [from, along], [to, along], width);
}
