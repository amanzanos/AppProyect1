"use client";

import {
  R_DOUBLE_IN,
  R_INNER_BULL,
  R_OUTER_BULL,
  R_TRIPLE_IN,
  R_TRIPLE_OUT,
  SECTORS,
} from "@/lib/darts";

const BLACK = "#191919";
const CREAM = "#efe1c2";
const RED = "#cf3a34";
const GREEN = "#2e8b52";
const WIRE = "#8d8d93";

/** Outer edge of the number ring, in board radii. */
export const BOARD_EXTENT = 1.24;

/** A point at `r` board radii, `deg` clockwise from straight up. */
function at(r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return [r * Math.sin(rad), -r * Math.cos(rad)] as const;
}

/** Path for the slice of an annulus between two radii and two angles. */
function slice(r0: number, r1: number, a0: number, a1: number) {
  const [ox0, oy0] = at(r1, a0);
  const [ox1, oy1] = at(r1, a1);
  const [ix1, iy1] = at(r0, a1);
  const [ix0, iy0] = at(r0, a0);
  return [
    `M ${ox0} ${oy0}`,
    `A ${r1} ${r1} 0 0 1 ${ox1} ${oy1}`,
    `L ${ix1} ${iy1}`,
    `A ${r0} ${r0} 0 0 0 ${ix0} ${iy0}`,
    "Z",
  ].join(" ");
}

/**
 * A standard board drawn in board radii, so a scored point drops straight in
 * at its own coordinates with no conversion.
 */
export default function Dartboard() {
  return (
    <g>
      {/* surround the wire ring sits on */}
      <circle cx="0" cy="0" r={BOARD_EXTENT} fill="#101014" />
      <circle cx="0" cy="0" r="1" fill={BLACK} />

      {SECTORS.map((number, i) => {
        const a0 = i * 18 - 9;
        const a1 = i * 18 + 9;
        // 20 is a black sector with red rings; they alternate from there.
        const single = i % 2 === 0 ? BLACK : CREAM;
        const ring = i % 2 === 0 ? RED : GREEN;
        return (
          <g key={number}>
            <path d={slice(R_OUTER_BULL, R_TRIPLE_IN, a0, a1)} fill={single} />
            <path d={slice(R_TRIPLE_IN, R_TRIPLE_OUT, a0, a1)} fill={ring} />
            <path d={slice(R_TRIPLE_OUT, R_DOUBLE_IN, a0, a1)} fill={single} />
            <path d={slice(R_DOUBLE_IN, 1, a0, a1)} fill={ring} />
          </g>
        );
      })}

      {/* wires */}
      <g stroke={WIRE} strokeWidth="0.006" fill="none" opacity="0.75">
        {SECTORS.map((_, i) => {
          const [x0, y0] = at(R_OUTER_BULL, i * 18 + 9);
          const [x1, y1] = at(1, i * 18 + 9);
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} />;
        })}
        {[R_OUTER_BULL, R_TRIPLE_IN, R_TRIPLE_OUT, R_DOUBLE_IN, 1].map((r) => (
          <circle key={r} cx="0" cy="0" r={r} />
        ))}
      </g>

      <circle cx="0" cy="0" r={R_OUTER_BULL} fill={GREEN} />
      <circle cx="0" cy="0" r={R_INNER_BULL} fill={RED} />

      {SECTORS.map((number, i) => {
        const [x, y] = at(1.12, i * 18);
        return (
          <text
            key={number}
            x={x}
            y={y}
            fill="#f4f4f5"
            fontSize="0.13"
            fontWeight="800"
            textAnchor="middle"
            dominantBaseline="central"
          >
            {number}
          </text>
        );
      })}
    </g>
  );
}
