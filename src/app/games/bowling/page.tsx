"use client";

import { createRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { X } from "lucide-react";
import BowlingAlley from "@/components/games/BowlingAlley";
import GameLobby from "@/components/games/GameLobby";
import MatchOver from "@/components/games/MatchOver";
import { PIN_SPOTS, bowl, countDown, rack, settled, standingAfter, step, type Lane } from "@/lib/bowling";
import { FRAMES, PINS, gameOver, nextBall, scoreGame } from "@/lib/bowlingScore";
import { buildAlley, projectLane } from "@/lib/bowlingScene";
import { loadPlayers, usePlayers } from "@/lib/players";
import { setTurn } from "@/lib/data/gameRoom";
import {
  createBowlingRoom,
  randomRoomCode,
  useBowlingRoom,
  type PlayerSlot,
} from "@/lib/data/bowlingGame";

const SETTLE_MS = 1700;
const MAX_ROLL_S = 7;
const STEP_S = 1 / 240;

type Phase = "lobby" | "playing" | "over";


const STEPS = [
  { icon: "📱", text: "Cada uno escanea su QR con la cámara del móvil" },
  { icon: "🎳", text: "Inclina el móvil para apuntar y lánzalo hacia delante" },
  { icon: "🏆", text: "Cinco rondas cada uno — plenos y semiplenos puntúan" },
];

/** A player's line on the scoresheet. */
function ScoreRow({ slot, rolls, active }: { slot: PlayerSlot; rolls: number[]; active: boolean }) {
  const { players } = usePlayers();
  const { frames, total } = scoreGame(rolls);
  const who = players[slot];

  return (
    <div className="flex items-center gap-2" style={{ opacity: active ? 1 : 0.5 }}>
      <span className="w-[62px] shrink-0 truncate text-[11px] font-bold" style={{ color: who.color }}>
        {who.name}
      </span>
      <div className="flex gap-1">
        {frames.map((f, i) => (
          <div key={i} className="w-9 overflow-hidden rounded-md bg-white/15">
            <div className="flex h-4 items-center justify-end gap-[3px] px-1 text-[9px] font-black leading-none text-white">
              {f.strike && f.rolls.length === 1 ? (
                <span>X</span>
              ) : (
                f.rolls.map((r, n) => (
                  <span key={n}>{r === PINS ? "X" : f.spare && n === 1 ? "/" : r === 0 ? "-" : r}</span>
                ))
              )}
            </div>
            <div className="flex h-4 items-center justify-center text-[10px] font-black text-white/80">
              {f.total ?? ""}
            </div>
          </div>
        ))}
      </div>
      <span className="ml-1 font-heading text-lg font-black leading-none text-white">{total}</span>
    </div>
  );
}

export default function BowlingPage() {
  const { players } = usePlayers();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("lobby");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [qr1, setQr1] = useState<string | null>(null);
  const [qr2, setQr2] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 1280, h: 720 });

  const [turn, setTurnState] = useState<PlayerSlot>(1);
  const [rolls, setRolls] = useState<Record<PlayerSlot, number[]>>({ 1: [], 2: [] });
  const [banner, setBanner] = useState<string | null>(null);

  const room = useBowlingRoom(roomId);
  const roomRef = useRef(room);
  const turnRef = useRef<PlayerSlot>(1);
  const rollsRef = useRef(rolls);
  const stageRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<SVGGElement>(null);
  const aimRef = useRef<SVGLineElement>(null);
  const pinRefs = useMemo(() => PIN_SPOTS.map(() => createRef<SVGGElement>()), []);
  const rafRef = useRef(0);
  const consumed = useRef<Record<PlayerSlot, number>>({ 1: 0, 2: 0 });
  const busy = useRef(false);
  /** The rack as it stands mid-frame, so a second ball faces what's left. */
  const standing = useRef<boolean[]>(PIN_SPOTS.map(() => true));

  const spec = useMemo(() => buildAlley(size.w, size.h), [size]);
  const specRef = useRef(spec);
  useEffect(() => {
    specRef.current = spec;
  }, [spec]);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  useEffect(() => {
    turnRef.current = turn;
  }, [turn]);
  useEffect(() => {
    rollsRef.current = rolls;
  }, [rolls]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]);

  useEffect(() => {
    const id = randomRoomCode();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot random room code minted on mount; Math.random() can't run during render
    setRoomId(id);
    createBowlingRoom(id, loadPlayers());
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const origin = window.location.origin;
    const opts = { margin: 1, width: 260, color: { dark: "#22364f", light: "#ffffff" } };
    QRCode.toDataURL(`${origin}/games/bowling/play?room=${roomId}&player=1`, opts).then(setQr1);
    QRCode.toDataURL(`${origin}/games/bowling/play?room=${roomId}&player=2`, opts).then(setQr2);
  }, [roomId]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  /** Puts the whole rack and the ball back where the simulation says. */
  const paint = useCallback(
    (lane: Lane) => {
      const s = specRef.current;
      lane.pins.forEach((p, i) => {
        const el = pinRefs[i].current;
        if (!el) return;
        if (p.cleared) {
          el.setAttribute("display", "none");
          return;
        }
        el.removeAttribute("display");
        const at = projectLane(s, p.x, p.y);
        // A downed pin lies over and shrinks away as it slides into the pit.
        el.setAttribute(
          "transform",
          `translate(${at.x} ${at.y}) scale(${at.scale * 3.2}) rotate(${p.down ? 74 : 0})`
        );
        el.setAttribute("opacity", p.down ? "0.55" : "1");
      });

      const b = projectLane(s, lane.ball.x, lane.ball.y);
      ballRef.current?.setAttribute("transform", `translate(${b.x} ${b.y}) scale(${b.scale * 2.4})`);
    },
    [pinRefs]
  );

  /** Parks the ball at the foul line with the current rack showing. */
  const resetLane = useCallback(() => {
    const lane: Lane = { ball: bowl(0, 0, 0), pins: rack(standing.current) };
    lane.ball.vy = 0;
    paint(lane);
  }, [paint]);

  const finish = useCallback(
    (lane: Lane, slot: PlayerSlot) => {
      const down = countDown(lane);
      const before = standing.current.filter(Boolean).length;
      const next = [...rollsRef.current[slot], down];
      rollsRef.current = { ...rollsRef.current, [slot]: next };
      setRolls(rollsRef.current);

      const strike = before === PINS && down === PINS;
      const spare = before < PINS && down === before;
      setBanner(strike ? "¡PLENO!" : spare ? "¡SEMIPLENO!" : down === 0 ? "Canal…" : `${down} bolos`);

      setTimeout(() => {
        setBanner(null);
        busy.current = false;
        const at = nextBall(next);
        // The last frame keeps counting its balls rather than rolling over to
        // a sixth, so "the frame is over" has to take `done` into account too.
        const frameDone = at.ball === 0 || at.done;
        const fresh = frameDone || down === before;
        standing.current = fresh ? PIN_SPOTS.map(() => true) : standingAfter(lane);

        const other: PlayerSlot = slot === 1 ? 2 : 1;
        if (frameDone) {
          if (gameOver(next) && gameOver(rollsRef.current[other])) {
            setPhase("over");
            return;
          }
          // Hand over unless the other player has already finished.
          const to = gameOver(rollsRef.current[other]) ? slot : other;
          standing.current = PIN_SPOTS.map(() => true);
          turnRef.current = to;
          setTurnState(to);
          if (roomId) setTurn("bowlingGames", roomId, to);
        }
        resetLane();
      }, SETTLE_MS);
    },
    [roomId, resetLane]
  );

  const play = useCallback(
    (aim: number, power: number, spin: number, slot: PlayerSlot) => {
      const lane: Lane = { ball: bowl(aim, power, spin), pins: rack(standing.current) };
      let elapsed = 0;
      let last = performance.now();
      const loop = (now: number) => {
        const frame = Math.min((now - last) / 1000, 0.05);
        last = now;
        // Fixed sub-steps: collisions get unreliable if the step can stretch.
        for (let t = 0; t < frame; t += STEP_S) {
          step(lane, STEP_S);
          elapsed += STEP_S;
        }
        paint(lane);
        if (!settled(lane) && elapsed < MAX_ROLL_S) {
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
        finish(lane, slot);
      };
      rafRef.current = requestAnimationFrame(loop);
    },
    [paint, finish]
  );

  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      if (busy.current) return;
      const who = turnRef.current;
      const sent = who === 1 ? roomRef.current?.player1Ball : roomRef.current?.player2Ball;
      if (!sent || sent.at <= consumed.current[who]) return;
      // Anything the other phone fired off out of turn is dropped here, so it
      // can't go off the moment their turn comes round.
      const other: PlayerSlot = who === 1 ? 2 : 1;
      const stale = other === 1 ? roomRef.current?.player1Ball : roomRef.current?.player2Ball;
      consumed.current = { ...consumed.current, [who]: sent.at, [other]: stale?.at ?? consumed.current[other] };
      if (gameOver(rollsRef.current[who])) return;
      busy.current = true;
      aimRef.current?.setAttribute("display", "none");
      play(sent.aim, sent.power, sent.spin, who);
    }, 120);
    return () => clearInterval(id);
  }, [phase, play]);

  // Between balls the aiming line shows where the bowler is pointing.
  useEffect(() => {
    if (phase !== "playing" || busy.current) return;
    resetLane();
    aimRef.current?.removeAttribute("display");
  }, [phase, turn, rolls, spec, resetLane]);

  const start = useCallback(() => {
    consumed.current = { 1: room?.player1Ball?.at ?? 0, 2: room?.player2Ball?.at ?? 0 };
    standing.current = PIN_SPOTS.map(() => true);
    setPhase("playing");
    setTurnState(1);
    if (roomId) setTurn("bowlingGames", roomId, 1);
  }, [room, roomId]);

  function playAgain() {
    setRolls({ 1: [], 2: [] });
    setBanner(null);
    start();
  }

  const totals = {
    1: scoreGame(rolls[1]).total,
    2: scoreGame(rolls[2]).total,
  };
  const winner: PlayerSlot | null = totals[1] === totals[2] ? null : totals[1] > totals[2] ? 1 : 2;
  const at = nextBall(rolls[turn]);

  if (phase === "lobby") {
    return (
      <div className="fixed inset-0 z-[999]">
        <GameLobby
          title="BOLOS"
          emoji="🎳"
          background="radial-gradient(circle at 50% -10%, #ef7f74 0%, #a63f4e 45%, #22364f 100%)"
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
    <div className="fixed inset-0 z-[999] overflow-hidden bg-[#22364f]">
      <div ref={stageRef} className="absolute inset-0">
        <BowlingAlley spec={spec} ballRef={ballRef} pinRefs={pinRefs} aimRef={aimRef} />
      </div>

      <div className="absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button
          onClick={() => setPhase("lobby")}
          aria-label="Salir"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/35 text-white active:scale-95"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col gap-1.5 rounded-2xl bg-[#22364f]/85 px-4 py-2">
          <ScoreRow slot={1} rolls={rolls[1]} active={turn === 1} />
          <ScoreRow slot={2} rolls={rolls[2]} active={turn === 2} />
        </div>

        <span className="w-10 shrink-0" />
      </div>

      {banner && (
        <div className="pointer-events-none absolute inset-x-0 top-[26%] z-30 flex justify-center">
          <span className="animate-pop-in rounded-2xl bg-white px-7 py-2 font-heading text-2xl font-black tracking-wide text-[#c0335f] shadow-xl">
            {banner}
          </span>
        </div>
      )}

      <p className="absolute inset-x-0 bottom-0 z-20 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-center text-xs font-bold">
        <span style={{ color: players[turn].color }}>
          Tira {players[turn].name}
        </span>
        <span className="text-white/45">
          {" "}
          · ronda {Math.min(at.frame + 1, FRAMES)} de {FRAMES}
        </span>
      </p>

      {phase === "over" && (
        <MatchOver
          game="bowling"
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
