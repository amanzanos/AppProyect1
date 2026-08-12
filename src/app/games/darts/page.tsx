"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { X } from "lucide-react";
import Dartboard, { BOARD_EXTENT } from "@/components/games/Dartboard";
import MatchOver from "@/components/games/MatchOver";
import GameLobby from "@/components/games/GameLobby";
import { FLIGHT_S, aimedThrow, flightPoint, scoreAt, type Flight } from "@/lib/darts";
import { setTurn, type PlayerSlot, type Seat } from "@/lib/data/gameRoom";
import { DARTS_COLLECTION, createDartsRoom, randomRoomCode, useDartsRoom } from "@/lib/data/dartsGame";

const DARTS_EACH = 5;
const SETTLE_MS = 1400;

type Phase = "lobby" | "playing" | "over";

const STEPS = [
  { icon: "📱", text: "Todos escanean el mismo QR — hasta 8 jugadores" },
  { icon: "🎯", text: "Inclina el móvil para apuntar en su pantalla" },
  { icon: "🏆", text: "Lánzalo hacia delante — cinco dardos cada uno, por turnos" },
];

/** Tip at the origin, so it can be dropped straight onto its landing point. */
function Dart({ color }: { color: string }) {
  return (
    <g>
      <rect x="-0.006" y="0" width="0.012" height="0.17" fill="#dfe4ec" />
      <rect x="-0.021" y="0.15" width="0.042" height="0.12" rx="0.012" fill="#6f7788" />
      <path d="M -0.062 0.41 L 0 0.26 L 0.062 0.41 L 0 0.35 Z" fill={color} />
    </g>
  );
}

/** The next player round the table who still has darts left. */
function nextThrower(slots: PlayerSlot[], current: PlayerSlot, thrown: Record<PlayerSlot, number>) {
  const from = Math.max(slots.indexOf(current), 0);
  for (let i = 1; i <= slots.length; i++) {
    const slot = slots[(from + i) % slots.length];
    if ((thrown[slot] ?? 0) < DARTS_EACH) return slot;
  }
  return null;
}

