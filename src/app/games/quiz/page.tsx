"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Check, X } from "lucide-react";
import AnswerShape from "@/components/games/AnswerShape";
import GameLobby from "@/components/games/GameLobby";
import MatchOver from "@/components/games/MatchOver";
import { ANSWER_MS, CATEGORIES, SHAPES, drawRound, scoreAnswer, type Question } from "@/lib/quiz";
import { setRound, type PlayerSlot, type Seat } from "@/lib/data/gameRoom";
import { QUIZ_COLLECTION, createQuizRoom, randomRoomCode, useQuizRoom } from "@/lib/data/quizGame";

const QUESTIONS = 8;
const REVEAL_MS = 3800;

type Phase = "lobby" | "picking" | "asking" | "revealing" | "over";

const STEPS = [
  { icon: "📱", text: "Todos escanean el mismo QR — hasta 8 jugadores" },
  { icon: "🎨", text: "La pregunta sale aquí y respondéis con la forma en el móvil" },
  { icon: "⚡", text: "Cuanto antes aciertes, más puntos — ocho preguntas" },
];

/** What a player did with the question that just closed. */
interface Landed {
  choice: number;
  points: number;
}

export default function QuizPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("lobby");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  const [deck, setDeck] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState<Record<PlayerSlot, number>>({});
  const [landed, setLanded] = useState<Record<PlayerSlot, Landed | null>>({});
  const [left, setLeft] = useState(ANSWER_MS);
  /** Frozen at kick-off: latecomers join the next match, not this question. */
  const [playing, setPlaying] = useState<Record<PlayerSlot, Seat>>({});

  const room = useQuizRoom(roomId);
  const roomRef = useRef(room);
  const askedAt = useRef(0);
  const landedRef = useRef(landed);
  const playingRef = useRef(playing);
  const closing = useRef(false);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  useEffect(() => {
    landedRef.current = landed;
  }, [landed]);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    const id = randomRoomCode();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot random room code minted on mount; Math.random() can't run during render
    setRoomId(id);
    createQuizRoom(id);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const origin = window.location.origin;
    QRCode.toDataURL(`${origin}/games/quiz/play?room=${roomId}`, {
      margin: 1,
      width: 320,
      color: { dark: "#2b1a5e", light: "#ffffff" },
    }).then(setQr);
  }, [roomId]);

  const question = deck[index];

  /** Closes the question: score whatever came in, then show the answer. */
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setPhase("revealing");
    if (roomId) setRound(QUIZ_COLLECTION, roomId, -1);

    setTimeout(() => {
      landedRef.current = {};
      setLanded(landedRef.current);
      closing.current = false;
      setIndex((i) => {
        const next = i + 1;
        if (next >= QUESTIONS) {
          setPhase("over");
          return i;
        }
        setPhase("asking");
        return next;
      });
    }, REVEAL_MS);
  }, [roomId]);

  // The live question: count down, take answers, close when everyone is in.
  useEffect(() => {
    if (phase !== "asking" || !question) return;
    askedAt.current = Date.now();
    if (roomId) setRound(QUIZ_COLLECTION, roomId, index);

    // Everything that changes state runs on the tick rather than in the effect
    // body, so asking a question never cascades a render into another.
    const id = setInterval(() => {
      const elapsed = Date.now() - askedAt.current;
      setLeft(Math.max(ANSWER_MS - elapsed, 0));

      const slots = Object.keys(playingRef.current).map(Number);
      for (const slot of slots) {
        if (landedRef.current[slot]) continue;
        const sent = roomRef.current?.controls[slot];
        if (!sent || sent.round !== index) continue;
        const points = scoreAnswer(sent.choice === question.answer, sent.at - askedAt.current);
        landedRef.current = { ...landedRef.current, [slot]: { choice: sent.choice, points } };
        setLanded(landedRef.current);
        setScores((s) => ({ ...s, [slot]: (s[slot] ?? 0) + points }));
      }

      const everyone = slots.length > 0 && slots.every((s) => landedRef.current[s]);
      if (everyone || elapsed >= ANSWER_MS) close();
    }, 120);

    return () => clearInterval(id);
  }, [phase, question, index, roomId, close]);

  const start = useCallback(
    (categoryId: string | null) => {
      const seats = roomRef.current?.seats ?? {};
      setPlaying(seats);
      playingRef.current = seats;
      setDeck(drawRound(categoryId, QUESTIONS));
      setIndex(0);
      setScores(Object.fromEntries(Object.keys(seats).map((s) => [Number(s), 0])));
      landedRef.current = {};
      setLanded(landedRef.current);
      setLeft(ANSWER_MS);
      closing.current = false;
      setPhase("asking");
    },
    []
  );

  const slots = Object.keys(playing).map(Number);

  if (phase === "lobby") {
    return (
      <div className="fixed inset-0 z-[999]">
        <GameLobby
          title="QUIZ"
          emoji="🧠"
          background="radial-gradient(circle at 50% -10%, #7c4dea 0%, #3b1f86 45%, #1b1040 100%)"
          steps={STEPS}
          roomId={roomId}
          qr={qr}
          seats={room?.seats ?? {}}
          minPlayers={1}
          onStart={() => setPhase("picking")}
          onExit={() => router.push("/games")}
        />
      </div>
    );
  }

  if (phase === "picking") {
    return (
      <div className="fixed inset-0 z-[999] overflow-y-auto bg-[radial-gradient(circle_at_50%_-10%,#7c4dea_0%,#3b1f86_45%,#1b1040_100%)] px-5 py-8 text-white">
        <h1 className="text-center font-heading text-2xl font-black">Elegid tema</h1>
        <p className="mt-1 text-center text-xs text-white/60">Ocho preguntas para todos</p>
        <div className="mx-auto mt-5 grid max-w-lg grid-cols-2 gap-3">
          <button
            onClick={() => start(null)}
            className="col-span-2 rounded-3xl bg-white p-4 text-left active:scale-95"
          >
            <p className="font-heading text-lg font-black text-[#2b1a5e]">🎲 Mezcla</p>
            <p className="text-xs text-neutral-400">De todo un poco</p>
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => start(c.id)}
              className="rounded-3xl p-4 text-left text-white active:scale-95"
              style={{ background: c.color }}
            >
              <p className="font-heading text-base font-black">
                {c.emoji} {c.name}
              </p>
              <p className="text-[11px] text-white/70">{c.questions.length} preguntas</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "over" || !question) {
    return (
      <div className="fixed inset-0 z-[999] bg-[#1b1040]">
        <MatchOver
          game="quiz"
          seats={playing}
          scores={scores}
          unit="puntos"
          onPlayAgain={() => setPhase("picking")}
          onExit={() => router.push("/games")}
        />
      </div>
    );
  }

  const revealing = phase === "revealing";

  return (
    <div className="fixed inset-0 z-[999] flex flex-col bg-[radial-gradient(circle_at_50%_-10%,#7c4dea_0%,#3b1f86_45%,#1b1040_100%)] text-white">
      <div className="flex items-center justify-between gap-3 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button
          onClick={() => setPhase("lobby")}
          aria-label="Salir"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 active:scale-95"
        >
          <X size={20} />
        </button>

        {/* Wraps rather than scrolls: on a television nobody can swipe it. */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl bg-black/30 px-3 py-1.5">
          {slots.map((slot) => (
            <div key={slot} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: playing[slot].color }} />
              <span className="text-[11px] font-bold text-white/70">{playing[slot].name}</span>
              <span className="tnum font-heading text-lg font-black leading-none">{scores[slot] ?? 0}</span>
            </div>
          ))}
        </div>

        <span className="w-10 shrink-0 text-right font-heading text-sm font-black text-white/60">
          {index + 1}/{QUESTIONS}
        </span>
      </div>

      {/* time left */}
      <div className="mx-4 mt-3 h-2 overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-gradient-to-r from-lime-300 to-amber-400 transition-[width] duration-100"
          style={{ width: `${(left / ANSWER_MS) * 100}%` }}
        />
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-4">
        <p className="max-w-3xl text-center font-heading text-[clamp(1.5rem,4.5vw,2.75rem)] font-black leading-tight">
          {question.q}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {question.options.map((opt, i) => {
          const right = i === question.answer;
          return (
            <div
              key={opt}
              className="flex items-center gap-3 rounded-2xl px-4 py-4 transition-opacity"
              style={{
                background: SHAPES[i].color,
                // On the reveal everything but the right answer steps back.
                opacity: revealing && !right ? 0.28 : 1,
              }}
            >
              <span className="shrink-0 text-white">
                <AnswerShape index={i} size={26} />
              </span>
              <span className="min-w-0 flex-1 font-heading text-base font-black leading-tight text-white sm:text-lg">
                {opt}
              </span>
              {revealing && right && <Check size={26} strokeWidth={4} className="shrink-0 text-white" />}
              {/* Who picked what, once the question has closed. */}
              <span className="flex shrink-0 flex-wrap justify-end gap-1">
                {slots
                  .filter((slot) => revealing && landed[slot]?.choice === i)
                  .map((slot) => (
                    <span
                      key={slot}
                      className="h-3.5 w-3.5 rounded-full border-2 border-white"
                      style={{ background: playing[slot].color }}
                    />
                  ))}
              </span>
            </div>
          );
        })}
      </div>

      {/* who has answered, while the question is live */}
      {!revealing && (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(5.5rem+env(safe-area-inset-top))] flex flex-wrap justify-center gap-1.5 px-4">
          {slots.map((slot) =>
            landed[slot] ? (
              <span
                key={slot}
                className="animate-pop-in rounded-full px-3 py-1 text-[11px] font-black text-white"
                style={{ background: playing[slot].color }}
              >
                {playing[slot].name} ✓
              </span>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
