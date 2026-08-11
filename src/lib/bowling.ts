/**
 * Bowling: the rack, the roll and the score.
 *
 * Distances are in half lane widths — one unit is 21in, so the lane runs from
 * x = -1 to x = 1 with the gutters outside that, and y counts away from the
 * bowler with the headpin at 0. Real measurements go in at the top and
 * everything downstream is derived, so the pins sit where pins actually sit.
 */

const HALF_LANE_IN = 21;
const inches = (n: number) => n / HALF_LANE_IN;

export const BALL_R = inches(4.25);
export const PIN_R = inches(2.383);
/** Foul line to headpin: 60 feet. */
export const LANE_LENGTH = inches(60 * 12);
/** Beyond this the ball is in the gutter and nothing gets hit. */
export const GUTTER_X = 1;

const PIN_SPACING = inches(12);
const ROW_SPACING = inches(12 * Math.cos(Math.PI / 6));

/** The standard triangle, headpin first. */
export const PIN_SPOTS: { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: -PIN_SPACING / 2, y: ROW_SPACING },
  { x: PIN_SPACING / 2, y: ROW_SPACING },
  { x: -PIN_SPACING, y: ROW_SPACING * 2 },
  { x: 0, y: ROW_SPACING * 2 },
  { x: PIN_SPACING, y: ROW_SPACING * 2 },
  { x: -PIN_SPACING * 1.5, y: ROW_SPACING * 3 },
  { x: -PIN_SPACING / 2, y: ROW_SPACING * 3 },
  { x: PIN_SPACING / 2, y: ROW_SPACING * 3 },
  { x: PIN_SPACING * 1.5, y: ROW_SPACING * 3 },
];

export const PIN_COUNT = PIN_SPOTS.length;

export interface Pin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Where it was racked, so we can tell whether it has been shifted. */
  spotX: number;
  spotY: number;
  down: boolean;
  /** Kept out of the rack entirely — already knocked over this frame. */
  cleared: boolean;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Sideways acceleration: the hook. */
  spin: number;
}

export interface Lane {
  ball: Ball;
  pins: Pin[];
}

/** A pin counts as down once it has been shoved this far off its spot. */
const TOPPLE = PIN_R * 0.55;
/** A ball weighs about four and a half times what a pin does. */
const MASS_RATIO = 4.5;
const FRICTION = 0.4;
/** Pins slide a good way before settling — that travel is what carries a
    strike, since most pins go down from being hit by other pins. */
const PIN_FRICTION = 1.15;
const BOUNCE = 0.8;
const STILL = 0.35;
/** The hook only grips once the ball is off the oiled front of the lane. */
const HOOK_FROM = 0.45;
/** Nobody repeats a delivery exactly, and no deck is perfectly flat. */
const DELIVERY_SPREAD = 0.05;
const DECK_JITTER = 0.006;

/** @param standing which pins to rack; all of them when omitted */
export function rack(standing?: boolean[]): Pin[] {
  return PIN_SPOTS.map((s, i) => ({
    x: s.x + (Math.random() - 0.5) * DECK_JITTER,
    y: s.y + (Math.random() - 0.5) * DECK_JITTER,
    vx: 0,
    vy: 0,
    spotX: s.x,
    spotY: s.y,
    down: false,
    cleared: standing ? !standing[i] : false,
  }));
}

/**
 * @param aim   -1..1 across the foul line
 * @param power 0..1, mapped to a believable ball speed
 * @param spin  -1..1 hook; negative curves left
 */
export function bowl(aim: number, power: number, spin: number): Ball {
  return {
    x: Math.max(Math.min(aim, GUTTER_X * 1.15), -GUTTER_X * 1.15),
    y: -LANE_LENGTH,
    vx: (Math.random() - 0.5) * DELIVERY_SPREAD,
    vy: 9 + power * 8,
    spin: spin * 0.9,
  };
}

/** Advances the lane by `dt` seconds. */
export function step(lane: Lane, dt: number) {
  const { ball, pins } = lane;

  // The hook grips over the back of the lane and is spent by the deck.
  const inGutter = Math.abs(ball.x) > GUTTER_X;
  const gripping = ball.y > -LANE_LENGTH * HOOK_FROM && ball.y < 0;
  if (!inGutter && gripping) ball.vx += ball.spin * dt;
  ball.vy = Math.max(ball.vy - FRICTION * dt, 0);
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  for (const p of pins) {
    if (p.cleared) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const decay = Math.max(1 - PIN_FRICTION * dt, 0);
    p.vx *= decay;
    p.vy *= decay;
    if (!p.down && Math.hypot(p.x - p.spotX, p.y - p.spotY) > TOPPLE) p.down = true;
  }

  // A ball in the gutter passes the rack by without touching anything.
  if (!inGutter) {
    for (const p of pins) {
      if (p.cleared) continue;
      collide(ball, p, MASS_RATIO);
    }
  }

  for (let i = 0; i < pins.length; i++) {
    for (let j = i + 1; j < pins.length; j++) {
      if (pins[i].cleared || pins[j].cleared) continue;
      collide(pins[i], pins[j], 1);
    }
  }
}

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * Elastic bounce between two circles. `ratio` is how much heavier the first
 * one is, which is why a ball barrels through a rack and a pin doesn't.
 */
function collide(a: Body, b: Body, ratio: number) {
  const ra = ratio === 1 ? PIN_R : BALL_R;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const min = ra + PIN_R;
  if (dist === 0 || dist >= min) return;

  const nx = dx / dist;
  const ny = dy / dist;
  const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rel > 0) return; // already separating

  // Impulse split by mass: the heavier body barely notices.
  const total = ratio + 1;
  const impulse = (-(1 + BOUNCE) * rel) / total;
  a.vx -= impulse * nx;
  a.vy -= impulse * ny;
  b.vx += impulse * ratio * nx;
  b.vy += impulse * ratio * ny;

  // Push them apart so they don't sit inside each other.
  const overlap = (min - dist) / total;
  a.x -= overlap * nx;
  a.y -= overlap * ny;
  b.x += overlap * ratio * nx;
  b.y += overlap * ratio * ny;
}

/** Nothing left moving, and the ball is past the deck. */
export function settled(lane: Lane) {
  if (lane.ball.y < PIN_SPOTS[PIN_SPOTS.length - 1].y + 1) return false;
  return lane.pins.every((p) => p.cleared || Math.hypot(p.vx, p.vy) < STILL);
}

/** Which pins are still up, indexed as PIN_SPOTS. */
export function standingAfter(lane: Lane) {
  return lane.pins.map((p) => !p.cleared && !p.down);
}

export function countDown(lane: Lane) {
  return lane.pins.filter((p) => !p.cleared && p.down).length;
}
