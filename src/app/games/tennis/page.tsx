"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import confetti from "canvas-confetti";
import { RectangleHorizontal, RectangleVertical, X } from "lucide-react";
import MatchOver from "@/components/games/MatchOver";
import TennisCourt from "@/components/tennis/TennisCourt";
import TennisLoading from "@/components/tennis/TennisLoading";
import TennisLobby from "@/components/tennis/TennisLobby";
import { buildScene, project, type SceneSpec } from "@/lib/tennisScene";
import type { Orientation, PlayerSlot } from "@/lib/tennisTypes";


import {
  createTennisRoom,
  randomRoomCode,
  useTennisRoom,
  type TennisControl,
} from "@/lib/data/tennisGame";
import { seatLook } from "@/lib/players";
import type { RoomState } from "@/lib/data/gameRoom";

// Court coordinates are camera-independent: `across` runs sideways (0-100),
// `along` runs down the court with 100 at the near baseline the camera sits
// behind. Only the projection turns them into pixels, so changing the
// orientation never touches the simulation.
const SIDE_MARGIN = 4;
/** How far before a baseline a swing starts connecting. */
const HIT_ZONE = 15;
/** How far past a baseline the ball runs before the point is finally lost. */
const RUN_OFF = 24;
/** A swing this long before the ball reaches the hit zone still counts. It's
    deliberately generous: the swing travels phone → Firestore → projector, so
    by the time the host sees it it's already a few hundred ms old, and a
    tight window turned every rally into an instant point. A swing from the
    previous leg still never counts — those are cut off at `legStart`. */
const PRE_SWING_MS = 1200;
const SERVE_PAUSE_MS = 1000;
const WIN_SCORE = 5;
const BASE_SPEED = 0.42;
const MAX_SPEED = 0.86;
/** Everything the ball is drawn with is measured in feet of court and sized
    through `spec.unit`, so it looks right under either camera — the head-on
    one is zoomed right in, the side-on one takes in the whole 78ft length. */
const HOP_FT = 4;
const BALL_FT = 0.5;
const BURST_FT = 0.8;
const REACTION_MS = 1300; // how long the cheer/sulk plays after a point

type Phase = "lobby" | "loading" | "playing" | "over";

/** The court's slots are the app's two people. */

