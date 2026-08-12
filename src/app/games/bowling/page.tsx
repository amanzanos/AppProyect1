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
import { setTurn, type PlayerSlot, type Seat } from "@/lib/data/gameRoom";
import {
  BOWLING_COLLECTION,
  createBowlingRoom,
  randomRoomCode,
  useBowlingRoom,
} from "@/lib/data/bowlingGame";

const SETTLE_MS = 1700;
const MAX_ROLL_S = 7;
const STEP_S = 1 / 240;

type Phase = "lobby" | "playing" | "over";


const STEPS = [
  { icon: "📱", text: "Todos escanean el mismo QR — hasta 8 jugadores" },
  { icon: "🎳", text: "Inclina el móvil para apuntar y lánzalo hacia delante" },
  { icon: "🏆", text: "Cinco rondas cada uno, por turnos — plenos y semiplenos puntúan" },
];

/** The next bowler round the alley who hasn't finished their frames. */
function nextBowler(slots: PlayerSlot[], current: PlayerSlot, rolls: Record<PlayerSlot, number[]>) {
  const from = Math.max(slots.indexOf(current), 0);
  for (let i = 1; i <= slots.length; i++) {
    const slot = slots[(from + i) % slots.length];
    if (!gameOver(rolls[slot] ?? [])) return slot;
  }
  return null;
}

/** A player's line on the scoresheet. */
function ScoreRow({ who, rolls, active }: { who: Seat; rolls: number[]; active: boolean }) {
  const { frames, total } = scoreGame(rolls);

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
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("lobby");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 1280, h: 720 });

  const [playing, setPlaying] = useState<Record<PlayerSlot, Seat>>({});
  const [turn, setTurnState] = useState<PlayerSlot>(1);
  const [rolls, setRolls] = useState<Record<PlayerSlot, number[]>>({});
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
  const consumed = useRef<Record<PlayerSlot, number>>({});
  const slotsRef = useRef<PlayerSlot[]>([]);
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
    createBowlingRoom(id);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const origin = window.location.origin;
    QRCode.toDataURL(`${origin}/games/bowling/play?room=${roomId}`, {
      margin: 1,
      width: 320,
      color: { dark: "#22364f", light: "#ffffff" },
    }).then(setQr);
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
      const next = [...(rollsRef.current[slot] ?? []), down];
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

        if (frameDone) {
          // Round-robin: a finished frame hands the lane to the next bowler
          // who still has frames left. When nobody has, the game is done.
          const to = nextBowler(slotsRef.current, slot, rollsRef.current);
          if (to === null) {
            setPhase("over");
            return;
          }
          standing.current = PIN_SPOTS.map(() => true);
          turnRef.current = to;
          setTurnState(to);
          if (roomId) setTurn(BOWLING_COLLECTION, roomId, to);
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
      const sent = roomRef.current?.controls[who];
      if (!sent || sent.at <= (consumed.current[who] ?? 0)) return;
      // Anything the other phones fired off out of turn is written off here, so
      // it can't go off the moment their turn comes round.
      const marked: Record<PlayerSlot, number> = { ...consumed.current, [who]: sent.at };
      for (const other of slotsRef.current) {
        if (other === who) continue;
        marked[other] = roomRef.current?.controls[other]?.at ?? marked[other] ?? 0;
      }
      consumed.current = marked;
      if (gameOver(rollsRef.current[who] ?? [])) return;
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
    const seats = room?.seats ?? {};
    const order = Object.keys(seats).map(Number).sort((a, b) => a - b);
    consumed.current = Object.fromEntries(order.map((s) => [s, room?.controls[s]?.at ?? 0]));
    slotsRef.current = order;
    setPlaying(seats);
    rollsRef.current = Object.fromEntries(order.map((s) => [s, [] as number[]]));
    setRolls(rollsRef.current);
    setBanner(null);
    standing.current = PIN_SPOTS.map(() => true);
    setPhase("playing");
    const first = order[0] ?? 1;
    turnRef.current = first;
    setTurnState(first);
    if (roomId) setTurn(BOWLING_COLLECTION, roomId, first);
  }, [room, roomId]);

  const slots = Object.keys(playing).map(Number);
  const totals: Record<PlayerSlot, number> = Object.fromEntries(
    slots.map((s) => [s, scoreGame(rolls[s] ?? []).total])
  );
  const at = nextBall(rolls[turn] ?? []);

  if (phase === "lobby") {
    return (
      <div className="fixed inset-0 z-[999]">
        <GameLobby
          title="BOLOS"
          emoji="🎳"
          background="radial-gradient(circle at 50% -10%, #ef7f74 0%, #a63f4e 45%, #22364f 100%)"
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

        {/* One line per bowler. Eight of them still clears the pins on a TV. */}
        <div className="flex max-h-[52vh] flex-col gap-1.5 overflow-y-auto rounded-2xl bg-[#22364f]/85 px-4 py-2">
          {slots.map((slot) => (
            <ScoreRow key={slot} who={playing[slot]} rolls={rolls[slot] ?? []} active={turn === slot} />
          ))}
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
        <span style={{ color: playing[turn]?.color }}>Tira {playing[turn]?.name}</span>
        <span className="text-white/45">
          {" "}
          · ronda {Math.min(at.frame + 1, FRAMES)} de {FRAMES}
        </span>
      </p>

      {phase === "over" && (
        <MatchOver
          game="bowling"
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
