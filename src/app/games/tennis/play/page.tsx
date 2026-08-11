"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Wifi, X } from "lucide-react";
import TennisCharacter from "@/components/tennis/TennisCharacter";
import { joinTennisRoom, sendTennisHit } from "@/lib/data/tennisGame";
import { useRoomPlayers } from "@/lib/roomPlayers";
import { TENNIS_LOOKS } from "@/lib/tennisTypes";
import { vibrateSuccess } from "@/lib/haptics";

/**
 * A swing isn't a single spike, it's an accelerate-then-stop gesture. We arm on
 * the way up, follow the peak, and only send the hit once the phone slows down
 * again (or the window expires). That rejects the small jitters of just holding
 * the phone, and the peak gives a much truer power reading than the first frame
 * that happened to cross a threshold.
 */
const SWING_ARM = 9.5; // m/s² of gravity-free acceleration that starts a swing
const SWING_RELEASE = 5; // falling back below this ends it
const SWING_MAX_MS = 260; // fire anyway if the phone never settles
/**
 * Firestore only sustains about one write a second to a single document, and
 * every swing is one write. Swinging faster than this doesn't queue up — the
 * extra swings are simply dropped, which keeps the racket's position landing
 * on the projector instantly instead of backing up seconds behind play. The
 * ball takes a couple of seconds to cross the court, so this still leaves
 * several chances to time a return.
 */
const SWING_COOLDOWN_MS = 750;
const GRAVITY = 9.81;

function powerFromPeak(peak: number) {
  if (peak < 15) return 1;
  if (peak < 24) return 2;
  return 3;
}

function TennisControllerInner() {
  const router = useRouter();
  const params = useSearchParams();
  const room = params.get("room");
  const player = params.get("player") === "2" ? 2 : 1;
  const me = useRoomPlayers("tennisGames", room)[player];

  const [started, setStarted] = useState(false);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [hits, setHits] = useState(0);
  const [swinging, setSwinging] = useState(false);
  const lastSwingRef = useRef(0);
  const armedAtRef = useRef(0);
  const peakRef = useRef(0);

  useEffect(() => {
    const DME = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- probing a browser capability (iOS gates motion behind a permission prompt) that isn't readable during render
    setNeedsPermission(typeof DME?.requestPermission === "function");
  }, []);

  useEffect(() => {
    if (!room) return;
    joinTennisRoom(room, player);
  }, [room, player]);

  const registerHit = useCallback(
    (power: number) => {
      if (!room) return;
      // The tap button goes through the same rate limit as a real swing.
      const now = Date.now();
      if (now - lastSwingRef.current <= SWING_COOLDOWN_MS) return;
      lastSwingRef.current = now;
      sendTennisHit(room, player, power);
      vibrateSuccess();
      setHits((h) => h + 1);
      setSwinging(true);
      setTimeout(() => setSwinging(false), 220);
    },
    [room, player]
  );

  useEffect(() => {
    if (!started || !room) return;

    function handleMotion(e: DeviceMotionEvent) {
      // `acceleration` already has gravity removed; where it isn't reported we
      // approximate it by taking the constant 1g out of the total magnitude.
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
      if (now - lastSwingRef.current <= SWING_COOLDOWN_MS) return;

      if (!armedAtRef.current) {
        if (magnitude >= SWING_ARM) {
          armedAtRef.current = now;
          peakRef.current = magnitude;
        }
        return;
      }

      peakRef.current = Math.max(peakRef.current, magnitude);
      const settled = magnitude < SWING_RELEASE;
      if (!settled && now - armedAtRef.current < SWING_MAX_MS) return;

      const peak = peakRef.current;
      armedAtRef.current = 0;
      peakRef.current = 0;
      registerHit(powerFromPeak(peak)); // owns the cooldown stamp
    }

    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [started, room, registerHit]);

  async function handleStart() {
    const DME = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof DME?.requestPermission === "function") {
      try {
        if ((await DME.requestPermission()) !== "granted") return;
      } catch {
        return;
      }
    }
    setStarted(true);
  }

  if (!room) {
    return (
      <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-3 bg-neutral-900 px-8 text-center text-white">
        <span className="text-4xl">🎾</span>
        <p className="font-heading text-lg font-bold">Falta el código de sala</p>
        <p className="text-sm text-white/60">Escanea el QR de la pantalla del proyector para unirte a la partida.</p>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-5 px-6 text-center text-white"
      style={{ background: `radial-gradient(circle at 50% 20%, ${me.color} 0%, #1b1b23 75%)` }}
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

      <div className={`tennis-sprite ${swinging ? "is-swinging" : ""}`}>
        <TennisCharacter color={me.color} longHair={TENNIS_LOOKS[player].longHair} size={120} />
      </div>

      <p className="font-heading text-3xl font-black drop-shadow">{me.name}</p>

      {!started ? (
        <>
          <button
            onClick={handleStart}
            className="rounded-full bg-white px-9 py-4 font-heading text-lg font-extrabold text-neutral-800 shadow-xl active:scale-95"
          >
            {needsPermission ? "Activar el mando" : "¡Listo para jugar!"}
          </button>
          <p className="max-w-[240px] text-sm text-white/70">
            Sujeta el móvil fuerte — vas a agitarlo como una raqueta
          </p>
        </>
      ) : (
        <>
          <button
            onClick={() => registerHit(1)}
            aria-label="Golpear"
            className={`flex h-36 w-36 items-center justify-center rounded-full bg-white/15 text-6xl shadow-inner transition-transform ${
              swinging ? "scale-90 bg-white/30" : "scale-100"
            }`}
          >
            🎾
          </button>
          <p className="max-w-[250px] text-sm leading-snug text-white/80">
            Agita el móvil para golpear la bola — o toca aquí si prefieres
          </p>
          <p className="rounded-full bg-black/25 px-4 py-1.5 text-xs font-bold tracking-wide text-white/80">
            {hits} golpes
          </p>
        </>
      )}
    </div>
  );
}

export default function TennisControllerPage() {
  return (
    <Suspense fallback={null}>
      <TennisControllerInner />
    </Suspense>
  );
}