export default function TennisPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("lobby");
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [score, setScore] = useState({ p1: 0, p2: 0 });
  const [winner, setWinner] = useState<PlayerSlot | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [rallyTick, setRallyTick] = useState(0);
  const [view, setView] = useState({ w: 1280, h: 720 });

  const room = useTennisRoom(roomId);
  // Tennis is the one duel: seats 1 and 2, one each side of the net. Falling
  // back to the generic look keeps the court drawable before anyone has joined.
  const players = {
    1: room?.seats[1] ?? seatLook(1),
    2: room?.seats[2] ?? seatLook(2),
  };
  const roomRef = useRef<RoomState<TennisControl> | null>(null);
  const specRef = useRef<SceneSpec | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<SVGCircleElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);
  const impactRef = useRef<SVGCircleElement>(null);
  const p1Ref = useRef<SVGGElement>(null);
  const p2Ref = useRef<SVGGElement>(null);

  // A horizontal court on an upright screen would be a postage stamp, so the
  // whole game is turned a quarter turn instead and the player turns the phone
  // — the court then runs along the screen's long edge either way.
  const quarterTurn = orientation === "landscape" && view.h > view.w;
  const stage = quarterTurn ? { w: view.h, h: view.w } : view;

  const spec = useMemo(() => buildScene(stage.w, stage.h, orientation), [stage.w, stage.h, orientation]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  useEffect(() => {
    specRef.current = spec;
  }, [spec]);

  // Measured off the outer, unturned element, so the turn never feeds back
  // into the size it was derived from.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setView({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]);

  useEffect(() => {
    const id = randomRoomCode();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot random room code minted on mount; Math.random() can't run during render
    setRoomId(id);
    createTennisRoom(id);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const origin = window.location.origin;
    QRCode.toDataURL(`${origin}/games/tennis/play?room=${roomId}`, {
      margin: 1,
      width: 320,
      color: { dark: "#0d3b52", light: "#ffffff" },
    }).then(setQr);
  }, [roomId]);

  /** Re-triggers a CSS animation that may already be running. */
  const restartClass = useCallback((el: Element | null, cls: string, ms?: number) => {
    if (!el) return;
    el.classList.remove(cls);
    void el.getBoundingClientRect();
    el.classList.add(cls);
    if (ms) setTimeout(() => el.classList.remove(cls), ms);
  }, []);

  // The rally runs on refs + rAF: putting the ball's position in state would
  // re-render the whole scene 60x a second. Only the score and banners, which
  // change a handful of times per match, go through React.
  useEffect(() => {
    if (phase !== "playing") return;

    let raf = 0;
    let cancelled = false;
    let last = performance.now();
    const consumed = { 1: 0, 2: 0 };
    const tally = { 1: 0, 2: 0 };
    const ball = { across: 50, along: 50, vAcross: 0.15, vAlong: BASE_SPEED, frozen: true };
    const chase = { p1: 50, p2: 50 };
    const running = { p1: false, p2: false };

    // Whose turn it is to return, when the ball started travelling towards
    // them, and when it entered their hit zone.
    let target: PlayerSlot = 1;
    let inZone = false;
    let zoneAt = 0;
    let legStart = 0;
    // setPhase() only unmounts the loop on the next render, so without this
    // the ball carries on past the baseline and the winning point lands twice.
    let finished = false;

    const spriteOf = (p: PlayerSlot) => (p === 1 ? p1Ref.current : p2Ref.current);

    function serve(towards: PlayerSlot) {
      ball.across = 50;
      ball.along = 50;
      ball.vAcross = (Math.random() - 0.5) * 0.3;
      ball.vAlong = towards === 1 ? BASE_SPEED : -BASE_SPEED;
      ball.frozen = true;
      target = towards;
      inZone = false;
      legStart = Date.now();
      setTimeout(() => {
        if (!cancelled) ball.frozen = false;
      }, SERVE_PAUSE_MS);
    }
    serve(Math.random() > 0.5 ? 1 : 2);

    /**
     * A swing only counts once, and only if it landed while the ball was on
     * its way in — not one left over from earlier in the rally. Crucially
     * this is polled the whole time the ball is in the hit zone and running
     * off behind the baseline, so a swing that arrives a few hundred
     * milliseconds late (Firestore round-trip) still connects instead of
     * instantly conceding the point, which is what made every rally end on
     * the first shot before.
     */
    function tryReturn(player: PlayerSlot): number | null {
      const hit = roomRef.current?.controls[player];
      if (!hit || hit.at <= consumed[player]) return null;
      consumed[player] = hit.at;
      if (hit.at < Math.max(zoneAt - PRE_SWING_MS, legStart)) return null; // swung far too early
      return Math.min(Math.max(hit.power, 1), 3);
    }

    // Score lives in this closure rather than in state so the loop never has
    // to list it as a dependency (which would restart the rally on every
    // point); state is just the render mirror of it.
    function point(to: PlayerSlot) {
      if (finished) return;
      tally[to] += 1;
      const loser: PlayerSlot = to === 1 ? 2 : 1;
      // The run cycle and the reaction both animate .tennis-figure, so the
      // chase animation has to come off before either can play.
      running.p1 = false;
      running.p2 = false;
      p1Ref.current?.classList.remove("is-running");
      p2Ref.current?.classList.remove("is-running");
      setScore({ p1: tally[1], p2: tally[2] });
      setBanner("¡PUNTO!");
      setTimeout(() => {
        if (!cancelled) setBanner(null);
      }, 950);

      if (tally[to] >= WIN_SCORE) {
        finished = true;
        ball.frozen = true;
        setWinner(to);
        setPhase("over");
        confetti({ particleCount: 180, spread: 100, origin: { y: 0.5 }, colors: ["#bef264", "#34d399", "#fde047"] });
        spriteOf(to)?.classList.add("is-celebrating");
        return;
      }

      // Winner cheers, loser sulks — then both settle back to idle.
      restartClass(spriteOf(to), "is-celebrating", REACTION_MS);
      restartClass(spriteOf(loser), "is-angry", REACTION_MS);
      serve(loser);
    }

    function loop(now: number) {
      if (cancelled) return;
      const dt = Math.min(now - last, 48) / 16;
      last = now;

      if (!ball.frozen) {
        ball.across += ball.vAcross * dt;
        ball.along += ball.vAlong * dt;

        if (ball.across <= SIDE_MARGIN) {
          ball.across = SIDE_MARGIN;
          ball.vAcross = Math.abs(ball.vAcross);
        } else if (ball.across >= 100 - SIDE_MARGIN) {
          ball.across = 100 - SIDE_MARGIN;
          ball.vAcross = -Math.abs(ball.vAcross);
        }

        const reached = target === 1 ? ball.along >= 100 - HIT_ZONE : ball.along <= HIT_ZONE;
        if (reached && !inZone) {
          inZone = true;
          zoneAt = Date.now();
        }

        if (inZone) {
          const power = tryReturn(target);
          if (power) {
            const dir = target === 1 ? -1 : 1;
            ball.vAlong = dir * Math.min(Math.abs(ball.vAlong) * (1 + power * 0.05), MAX_SPEED);
            ball.vAcross += (Math.random() - 0.5) * 0.22;
            restartClass(spriteOf(target), "is-swinging", 380);

            // burst at the point of contact
            const s0 = specRef.current;
            if (s0 && impactRef.current) {
              const c = project(s0, ball.across, ball.along);
              impactRef.current.setAttribute("cx", `${c.x}`);
              impactRef.current.setAttribute("cy", `${c.y - s0.unit * 1.2 * c.scale}`);
              impactRef.current.setAttribute("r", `${s0.unit * BURST_FT * c.scale}`);
              restartClass(impactRef.current, "is-hit", 360);
            }

            target = target === 1 ? 2 : 1;
            inZone = false;
            legStart = Date.now();
          } else if (target === 1 ? ball.along > 100 + RUN_OFF : ball.along < -RUN_OFF) {
            point(target === 1 ? 2 : 1);
          }
        }
      }

      // Players slide sideways to track the ball; enough movement flips them
      // into the running animation.
      for (const key of ["p1", "p2"] as const) {
        const before = chase[key];
        chase[key] += (ball.across - chase[key]) * Math.min(0.075 * dt, 1);
        const moving = Math.abs(chase[key] - before) > 0.12 * dt;
        if (moving === running[key]) continue;
        const el = spriteOf(key === "p1" ? 1 : 2);
        // While a reaction is playing it owns the sprite's animation, so leave
        // the flag alone and pick the run cycle back up once it finishes.
        if (!el || el.classList.contains("is-celebrating") || el.classList.contains("is-angry")) continue;
        running[key] = moving;
        el.classList.toggle("is-running", moving);
      }

      const s = specRef.current;
      if (!s) {
        raf = requestAnimationFrame(loop);
        return;
      }
      const span = 100 - 2 * HIT_ZONE;
      const t = Math.min(Math.max((ball.along - HIT_ZONE) / span, 0), 1);
      const maxHop = s.unit * HOP_FT;
      const hop = Math.sin(t * Math.PI) * maxHop;
      // Small enough to look right on the side-on camera, never so small it
      // disappears on a projector.
      const radius = Math.max(s.unit * BALL_FT, 11);

      const b = project(s, ball.across, ball.along);
      if (ballRef.current) {
        ballRef.current.setAttribute("cx", `${b.x}`);
        ballRef.current.setAttribute("cy", `${b.y - hop * b.scale}`);
        ballRef.current.setAttribute("r", `${radius * b.scale}`);
      }
      if (shadowRef.current) {
        const shrink = 1 - (hop / maxHop) * 0.4;
        shadowRef.current.setAttribute("cx", `${b.x}`);
        shadowRef.current.setAttribute("cy", `${b.y}`);
        shadowRef.current.setAttribute("rx", `${radius * 0.95 * b.scale * shrink}`);
        shadowRef.current.setAttribute("ry", `${radius * 0.48 * b.scale * shrink}`);
        shadowRef.current.setAttribute("opacity", `${0.34 - (hop / maxHop) * 0.18}`);
      }
      for (const [ref, acrossPos, alongPos] of [
        [p1Ref, chase.p1, 97],
        [p2Ref, chase.p2, 3],
      ] as const) {
        if (!ref.current) continue;
        const p = project(s, acrossPos, alongPos);
        ref.current.setAttribute("transform", `translate(${p.x} ${p.y}) scale(${p.scale})`);
      }

      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [phase, rallyTick, restartClass]);

  function startMatch() {
    setScore({ p1: 0, p2: 0 });
    setWinner(null);
    setBanner(null);
    setRallyTick((t) => t + 1);
    setPhase("loading");
  }

  function playAgain() {
    for (const el of [p1Ref.current, p2Ref.current]) {
      el?.classList.remove("is-celebrating", "is-angry", "is-running");
    }
    startMatch();
  }

  const horizontal = orientation === "landscape";

  if (phase === "lobby") {
    return (
      <div className="fixed inset-0 z-[999]">
        <TennisLobby
          roomId={roomId}
          qr={qr}
          seats={room?.seats ?? {}}
          orientation={orientation}
          onToggleOrientation={() => setOrientation((o) => (o === "landscape" ? "portrait" : "landscape"))}
          onStart={startMatch}
          onExit={() => router.push("/games")}
        />
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="fixed inset-0 z-[999]">
        <TennisLoading onDone={() => setPhase("playing")} />
      </div>
    );
  }

  return (
    <div ref={rootRef} className="fixed inset-0 z-[999] overflow-hidden bg-[#0b1a24]">
      {/* Court and HUD turn together, so everything stays the right way up once
          the phone is turned with it. */}
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: stage.w,
          height: stage.h,
          transform: quarterTurn ? `translateX(${view.w}px) rotate(90deg)` : undefined,
        }}
      >
        {/* The scene fills the whole screen; the HUD floats over it. One court,
            two cameras: side-on lays it left↔right, head-on runs it away up the
            screen. The projection handles both. */}
        <div className="absolute inset-0">
          <TennisCourt
            spec={spec}
            players={players}
            p1Ref={p1Ref}
            p2Ref={p2Ref}
            ballRef={ballRef}
            shadowRef={shadowRef}
            impactRef={impactRef}
          />
        </div>

      <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button
          onClick={() => setPhase("lobby")}
          aria-label="Volver al inicio del juego"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white active:scale-95"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-4 rounded-2xl bg-black/45 px-5 py-1.5 backdrop-blur-sm">
          {([1, 2] as const).map((slot) => (
            <div key={slot} className="flex items-center gap-1.5">
              <span className="h-3 w-3" style={{ background: players[slot].color }} />
              <span className="text-[11px] font-bold text-white/75">{players[slot].name}</span>
              <span className="font-heading text-2xl font-black leading-none text-white">
                {slot === 1 ? score.p1 : score.p2}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={() => setOrientation((o) => (o === "landscape" ? "portrait" : "landscape"))}
          aria-label="Cambiar orientación"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white active:scale-95"
        >
          {horizontal ? <RectangleHorizontal size={17} /> : <RectangleVertical size={17} />}
        </button>
      </div>

      {/* The banner sits high, over the empty band above the net: down at the
          near baseline it covered the player doing the celebrating. It stops
          at the final point — the winning ¡PUNTO! was landing on top of the
          end-of-match screen and the prize wheel. */}
      {banner && phase === "playing" && (
        <div className="pointer-events-none absolute inset-x-0 top-[19%] z-30 flex justify-center">
          <span className="animate-pop-in border-4 border-neutral-800 bg-white px-6 py-1.5 font-heading text-2xl font-black tracking-widest text-red-600 shadow-lg">
            {banner}
          </span>
        </div>
      )}

      {roomId && (
        <p className="absolute inset-x-0 bottom-0 z-20 pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-center text-[10px] font-black tracking-[0.3em] text-white/40">
          SALA {roomId}
        </p>
      )}

      {phase === "over" && winner && (
        <MatchOver
          game="tennis"
          seats={players}
          scores={{ 1: score.p1, 2: score.p2 }}
          unit="puntos"
          onPlayAgain={playAgain}
          onExit={() => router.push("/games")}
        />
      )}
      </div>
    </div>
  );
}
