/**
 * Standard bowling scoring over a shortened game.
 *
 * A strike is worth 10 plus the next two balls, a spare 10 plus the next one,
 * which is why a frame can't be totted up until the balls after it have been
 * thrown. The last frame grants the extra balls those bonuses need, exactly
 * as the tenth does in a full game.
 */

export const FRAMES = 5;
export const PINS = 10;

export interface FrameScore {
  /** The balls thrown in this frame, as pin counts. */
  rolls: number[];
  /** Running total to the end of this frame, once it can be worked out. */
  total: number | null;
  strike: boolean;
  spare: boolean;
}

/** Splits a flat list of balls into frames and scores them. */
export function scoreGame(rolls: number[]): { frames: FrameScore[]; total: number } {
  const frames: FrameScore[] = [];
  let i = 0;
  let running = 0;
  let closed = true;

  for (let f = 0; f < FRAMES; f++) {
    const last = f === FRAMES - 1;
    const thrown: number[] = [];
    let points = 0;
    let strike = false;
    let spare = false;

    if (last) {
      // The final frame keeps going while the bonuses are owed.
      while (i < rolls.length && thrown.length < 3) {
        thrown.push(rolls[i]);
        i++;
        if (thrown.length === 2 && thrown[0] !== PINS && thrown[0] + thrown[1] < PINS) break;
      }
      strike = thrown[0] === PINS;
      spare = !strike && thrown.length >= 2 && thrown[0] + thrown[1] === PINS;
      points = thrown.reduce((a, b) => a + b, 0);
      const owed = strike || spare ? 3 : 2;
      closed = thrown.length >= owed;
    } else if (rolls[i] === PINS) {
      strike = true;
      thrown.push(PINS);
      i++;
      const bonus = rolls.slice(i, i + 2);
      closed = bonus.length === 2;
      points = PINS + bonus.reduce((a, b) => a + b, 0);
    } else {
      const first = rolls[i];
      if (first === undefined) {
        closed = false;
        points = 0;
      } else {
        thrown.push(first);
        i++;
        const second = rolls[i];
        if (second === undefined) {
          closed = false;
          points = first;
        } else {
          thrown.push(second);
          i++;
          spare = first + second === PINS;
          if (spare) {
            const bonus = rolls[i];
            closed = bonus !== undefined;
            points = PINS + (bonus ?? 0);
          } else {
            points = first + second;
          }
        }
      }
    }

    running += points;
    frames.push({ rolls: thrown, total: closed && thrown.length > 0 ? running : null, strike, spare });
    if (!closed) {
      // Everything after this is still unplayed.
      for (let rest = f + 1; rest < FRAMES; rest++) {
        frames.push({ rolls: [], total: null, strike: false, spare: false });
      }
      break;
    }
  }

  const total = frames.reduce((best, f) => (f.total ?? best), 0);
  return { frames, total };
}

/** Which frame the next ball belongs to, and whether it starts a fresh rack. */
export function nextBall(rolls: number[]) {
  let i = 0;
  for (let f = 0; f < FRAMES; f++) {
    const last = f === FRAMES - 1;
    if (last) {
      const thrown = rolls.slice(i);
      const strike = thrown[0] === PINS;
      const spare = thrown.length >= 2 && !strike && thrown[0] + thrown[1] === PINS;
      const owed = strike || spare ? 3 : 2;
      return { frame: f, ball: thrown.length, done: thrown.length >= owed };
    }
    if (rolls[i] === undefined) return { frame: f, ball: 0, done: false };
    if (rolls[i] === PINS) {
      i += 1;
      continue;
    }
    if (rolls[i + 1] === undefined) return { frame: f, ball: 1, done: false };
    i += 2;
  }
  return { frame: FRAMES - 1, ball: 0, done: true };
}

/** True once the player has thrown every ball they're owed. */
export function gameOver(rolls: number[]) {
  return nextBall(rolls).done;
}
