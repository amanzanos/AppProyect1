"use client";

import type { RefObject } from "react";
import TennisCharacter from "@/components/tennis/TennisCharacter";
import { courtLine, lineAcrossCourt, lineDownCourt, project, type SceneSpec } from "@/lib/tennisScene";
import { TENNIS_LOOKS, type PlayerSlot } from "@/lib/tennisTypes";
import { usePlayers } from "@/lib/players";

// Sizes are in feet of real court, converted through spec.unit, so the scene
// keeps its proportions at any screen size and under either camera.
const NET_FT = 3.4;
const TAPE_FT = 0.6;
const LINE_FT = 0.35;
/** How far the surround extends past the lines, in court units. */
const APRON_ACROSS = 20;
const APRON_ALONG = 15;

/** Both cameras frame a different amount of court, so a player who reads the
    right size under one is wrong under the other. Head-on sits low and close
    behind the near baseline and deliberately exaggerates them. */
const CHAR_FT_HEAD = 11.3;
const CHAR_FT_SIDE = 9.5;

const SKY_TOP = "#8ed3f2";
const SKY_BOTTOM = "#dff1fb";
const SURROUND = "#2c3f96";
const APRON = "#35479f";
const COURT = "#4257c4";
const LINE = "#ffffff";

function poly(points: { x: number; y: number }[]) {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

interface TennisCourtProps {
  spec: SceneSpec;
  /** The live sprites live inside this SVG so a single projection governs both
      the painted court and everything standing on it — they can't drift apart
      at any screen size. */
  p1Ref: RefObject<SVGGElement | null>;
  p2Ref: RefObject<SVGGElement | null>;
  ballRef: RefObject<SVGCircleElement | null>;
  shadowRef: RefObject<SVGEllipseElement | null>;
  /** Burst drawn at the contact point whenever a swing connects. */
  impactRef: RefObject<SVGCircleElement | null>;
}

/**
 * One court, both cameras. Everything is placed through `project`, which knows
 * whether the court runs away up the screen or lies across it, so nothing here
 * needs to care which orientation is showing.
 *
 * Deliberately spare: sky, a sun, a couple of clouds, the court and its lines.
 * No stands, no crowd, no floodlights — on a projector the flat shapes stay
 * clean and there is nothing to misalign.
 */
export default function TennisCourt({
  spec,
  p1Ref,
  p2Ref,
  ballRef,
  shadowRef,
  impactRef,
}: TennisCourtProps) {
  const { players } = usePlayers();
  const ft = (feet: number, scale = 1) => feet * spec.unit * scale;
  const charHeight = ft(spec.sideOn ? CHAR_FT_SIDE : CHAR_FT_HEAD);
  const charWidth = (charHeight * 60) / 84;
  const line = ft(LINE_FT);

  // The two ends of the net. Head-on they sit at the same depth and the net
  // reads as a band across the screen; side-on they don't, and it leans away.
  const netA = project(spec, 0, 50);
  const netB = project(spec, 100, 50);
  const netTopA = netA.y - ft(NET_FT, netA.scale);
  const netTopB = netB.y - ft(NET_FT, netB.scale);

  const ring = (across: number, along: number) =>
    poly([
      project(spec, -across, -along),
      project(spec, 100 + across, -along),
      project(spec, 100 + across, 100 + along),
      project(spec, -across, 100 + along),
    ]);

  /** Sprite group for one player, facing in towards the net. */
  const player = (slot: PlayerSlot, ref: RefObject<SVGGElement | null>) => (
    <g ref={ref} className="tennis-sprite">
      <ellipse cx="0" cy="0" rx={charWidth * 0.36} ry={charWidth * 0.12} fill="#0b1436" opacity="0.28" />
      <TennisCharacter
        color={players[slot].color}
        longHair={TENNIS_LOOKS[slot].longHair}
        flip={spec.sideOn ? slot === 2 : slot === 1}
        size={charWidth}
        x={-charWidth / 2}
        y={-charHeight}
      />
    </g>
  );

  return (
    <svg
      viewBox={`0 0 ${spec.width} ${spec.height}`}
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SKY_TOP} />
          <stop offset="100%" stopColor={SKY_BOTTOM} />
        </linearGradient>
        <clipPath id="frame">
          <rect x="0" y="0" width={spec.width} height={spec.height} />
        </clipPath>
      </defs>

      {/* The surround runs past the court edges and would otherwise paint
          outside the viewBox. */}
      <g clipPath="url(#frame)">
        <rect x="0" y="0" width={spec.width} height={spec.horizon} fill="url(#sky)" />
        <rect x="0" y={spec.horizon} width={spec.width} height={spec.height - spec.horizon} fill={SURROUND} />

        {/* Kept low and off to the sides so nothing sits under the HUD. */}
        <circle cx={spec.width * 0.86} cy={spec.horizon * 0.55} r={spec.horizon * 0.14} fill="#ffe9a3" />
        {[
          [0.1, 0.45, 1],
          [0.62, 0.28, 0.75],
        ].map(([fx, fy, s], i) => (
          <g key={i} fill="#ffffff" fillOpacity="0.92">
            <rect x={spec.width * fx} y={spec.horizon * fy} width={104 * s} height={20 * s} rx={10 * s} />
            <rect x={spec.width * fx + 24 * s} y={spec.horizon * fy - 14 * s} width={60 * s} height={20 * s} rx={10 * s} />
          </g>
        ))}

        {/* run-off apron, then the court itself */}
        <polygon points={ring(APRON_ACROSS, APRON_ALONG)} fill={APRON} />
        <polygon points={ring(0, 0)} fill={COURT} />

        <g fill={LINE} fillOpacity="0.95">
          <polygon points={lineDownCourt(spec, 0, line)} />
          <polygon points={lineDownCourt(spec, 100, line)} />
          <polygon points={lineDownCourt(spec, 11, line)} />
          <polygon points={lineDownCourt(spec, 89, line)} />
          <polygon points={lineAcrossCourt(spec, 0, 0, 100, line)} />
          <polygon points={lineAcrossCourt(spec, 100, 0, 100, line)} />
          <polygon points={lineAcrossCourt(spec, 26, 11, 89, line)} />
          <polygon points={lineAcrossCourt(spec, 74, 11, 89, line)} />
          <polygon points={courtLine(spec, [50, 26], [50, 74], line)} />
        </g>

        {/* Net: one quad for the face, a thin tape along its top, a post at
            each end. The same three shapes work under both cameras. */}
        <polygon
          points={poly([
            { x: netA.x, y: netTopA },
            { x: netB.x, y: netTopB },
            { x: netB.x, y: netB.y },
            { x: netA.x, y: netA.y },
          ])}
          fill="#ffffff"
          fillOpacity="0.13"
        />
        {/* Stroked rather than filled: side-on the tape runs steeply down the
            screen, and a quad given its thickness in y all but vanishes at
            that angle. A stroke is always thick perpendicular to itself. */}
        <line
          x1={netA.x}
          y1={netTopA}
          x2={netB.x}
          y2={netTopB}
          stroke={LINE}
          strokeWidth={ft(TAPE_FT)}
          strokeLinecap="round"
        />
        {[netA, netB].map((p, i) => (
          <rect
            key={i}
            x={p.x - ft(0.6, p.scale)}
            y={p.y - ft(NET_FT + 0.5, p.scale)}
            width={ft(1.2, p.scale)}
            height={ft(NET_FT + 0.5, p.scale)}
            fill="#eef3ff"
          />
        ))}

        {/* Head-on, player 2 stands beyond the net and has to be painted
            before it; side-on they're both level with it. */}
        {spec.sideOn ? null : player(2, p2Ref)}
        <ellipse ref={shadowRef} rx="12" ry="6" fill="#0b1436" opacity="0.3" />
        {spec.sideOn ? player(2, p2Ref) : null}
        {player(1, p1Ref)}

        <circle ref={ballRef} r="11" fill="#e8ff8a" stroke="#a3d129" strokeWidth="2" />

        {/* contact flash — invisible until the loop adds `is-hit` */}
        <circle ref={impactRef} className="tennis-impact" r="0" fill="#fff8bd" />
      </g>
    </svg>
  );
}
