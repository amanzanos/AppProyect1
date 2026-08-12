"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ControllerShell from "@/components/games/ControllerShell";
import { BOWLING_COLLECTION, sendDelivery, useBowlingRoom } from "@/lib/data/bowlingGame";
import { vibrateSuccess } from "@/lib/haptics";
import type { PlayerSlot } from "@/lib/data/gameRoom";

/** Degrees of tilt that move the aim from the middle to the gutter. */
const TILT_SPAN = 16;
/** Low-pass on the tilt: raw readings shake the line off a board. */
const SMOOTHING = 0.16;
/** The aim stops short of the gutter, so a steady hand always finds wood. */
const AIM_LIMIT = 0.86;

const ARM = 8;
const RELEASE = 4;
const THROW_MAX_MS = 280;
const COOLDOWN_MS = 1200;
const IDEAL_PEAK = 17;
const GRAVITY = 9.81;
const TAP_POWER = 0.9;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

function BowlingPad({ room, slot }: { room: string; slot: PlayerSlot }) {
  const [started, setStarted] = useState(false);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [mode, setMode] = useState<"tilt" | "touch">("touch");
  const [thrown, setThrown] = useState(0);
  const [flash, setFlash] = useState(false);

  const state = useBowlingRoom(room);
  const myTurn = (state?.turn ?? 1) === slot;
  const myTurnRef = useRef(myTurn);

  const aim = useRef(0);
  const spin = useRef(0);
  /** The line as it was when the throwing action began — the swing itself
      turns the phone, so reading the tilt at the end would bowl the wobble
      rather than the line the player picked. */
  const aimAtArm = useRef(0);
  const neutral = useRef<number | null>(null);
  const lineRef = useRef<SVGLineElement>(null);
  const curveRef = useRef<SVGPathElement>(null);
  const lastThrow = useRef(0);
  const armedAt = useRef(0);
  const peak = useRef(0);

  useEffect(() => {
    const DME = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- probing a browser capability (iOS gates the sensors behind a prompt) that isn't readable during render
    setNeedsPermission(typeof DME?.requestPermission === "function");
  }, []);

  useEffect(() => {
    myTurnRef.current = myTurn;
  }, [myTurn]);

  /** Redraws the aiming line and the curve the hook would put on it. */
  const paint = useCallback(() => {
    const a = aim.current;
    const s = spin.current;
    lineRef.current?.setAttribute("x1", `${50 + a * 42}`);
    lineRef.current?.setAttribute("x2", `${50 + a * 42}`);
    // Straight down the lane, then bending over the back half.
    const endX = 50 + (a + s * 0.42) * 42;
    curveRef.current?.setAttribute("d", `M ${50 + a * 42} 96 L ${50 + a * 42} 52 Q ${50 + a * 42} 20 ${endX} 6`);
  }, []);

  const release = useCallback(
    (power: number) => {
      if (!room || !myTurnRef.current) return;
      const now = Date.now();
      if (now - lastThrow.current <= COOLDOWN_MS) return;
      lastThrow.current = now;
      sendDelivery(room, slot, aimAtArm.current, power, spin.current);
      vibrateSuccess();
      setThrown((n) => n + 1);
      setFlash(true);
      setTimeout(() => setFlash(false), 320);
    },
    [room, slot]
  );

  useEffect(() => {
    if (!started) return;

    function onOrientation(e: DeviceOrientationEvent) {
      if (e.gamma === null) return;
      setMode("tilt");
      if (neutral.current === null) neutral.current = e.gamma;
      const target = clamp((e.gamma - neutral.current) / TILT_SPAN, -AIM_LIMIT, AIM_LIMIT);
      aim.current += (target - aim.current) * SMOOTHING;
      paint();
    }

    function onMotion(e: DeviceMotionEvent) {
      const free = e.acceleration;
      let magnitude: number;
      if (free && free.x !== null && free.y !== null && free.z !== null) {
        magnitude = Math.sqrt(free.x ** 2 + free.y ** 2 + free.z ** 2);
      } else {
        const raw = e.accelerationIncludingGravity;
        if (!raw || raw.x === null || raw.y === null || raw.z === null) return;
        magnitude = Math.abs(Math.sqrt(raw.x ** 2 + raw.y ** 2 + raw.z ** 2) - GRAVITY);
      }

      const now = Date.now();
      if (now - lastThrow.current <= COOLDOWN_MS) return;

      if (!armedAt.current) {
        if (magnitude >= ARM) {
          armedAt.current = now;
          peak.current = magnitude;
          aimAtArm.current = aim.current;
        }
        return;
      }

      peak.current = Math.max(peak.current, magnitude);
      if (magnitude >= RELEASE && now - armedAt.current < THROW_MAX_MS) return;

      const strength = peak.current;
      armedAt.current = 0;
      peak.current = 0;
      release(clamp(strength / IDEAL_PEAK, 0.25, 1));
    }

    window.addEventListener("deviceorientation", onOrientation);
    window.addEventListener("devicemotion", onMotion);
    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("devicemotion", onMotion);
    };
  }, [started, paint, release]);

  /** Fallback for anything that doesn't report tilt: drag on the lane. */
  function drag(e: React.PointerEvent<SVGSVGElement>) {
    if (mode !== "touch") return;
    const r = e.currentTarget.getBoundingClientRect();
    aim.current = clamp((((e.clientX - r.left) / r.width) * 100 - 50) / 42, -AIM_LIMIT, AIM_LIMIT);
    aimAtArm.current = aim.current;
    paint();
  }

  function setSpin(v: number) {
    spin.current = v;
    paint();
  }

  async function handleStart() {
    for (const Ctor of [window.DeviceMotionEvent, window.DeviceOrientationEvent]) {
      const gated = Ctor as unknown as { requestPermission?: () => Promise<string> };
      if (typeof gated?.requestPermission === "function") {
        try {
          if ((await gated.requestPermission()) !== "granted") return;
        } catch {
          return;
        }
      }
    }
    setStarted(true);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center text-white">
      {!started ? (
        <>
          <button
            onClick={handleStart}
            className="rounded-full bg-white px-9 py-4 font-heading text-lg font-extrabold text-neutral-800 shadow-xl active:scale-95"
          >
            {needsPermission ? "Activar el mando" : "¡Listo para tirar!"}
          </button>
          <p className="max-w-[250px] text-sm text-white/70">
            Inclina el móvil para elegir la línea y lánzalo hacia delante para soltar la bola
          </p>
        </>
      ) : (
        <>
          <svg
            onPointerDown={drag}
            onPointerMove={(e) => e.buttons && drag(e)}
            viewBox="0 0 100 100"
            className={`w-full max-w-[260px] touch-none transition-opacity ${myTurn ? "opacity-100" : "opacity-40"}`}
            style={{ aspectRatio: "1 / 1.35" }}
          >
            {/* the lane, from above */}
            <rect x="4" y="2" width="92" height="96" rx="4" fill="#f0d7a6" />
            <rect x="4" y="2" width="8" height="96" fill="#d9534f" />
            <rect x="88" y="2" width="8" height="96" fill="#d9534f" />
            {[-0.6, -0.3, 0, 0.3, 0.6].map((x) => (
              <circle key={x} cx={50 + x * 42} cy="42" r="1.6" fill="#dcbc85" />
            ))}
            {/* the rack at the far end */}
            {[
              [0, 0],
              [-0.5, 1],
              [0.5, 1],
              [-1, 2],
              [0, 2],
              [1, 2],
              [-1.5, 3],
              [-0.5, 3],
              [0.5, 3],
              [1.5, 3],
            ].map(([px, py], i) => (
              <circle key={i} cx={50 + px * 6.5} cy={16 - py * 5} r="2.3" fill="#fdfbf4" stroke="#e0413f" strokeWidth="0.7" />
            ))}

            <path ref={curveRef} d="M 50 96 L 50 52 Q 50 20 50 6" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.2" strokeDasharray="3 3" />
            <line ref={lineRef} x1="50" y1="96" x2="50" y2="90" stroke="#ffffff" strokeWidth="0" />
            <circle cx="50" cy="96" r="4.5" fill="#c0335f" opacity={flash ? 0.4 : 1} />
          </svg>

          {/* hook */}
          <div className="flex w-full max-w-[260px] items-center gap-2">
            <span className="text-[10px] font-black text-white/50">↰</span>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.05}
              defaultValue={0}
              onChange={(e) => setSpin(Number(e.target.value))}
              aria-label="Efecto"
              className="h-1.5 flex-1 accent-white"
            />
            <span className="text-[10px] font-black text-white/50">↱</span>
          </div>

          {myTurn ? (
            <button
              onClick={() => release(TAP_POWER)}
              className="rounded-full bg-white px-8 py-3.5 font-heading text-base font-extrabold text-neutral-800 shadow-xl active:scale-95"
            >
              🎳 Lanzar
            </button>
          ) : (
            <p className="rounded-full bg-black/30 px-5 py-2.5 text-sm font-bold text-white/70">Espera tu turno…</p>
          )}

          <p className="text-xs text-white/55">
            {mode === "tilt" ? "Inclina para la línea · lanza el móvil hacia delante" : "Arrastra en la pista para la línea"}
          </p>

          <p className="text-xs font-bold text-white/50">{thrown} bolas</p>
        </>
      )}
    </div>
  );
}

function BowlingControllerInner() {
  const room = useSearchParams().get("room");
  return (
    <ControllerShell collection={BOWLING_COLLECTION} room={room} emoji="🎳">
      {({ slot }) => <BowlingPad room={room!} slot={slot} />}
    </ControllerShell>
  );
}

export default function BowlingControllerPage() {
  return (
    <Suspense fallback={null}>
      <BowlingControllerInner />
    </Suspense>
  );
}
