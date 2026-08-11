"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { X } from "lucide-react";
import Dartboard, { BOARD_EXTENT } from "@/components/games/Dartboard";
import MatchOver from "@/components/games/MatchOver";
import GameLobby from "@/components/games/GameLobby";
import { FLIGHT_S, aimedThrow, flightPoint, scoreAt, type Flight } from "@/lib/darts";
import { loadPlayers, usePlayers } from "@/lib/players";
import { setTurn } from "@/lib/data/gameRoom";
import { createDartsRoom, randomRoomCode, useDartsRoom, type DartsRoom, type PlayerSlot } from "@/lib/data/dartsGame";

const DARTS_EACH = 5;
const SETTLE_MS = 1400;

type Phase = "lobby" | "playing" | "over";


const STEPS = [
  { icon: "📱", text: "Cada uno escanea su QR con la cámara del móvil" },
  { icon: "🎯", text: "Inclina el móvil para apuntar en su pantalla" },
  { icon: "🏆", text: "Lánzalo hacia delante — cinco dardos cada uno" },
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

export default function DartsPage() {
  const { players } = usePlayers();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("lobby");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [qr1, setQr1] = useState<string | null>(null);
  const [qr2, setQr2] = useState<string | null>(null);

  const [turn, setTurnState] = useState<PlayerSlot>(1);
  const [thrown, setThrown] = useState<Record<PlayerSlot, number>>({ 1: 0, 2: 0 });
  const [totals, setTotals] = useState<Record<PlayerSlot, number>>({ 1: 0, 2: 0 });
  const [landed, setLanded] = useState<{ x: number; y: number; slot: PlayerSlot }[]>([]);
  const [popup, setPopup] = useState<{ x: number; y: number; value: number; label: string; id: number } | null>(null);

  const room = useDartsRoom(roomId);
  // One flying dart per player colour, both parked out of sight. Showing them
  // from a ref rather than from state keeps starting a flight off the render
  // path entirely — nothing about the board changes, only the dart moves.
  const dart1Ref = useRef<SVGGElement>(null);
  const dart2Ref = useRef<SVGGElement>(null);
  const rafRef = useRef(0);
  /** Throws already played, so one is never counted twice. */
  const consumed = useRef<Record<PlayerSlot, number>>({ 1: 0, 2: 0 });
  const busy = useRef(false);

  useEffect(() => {
    const id = randomRoomCode();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot random room code minted on mount; Math.random() can't run during render
    setRoomId(id);
    createDartsRoom(id, loadPlayers());
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const origin = window.location.origin;
    const opts = { margin: 1, width: 260, color: { dark: "#3a0d12", light: "#ffffff" } };
    QRCode.toDataURL(`${origin}/games/darts/play?room=${roomId}&player=1`, opts).then(setQr1);
    QRCode.toDataURL(`${origin}/games/darts/play?room=${roomId}&player=2`, opts).then(setQr2);
  }, [roomId]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const finish = useCallback(
    (f: Flight, slot: PlayerSlot) => {
      const hit = scoreAt(f.x, f.y);
      setLanded((l) => [...l, { x: f.x, y: f.y, slot }]);
      setPopup({ x: f.x, y: f.y, value: hit.value, label: hit.label, id: Date.now() });
      setTotals((t) => ({ ...t, [slot]: t[slot] + hit.value }));

      const count = thrown[slot] + 1;
      setThrown((c) => ({ ...c, [slot]: count }));

      setTimeout(() => {
        setPopup(null);
        for (const r of [dart1Ref, dart2Ref]) r.current?.setAttribute("display", "none");
        busy.current = false;
        const other: PlayerSlot = slot === 1 ? 2 : 1;
        if (count >= DARTS_EACH && thrown[other] >= DARTS_EACH) {
          setPhase("over");
          return;
        }
        // Hand over unless the other player has already finished their five.
        const next: PlayerSlot = thrown[other] < DARTS_EACH ? other : slot;
        setTurnState(next);
        if (roomId) setTurn("dartsGames", roomId, next);
      }, SETTLE_MS);
    },
    [thrown, roomId]
  );

  /** Fly the dart along the parabola the throw actually produced. */
  const play = useCallback(
    (f: Flight, slot: PlayerSlot) => {
      const el = (slot === 1 ? dart1Ref : dart2Ref).current;
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

  // Only the phone whose go it is gets listened to. A throw from the other one
  // is remembered as consumed so it can't fire the moment the turn changes.
  useEffect(() => {
    if (phase !== "playing" || busy.current) return;
    const sent = turn === 1 ? room?.player1Throw : room?.player2Throw;
    if (!sent || sent.at <= consumed.current[turn]) return;
    consumed.current[turn] = sent.at;
    if (thrown[turn] >= DARTS_EACH) return;
    busy.current = true;
    play(aimedThrow(sent.x, sent.y, sent.quality), turn);
  }, [room, phase, turn, thrown, play]);

  const start = useCallback(() => {
    const other = roomFor(room);
    consumed.current = { 1: other.p1, 2: other.p2 };
    setPhase("playing");
    setTurnState(1);
    if (roomId) setTurn("dartsGames", roomId, 1);
  }, [room, roomId]);

  function playAgain() {
    setLanded([]);
    setThrown({ 1: 0, 2: 0 });
    setTotals({ 1: 0, 2: 0 });
    setPopup(null);
    start();
  }

  const winner: PlayerSlot | null = totals[1] === totals[2] ? null : totals[1] > totals[2] ? 1 : 2;

  if (phase === "lobby") {
    return (
      <div className="fixed inset-0 z-[999]">
        <GameLobby
          title="DARDOS"
          emoji="🎯"
          background="radial-gradient(circle at 50% -10%, #8c2230 0%, #4a121c 45%, #1c0a0e 100%)"
          steps={STEPS}
          roomId={roomId}
          qr1={qr1}
          qr2={qr2}
          joined1={room?.player1Joined ?? false}
          joined2={room?.player2Joined ?? false}
          onStart={start}
          onExit={() => router.push("/games")}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[999] flex flex-col bg-[#0d0f16] text-white">
      <div className="flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button
          onClick={() => setPhase("lobby")}
          aria-label="Salir"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 active:scale-95"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-4 rounded-2xl bg-white/10 px-4 py-1.5">
          {([1, 2] as const).map((slot) => (
            <div key={slot} className="flex items-center gap-1.5" style={{ opacity: turn === slot ? 1 : 0.4 }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: players[slot].color }} />
              <span className="text-[11px] font-bold text-white/70">{players[slot].name}</span>
              <span className="font-heading text-xl font-black leading-none">{totals[slot]}</span>
            </div>
          ))}
        </div>

        <span className="w-10 text-right text-[11px] font-bold text-white/50">
          {"•".repeat(Math.max(DARTS_EACH - thrown[turn], 0))}
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
              <Dart color={players[d.slot].color} />
            </g>
          ))}

          <g ref={dart1Ref} display="none">
            <Dart color={players[1].color} />
          </g>
          <g ref={dart2Ref} display="none">
            <Dart color={players[2].color} />
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
        <span style={{ color: players[turn].color }}>Tira {players[turn].name}</span>
        <span className="text-white/40"> · apunta con el móvil y lánzalo</span>
      </p>

      {phase === "over" && (
        <MatchOver
          game="darts"
          winner={winner}
          scores={{ 1: totals[1], 2: totals[2] }}
          unit="puntos"
          onPlayAgain={playAgain}
          onExit={() => router.push("/games")}
        />
      )}
    </div>
  );
}

/** Whatever each phone had already sent when the match started, so a throw
    made while the lobby was still up doesn't fire off the first dart. */
function roomFor(room: DartsRoom | null) {
  return { p1: room?.player1Throw?.at ?? 0, p2: room?.player2Throw?.at ?? 0 };
}