export default function DartsPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("lobby");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  const [playing, setPlaying] = useState<Record<PlayerSlot, Seat>>({});
  const [turn, setTurnState] = useState<PlayerSlot>(1);
  const [thrown, setThrown] = useState<Record<PlayerSlot, number>>({});
  const [totals, setTotals] = useState<Record<PlayerSlot, number>>({});
  const [landed, setLanded] = useState<{ x: number; y: number; color: string }[]>([]);
  const [popup, setPopup] = useState<{ x: number; y: number; value: number; label: string; id: number } | null>(null);

  const room = useDartsRoom(roomId);
  // One flying dart, parked out of sight, tinted for whoever is throwing.
  // Driving it from a ref rather than from state keeps starting a flight off
  // the render path entirely — nothing about the board changes, only the dart
  // moves.
  const dartRef = useRef<SVGGElement>(null);
  const rafRef = useRef(0);
  /** Throws already played, so one is never counted twice. */
  const consumed = useRef<Record<PlayerSlot, number>>({});
  const busy = useRef(false);

  useEffect(() => {
    const id = randomRoomCode();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot random room code minted on mount; Math.random() can't run during render
    setRoomId(id);
    createDartsRoom(id);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const origin = window.location.origin;
    QRCode.toDataURL(`${origin}/games/darts/play?room=${roomId}`, {
      margin: 1,
      width: 320,
      color: { dark: "#3a0d12", light: "#ffffff" },
    }).then(setQr);
  }, [roomId]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const slots = Object.keys(playing).map(Number);
  const thrower = playing[turn];

  const finish = useCallback(
    (f: Flight, slot: PlayerSlot) => {
      const hit = scoreAt(f.x, f.y);
      const color = playing[slot]?.color ?? "#ffffff";
      setLanded((l) => [...l, { x: f.x, y: f.y, color }]);
      setPopup({ x: f.x, y: f.y, value: hit.value, label: hit.label, id: Date.now() });
      setTotals((t) => ({ ...t, [slot]: (t[slot] ?? 0) + hit.value }));

      const count = (thrown[slot] ?? 0) + 1;
      const after = { ...thrown, [slot]: count };
      setThrown(after);

      setTimeout(() => {
        setPopup(null);
        dartRef.current?.setAttribute("display", "none");
        busy.current = false;
        // Round-robin: one dart each, then on to the next player who still has
        // some left. When nobody has, the match is over.
        const next = nextThrower(slots, slot, after);
        if (next === null) {
          setPhase("over");
          return;
        }
        setTurnState(next);
        if (roomId) setTurn(DARTS_COLLECTION, roomId, next);
      }, SETTLE_MS);
    },
    [thrown, roomId, slots, playing]
  );

  /** Fly the dart along the parabola the throw actually produced. */
  const play = useCallback(
    (f: Flight, slot: PlayerSlot) => {
      const el = dartRef.current;
      el?.removeAttribute("display");
      const started = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - started) / 1000, FLIGHT_S);
        const p = flightPoint(f, t);
        const scale = 2.4 - 1.4 * (t / FLIGHT_S);
        el?.setAttribute("transform", `translate(${p.x} ${p.y}) rotate(-16) scale(${scale})`);
        if (t < FLIGHT_S) {
          rafRef.current = requestAnimationFrame(step);
          return;
        }
        finish(f, slot);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [finish]
  );

  // Only the phone whose go it is gets listened to. A throw from anyone else is
  // remembered as consumed so it can't fire the moment the turn comes round.
  useEffect(() => {
    if (phase !== "playing" || busy.current) return;
    const sent = room?.controls[turn];
    if (!sent || sent.at <= (consumed.current[turn] ?? 0)) return;
    consumed.current[turn] = sent.at;
    if ((thrown[turn] ?? 0) >= DARTS_EACH) return;
    busy.current = true;
    play(aimedThrow(sent.x, sent.y, sent.quality), turn);
  }, [room, phase, turn, thrown, play]);

  const start = useCallback(() => {
    const seats = room?.seats ?? {};
    const order = Object.keys(seats).map(Number).sort((a, b) => a - b);
    // Whatever each phone had already sent when the match started, so a throw
    // made while the lobby was still up doesn't fire off the first dart.
    consumed.current = Object.fromEntries(order.map((s) => [s, room?.controls[s]?.at ?? 0]));
    setPlaying(seats);
    setThrown(Object.fromEntries(order.map((s) => [s, 0])));
    setTotals(Object.fromEntries(order.map((s) => [s, 0])));
    setLanded([]);
    setPopup(null);
    setPhase("playing");
    const first = order[0] ?? 1;
    setTurnState(first);
    if (roomId) setTurn(DARTS_COLLECTION, roomId, first);
  }, [room, roomId]);

  if (phase === "lobby") {
    return (
      <div className="fixed inset-0 z-[999]">
        <GameLobby
          title="DARDOS"
          emoji="🎯"
          background="radial-gradient(circle at 50% -10%, #8c2230 0%, #4a121c 45%, #1c0a0e 100%)"
          steps={STEPS}
          roomId={roomId}
          qr={qr}
          seats={room?.seats ?? {}}
          minPlayers={1}
          onStart={start}
          onExit={() => router.push("/games")}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[999] flex flex-col bg-[#0d0f16] text-white">
      <div className="flex items-center justify-between gap-3 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button
          onClick={() => setPhase("lobby")}
          aria-label="Salir"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 active:scale-95"
        >
          <X size={20} />
        </button>

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl bg-white/10 px-3 py-1.5">
          {slots.map((slot) => (
            <div key={slot} className="flex items-center gap-1.5" style={{ opacity: turn === slot ? 1 : 0.4 }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: playing[slot].color }} />
              <span className="text-[11px] font-bold text-white/70">{playing[slot].name}</span>
              <span className="tnum font-heading text-xl font-black leading-none">{totals[slot] ?? 0}</span>
            </div>
          ))}
        </div>

        <span className="w-10 shrink-0 text-right text-[11px] font-bold text-white/50">
          {"•".repeat(Math.max(DARTS_EACH - (thrown[turn] ?? 0), 0))}
        </span>
      </div>

      {/* Nothing but the board and the dart. */}
      <div className="relative flex flex-1 items-center justify-center px-4">
        <svg
          viewBox={`${-BOARD_EXTENT - 0.1} ${-BOARD_EXTENT - 0.1} ${(BOARD_EXTENT + 0.1) * 2} ${(BOARD_EXTENT + 0.1) * 2}`}
          className="aspect-square w-full max-w-[min(94vw,72vh)]"
        >
          <Dartboard />

          {landed.map((d, i) => (
            <g key={i} transform={`translate(${d.x} ${d.y}) rotate(-16)`} opacity="0.85">
              <Dart color={d.color} />
            </g>
          ))}

          <g ref={dartRef} display="none">
            <Dart color={thrower?.color ?? "#ffffff"} />
          </g>

          {/* The score lands where the dart did. */}
          {popup && (
            // Lifted clear of the dart, which is standing in the same spot.
            <g transform={`translate(${popup.x} ${popup.y - 0.12})`}>
              <g className="dart-pop">
                <text
                  textAnchor="middle"
                  fontSize="0.24"
                  fontWeight="900"
                  fill={popup.value ? "#ffe066" : "#ff8a8a"}
                  stroke="#0d0f16"
                  strokeWidth="0.03"
                  paintOrder="stroke"
                >
                  +{popup.value}
                </text>
                <text
                  y="0.17"
                  textAnchor="middle"
                  fontSize="0.1"
                  fontWeight="800"
                  fill="#ffffff"
                  stroke="#0d0f16"
                  strokeWidth="0.026"
                  paintOrder="stroke"
                >
                  {popup.label}
                </text>
              </g>
            </g>
          )}
        </svg>
      </div>

      <p className="pb-[calc(1rem+env(safe-area-inset-bottom))] text-center text-xs font-semibold">
        <span style={{ color: thrower?.color }}>Tira {thrower?.name}</span>
        <span className="text-white/40"> · apunta con el móvil y lánzalo</span>
      </p>

      {phase === "over" && (
        <MatchOver
          game="darts"
          seats={playing}
          scores={totals}
          unit="puntos"
          onPlayAgain={start}
          onExit={() => router.push("/games")}
        />
      )}
    </div>
  );
}
