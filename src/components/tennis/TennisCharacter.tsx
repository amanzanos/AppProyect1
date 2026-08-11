"use client";

interface TennisCharacterProps {
  /** Shirt colour for this player. */
  color: string;
  /** Blocky ponytail so the two players read apart from across the room. */
  longHair?: boolean;
  /** Mirrors the sprite so both players face the net. */
  flip?: boolean;
  size?: number;
  /** Offsets used when this renders as a nested <svg> inside the court scene,
      so the sprite can be anchored by its feet. */
  x?: number;
  y?: number;
}

const SKIN = "#f6cda4";
const SKIN_SIDE = "#dcae86";
const HAIR = "#2e241f";
const HAIR_SIDE = "#1d1613";
const SHORTS = "#f2f2f2";
const SHORTS_SIDE = "#d3d3d3";

function shade(hex: string, amount = 0.78) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.round(((n >> 16) & 255) * amount);
  const g = Math.round(((n >> 8) & 255) * amount);
  const b = Math.round((n & 255) * amount);
  return `rgb(${r},${g},${b})`;
}

// Blocky voxel sprite to match the arcade-3D look of the court: hard edges,
// flat fills, and a darker strip down the right of every block so each one
// reads as a lit cube. Both arms and the emote marks are separate groups so
// globals.css can swing, cheer or sulk with them.
export default function TennisCharacter({ color, longHair = false, flip = false, size = 78, x, y }: TennisCharacterProps) {
  const side = shade(color);

  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={(size * 84) / 60}
      viewBox="0 0 60 84"
      fill="none"
      shapeRendering="crispEdges"
      className="tennis-figure overflow-visible"
      style={{ display: "block", ...(flip ? { transform: "scaleX(-1)" } : {}) }}
      aria-hidden
    >
      {/* legs */}
      <rect x="19" y="62" width="9" height="16" fill={SKIN} />
      <rect x="25" y="62" width="3" height="16" fill={SKIN_SIDE} />
      <rect x="32" y="62" width="9" height="16" fill={SKIN} />
      <rect x="38" y="62" width="3" height="16" fill={SKIN_SIDE} />
      {/* shoes */}
      <rect x="17" y="78" width="12" height="6" fill="#ffffff" />
      <rect x="31" y="78" width="12" height="6" fill="#ffffff" />

      {/* shorts / skirt */}
      <rect x="17" y="52" width="26" height="12" fill={SHORTS} />
      <rect x="37" y="52" width="6" height="12" fill={SHORTS_SIDE} />
      {longHair && <rect x="15" y="52" width="30" height="9" fill={color} opacity="0.9" />}

      {/* torso */}
      <rect x="17" y="34" width="26" height="20" fill={color} />
      <rect x="37" y="34" width="6" height="20" fill={side} />

      {/* left arm */}
      <g className="tennis-arm-left">
        <rect x="10" y="35" width="7" height="17" fill={SKIN} />
        <rect x="14" y="35" width="3" height="17" fill={SKIN_SIDE} />
      </g>

      {/* right arm + racket — animated group */}
      <g className="tennis-arm">
        <rect x="43" y="35" width="7" height="16" fill={SKIN} />
        <rect x="47" y="35" width="3" height="16" fill={SKIN_SIDE} />
        {/* grip */}
        <rect x="44" y="50" width="5" height="9" fill="#8a5a2b" />
        {/* racket head */}
        <rect x="38" y="57" width="18" height="20" fill="#ffffff" />
        <rect x="41" y="60" width="12" height="14" fill="#3fae6a" />
        <rect x="44" y="60" width="1.5" height="14" fill="#ffffff" opacity="0.75" />
        <rect x="48.5" y="60" width="1.5" height="14" fill="#ffffff" opacity="0.75" />
        <rect x="41" y="64" width="12" height="1.5" fill="#ffffff" opacity="0.75" />
        <rect x="41" y="69" width="12" height="1.5" fill="#ffffff" opacity="0.75" />
      </g>

      {/* head */}
      <rect x="16" y="12" width="28" height="22" fill={SKIN} />
      <rect x="38" y="12" width="6" height="22" fill={SKIN_SIDE} />
      {/* hair */}
      <rect x="16" y="8" width="28" height="8" fill={HAIR} />
      <rect x="38" y="8" width="6" height="8" fill={HAIR_SIDE} />
      {longHair && <rect x="13" y="12" width="4" height="22" fill={HAIR} />}
      {longHair && <rect x="43" y="12" width="4" height="22" fill={HAIR_SIDE} />}
      {/* headband in the player colour */}
      <rect x="16" y="16" width="28" height="3" fill={color} />
      <rect x="38" y="16" width="6" height="3" fill={side} />
      {/* eyes */}
      <rect x="22" y="23" width="4" height="5" fill="#241f1c" />
      <rect x="33" y="23" width="4" height="5" fill="#241f1c" />

      {/* celebration sparkles above the head */}
      <g className="tennis-emote-happy">
        <rect x="7" y="0" width="5" height="5" fill="#ffd93d" />
        <rect x="27" y="-6" width="6" height="6" fill="#ffe66d" />
        <rect x="48" y="1" width="5" height="5" fill="#ffd93d" />
        <rect x="17" y="-3" width="4" height="4" fill="#fff3b0" />
        <rect x="40" y="-4" width="4" height="4" fill="#fff3b0" />
      </g>

      {/* anger mark above the head */}
      <g className="tennis-emote-angry">
        <rect x="40" y="-7" width="14" height="3" fill="#e8323c" />
        <rect x="40" y="-7" width="3" height="12" fill="#e8323c" />
        <rect x="51" y="-7" width="3" height="12" fill="#e8323c" />
        <rect x="40" y="2" width="14" height="3" fill="#e8323c" />
      </g>
    </svg>
  );
}
