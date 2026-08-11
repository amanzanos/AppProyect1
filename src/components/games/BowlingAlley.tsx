"use client";

import type { RefObject } from "react";
import { LANE_LENGTH, PIN_SPOTS } from "@/lib/bowling";
import { EDGE, PIT, laneBand, projectLane, type AlleySpec } from "@/lib/bowlingScene";

// Flat, saturated blocks of colour — no gradients on the scenery, so it stays
// crisp however big the projector throws it.
const WALL = "#ef7f74";
const WALL_DARK = "#d9635b";
const TEAL = "#3f9d99";
const TEAL_DARK = "#2f7a78";
const NAVY = "#22364f";
const LANE = "#f0d7a6";
const LANE_LINE = "#dcbc85";
const APPROACH = "#d99f6e";
const GUTTER = "#d9534f";
const PIN_WHITE = "#fdfbf4";
const PIN_STRIPE = "#e0413f";

/** Lane edge, where the gutter starts. */
const LANE_EDGE = 1;

function poly(points: { x: number; y: number }[]) {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

interface BowlingAlleyProps {
  spec: AlleySpec;
  ballRef: RefObject<SVGGElement | null>;
  /** One per pin, indexed as PIN_SPOTS. */
  pinRefs: RefObject<SVGGElement | null>[];
  /** The dotted line showing where the bowler is aiming. */
  aimRef: RefObject<SVGLineElement | null>;
}

export default function BowlingAlley({ spec, ballRef, pinRefs, aimRef }: BowlingAlleyProps) {
  const deckFar = projectLane(spec, 0, PIT);
  const wallTop = 0;

  return (
    <svg
      viewBox={`0 0 ${spec.width} ${spec.height}`}
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <clipPath id="alley-frame">
          <rect x="0" y="0" width={spec.width} height={spec.height} />
        </clipPath>
      </defs>

      <g clipPath="url(#alley-frame)">
        {/* back wall, and the teal band of screens across it */}
        <rect x="0" y={wallTop} width={spec.width} height={spec.horizon} fill={WALL} />
        <rect x="0" y={spec.horizon * 0.42} width={spec.width} height={spec.horizon * 0.32} fill={TEAL} />
        <rect x="0" y={spec.horizon * 0.42} width={spec.width} height={spec.horizon * 0.05} fill={TEAL_DARK} />

        {/* framed panels along the top */}
        {[0.04, 0.3, 0.56, 0.82].map((fx, i) => (
          <g key={fx}>
            <rect
              x={spec.width * fx}
              y={spec.horizon * 0.05}
              width={spec.width * 0.14}
              height={spec.horizon * 0.28}
              fill={NAVY}
              rx={spec.horizon * 0.02}
            />
            {[0.3, 0.55, 0.75].map((cx, j) => (
              <circle
                key={cx}
                cx={spec.width * fx + spec.width * 0.14 * cx}
                cy={spec.horizon * (0.11 + ((i + j) % 3) * 0.05)}
                r={spec.horizon * 0.035}
                fill={[TEAL, "#f2b199", "#8ecae6"][(i + j) % 3]}
              />
            ))}
          </g>
        ))}

        {/* the strip of lanes carrying on either side of ours */}
        <rect x="0" y={spec.horizon} width={spec.width} height={spec.height - spec.horizon} fill={APPROACH} />
        <polygon points={laneBand(spec, -EDGE * 3.4, -EDGE)} fill={WALL_DARK} opacity="0.35" />
        <polygon points={laneBand(spec, EDGE, EDGE * 3.4)} fill={WALL_DARK} opacity="0.35" />

        {/* gutters, then the lane itself */}
        <polygon points={laneBand(spec, -EDGE, -LANE_EDGE)} fill={GUTTER} />
        <polygon points={laneBand(spec, LANE_EDGE, EDGE)} fill={GUTTER} />
        <polygon points={laneBand(spec, -EDGE, -LANE_EDGE + 0.03)} fill={NAVY} opacity="0.25" />
        <polygon points={laneBand(spec, LANE_EDGE - 0.03, EDGE)} fill={NAVY} opacity="0.25" />
        <polygon points={laneBand(spec, -LANE_EDGE, LANE_EDGE)} fill={LANE} />

        {/* boards down the lane */}
        {Array.from({ length: 9 }, (_, i) => -0.8 + i * 0.2).map((x) => (
          <polygon key={x} points={laneBand(spec, x - 0.004, x + 0.004)} fill={LANE_LINE} opacity="0.8" />
        ))}

        {/* the arrows bowlers actually aim at, 15 feet down */}
        {[-0.6, -0.3, 0, 0.3, 0.6].map((x) => {
          const p = projectLane(spec, x, -LANE_LENGTH * 0.75);
          const w = 0.05 * (spec.halfNear / EDGE) * p.scale;
          return (
            <polygon
              key={x}
              points={poly([
                { x: p.x, y: p.y - w * 1.6 },
                { x: p.x + w, y: p.y + w * 0.8 },
                { x: p.x - w, y: p.y + w * 0.8 },
              ])}
              fill={LANE_LINE}
            />
          );
        })}

        {/* pit and masking unit behind the deck */}
        <polygon
          points={poly([
            { x: 0, y: deckFar.y },
            { x: spec.width, y: deckFar.y },
            { x: spec.width, y: spec.horizon },
            { x: 0, y: spec.horizon },
          ])}
          fill={NAVY}
        />

        <line
          ref={aimRef}
          x1={spec.cx}
          y1={spec.yNear}
          x2={spec.cx}
          y2={projectLane(spec, 0, 0).y}
          stroke="#ffffff"
          strokeOpacity="0.45"
          strokeWidth="3"
          strokeDasharray="10 10"
        />

        {/* Pins are drawn far-row first so the near ones overlap them. */}
        {PIN_SPOTS.map((_, i) => PIN_SPOTS.length - 1 - i).map((i) => (
          <g key={i} ref={pinRefs[i]}>
            <ellipse cx="0" cy="6" rx="9" ry="3.4" fill={NAVY} opacity="0.28" />
            <path
              d="M 0 -30 C 6 -30 7.5 -22 5 -17 C 3.2 -13.5 3.2 -12 4.6 -9 C 7.4 -3.4 8.4 2 0 4 C -8.4 2 -7.4 -3.4 -4.6 -9 C -3.2 -12 -3.2 -13.5 -5 -17 C -7.5 -22 -6 -30 0 -30 Z"
              fill={PIN_WHITE}
            />
            <rect x="-5.1" y="-21" width="10.2" height="2.6" fill={PIN_STRIPE} />
            <rect x="-5.6" y="-16.5" width="11.2" height="2.6" fill={PIN_STRIPE} />
          </g>
        ))}

        <g ref={ballRef}>
          <ellipse cx="0" cy="7" rx="15" ry="5" fill={NAVY} opacity="0.3" />
          <circle cx="0" cy="0" r="16" fill="#c0335f" />
          <circle cx="-5" cy="-5.5" r="4.6" fill="#ffffff" opacity="0.35" />
          <circle cx="4.5" cy="-6" r="2" fill="#7d1f3c" />
          <circle cx="8" cy="-1" r="2" fill="#7d1f3c" />
          <circle cx="4" cy="3" r="2" fill="#7d1f3c" />
        </g>
      </g>
    </svg>
  );
}
