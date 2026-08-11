"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Crosshair, Wifi, X } from "lucide-react";
import Dartboard, { BOARD_EXTENT } from "@/components/games/Dartboard";
import { AIM_LIMIT, clampAim } from "@/lib/darts";
import { joinDartsRoom, sendDartThrow, useDartsRoom } from "@/lib/data/dartsGame";
import { useRoomPlayers } from "@/lib/roomPlayers";
import { vibrateSuccess } from "@/lib/haptics";

/** Degrees of tilt that move the crosshair a full board radius. */
const TILT_SPAN = 20;
/** Low-pass on the tilt. Raw readings jitter enough to shake the aim off a bed. */
const SMOOTHING = 0.16;

const ARM = 8; // m/s² of gravity-free acceleration that starts a throw
const RELEASE = 4;
const THROW_MAX_MS = 260;
const COOLDOWN_MS = 900;
const IDEAL_PEAK = 16; // the strength that throws cleanest
const GRAVITY = 9.81;
const TAP_QUALITY = 0.75;

function DartsControllerInner() {
  const router = useRouter();
  const params = useSearchParams();
  const room = params.get("room");
  const player = params.get("player") === "2" ? 2 : 1;
  const me = useRoomPlayers("dartsGames", room)[player];

  const [started, setStarted] = useState(false);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [mode, setMode] = useState<"tilt" | "touch">("touch");
  const [thrown, setThrown] = useState(0);
  const [flash, setFlash] = useState(false);

  const state = useDartsRoom(room);
  const myTurn = (state?.turn ?? 1) === player;
  const myTurnRef = useRef(myTurn);

  const aim = useRef({ x: 0, y: 0 });
  /** The aim as it was when the throwing action began — the flick itself
      swings the phone about, so reading the tilt at the end would score the
      wobble rather than where the player was actually pointing. */
  const aimAtArm = useRef({ x: 0, y: 0 });
  const neutral = useRef<{ gamma: number; beta: number } | null>(null);
  const crossRef = useRef<SVGGElement>(null);
  const lastThrow = useRef(0);
  const armedAt = useRef(0);
  const peak = useRef(0);

  useEffect(() => {
    const DME = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- probing a browser capability (iOS gates the sensors behind a prompt) that isn't readable during render
    setNeedsPermission(typeof DME?.requestPermission === "function");
  }, []);

  // Mirrored into a ref so the sensor handlers, which are set up once, always
  // see the current turn without being torn down and rebuilt on every change.
  useEffect(() => {
    myTurnRef.current = myTurn;
  }, [myTurn]);

  useEffect(() => {
    if (!room) return;
    joinDartsRoom(room, player);
  }, [room, player]);

  const paint = useCallback(() => {
    crossRef.current?.setAttribute("transform", `translate(${aim.current.x} ${aim.current.y})`);
  }, []);

  const release = useCallback(
    (quality: number, from: { x: number; y: number }) => {
      if (!room || !myTurnRef.current) return;
      const now = Date.now();
      if (now - lastThrow.current <= COOLDOWN_MS) return;
      lastThrow.current = now;
      sendDartThrow(room, player, from.x, from.y, quality);
      vibrateSuccess();
      setThrown((n) => n + 1);
      setFlash(true);
      setTimeout(() => setFlash(false), 260);
    },
    [room, player]
  );

  // Aiming by tilt, smoothed and clamped so the crosshair cannot leave the
  // board — the only thing that can miss now is the throw itself.
  useEffect(() => {
    if (!started) return;

    function onOrientation(e: DeviceOrientationEvent) {
      if (e.gamma === null || e.beta === null) return;
      setMode("tilt");
      if (!neutral.current) neutral.current = { gamma: e.gamma, beta: e.beta };
      const target = clampAim(
        (e.gamma - neutral.current.gamma) / TILT_SPAN,
        (e.beta - neutral.current.beta) / TILT_SPAN
      );
      aim.current = {
        x: aim.current.x + (target.x - aim.current.x) * SMOOTHING,
        y: aim.current.y + (target.y - aim.current.y) * SMOOTHING,
      };
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
          aimAtArm.current = { ...aim.current };
        }
        return;
      }

      peak.current = Math.max(peak.current, magnitude);
      if (magnitude >= RELEASE && now - armedAt.current < THROW_MAX_MS) return;

      const strength = peak.current;
      armedAt.current = 0;
      peak.current = 0;
      const quality = Math.min(Math.max(1 - Math.abs(strength - IDEAL_PEAK) / IDEAL_PEAK, 0.15), 1);
      release(quality, aimAtArm.current);
    }

    window.addEventListener("deviceorientation", onOrientation);
    window.addEventListener("devicemotion", onMotion);
    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("devicemotion", onMotion);
    };
  }, [started, paint, release]);

  /** Fallback aiming for anything that doesn't report tilt: drag on the board. */
  function drag(e: React.PointerEvent<SVGSVGElement>) {
    if (mode !== "touch") return;
    const r = e.currentTarget.getBoundingClientRect();
    const span = (BOARD_EXTENT + 0.1) * 2;
    aim.current = clampAim(
      ((e.clientX - r.left) / r.width) * span - span / 2,
      ((e.clientY - r.top) / r.height) * span - span / 2
    );
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

  if (!room) {
    return (
      <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-3 bg-neutral-900 px-8 text-center text-white">
        <span className="text-4xl">🎯</span>
        <p className="font-heading text-lg font-bold">Falta el código de sala</p>
        <p className="text-sm text-white/60">Escanea el QR de la pantalla grande para unirte a la partida.</p>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-4 px-6 text-center text-white"
      style={{ background: `radial-gradient(circle at 50% 15%, ${me.color} 0%, #16121a 72%)` }}
    >
      <button
        onClick={() => router.push("/games")}
        aria-label="Salir"
        className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 active:scale-95"
      >
        <X size={20} />
      </button>

      <span className="absolute right-4 top-5 flex items-center gap-1.5 text-[11px] font-bold text-white/70">
        <Wifi size={13} /> SALA {room}
      </span>

      <p className="font-heading text-2xl font-black drop-shadow">{me.name}</p>

      {!started ? (
        <>
          <button
            onClick={handleStart}
            className="rounded-full bg-white px-9 py-4 font-heading text-lg font-extrabold text-neutral-800 shadow-xl active:scale-95"
          >
            {needsPermission ? "Activar el mando" : "¡Listo para tirar!"}
          </button>
          <p className="max-w-[250px] text-sm text-white/70">
            Inclina el móvil para mover la mira y lánzalo hacia delante para tirar
          </p>
        </>
      ) : (
        <>
          <svg
            onPointerDown={drag}
            onPointerMove={(e) => e.buttons && drag(e)}
            viewBox={`${-BOARD_EXTENT - 0.1} ${-BOARD_EXTENT - 0.1} ${(BOARD_EXTENT + 0.1) * 2} ${(BOARD_EXTENT + 0.1) * 2}`}
            className={`aspect-square w-full max-w-[300px] touch-none transition-opacity ${
              myTurn ? "opacity-100" : "opacity-40"
            }`}
          >
            <Dartboard />
            <circle cx="0" cy="0" r={AIM_LIMIT} fill="none" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="0.008" strokeDasharray="0.04 0.04" />
            <g ref={crossRef}>
              <circle r="0.13" fill="none" stroke="#ffffff" strokeWidth="0.022" opacity={flash ? 0.35 : 0.95} />
              <line x1="-0.2" y1="0" x2="-0.05" y2="0" stroke="#ffffff" strokeWidth="0.02" />
              <line x1="0.05" y1="0" x2="0.2" y2="0" stroke="#ffffff" strokeWidth="0.02" />
              <line x1="0" y1="-0.2" x2="0" y2="-0.05" stroke="#ffffff" strokeWidth="0.02" />
              <line x1="0" y1="0.05" x2="0" y2="0.2" stroke="#ffffff" strokeWidth="0.02" />
            </g>
          </svg>

          {myTurn ? (
            <button
              onClick={() => release(TAP_QUALITY, aim.current)}
              className="rounded-full bg-white px-8 py-3.5 font-heading text-base font-extrabold text-neutral-800 shadow-xl active:scale-95"
            >
              🎯 Lanzar
            </button>
          ) : (
            <p className="rounded-full bg-black/30 px-5 py-2.5 text-sm font-bold text-white/70">
              Espera tu turno…
            </p>
          )}

          <p className="flex items-center gap-1.5 text-xs text-white/60">
            <Crosshair size={12} />
            {mode === "tilt" ? "Inclina para apuntar · lanza el móvil hacia delante" : "Arrastra en la diana para apuntar"}
          </p>

          <button
            onClick={() => {
              neutral.current = null;
              aim.current = { x: 0, y: 0 };
              paint();
            }}
            className="text-[11px] font-bold uppercase tracking-wide text-white/45 underline underline-offset-4"
          >
            Centrar la mira
          </button>

          <p className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] text-xs font-bold text-white/50">
            {thrown} dardos
          </p>
        </>
      )}
    </div>
  );
}

export default function DartsControllerPage() {
  return (
    <Suspense fallback={null}>
      <DartsControllerInner />
    </Suspense>
  );
}
