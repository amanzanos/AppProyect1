"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import AnswerShape from "@/components/games/AnswerShape";
import ControllerShell from "@/components/games/ControllerShell";
import { SHAPES } from "@/lib/quiz";
import { QUIZ_COLLECTION, sendAnswer, useQuizRoom } from "@/lib/data/quizGame";
import { vibrateSuccess } from "@/lib/haptics";
import type { PlayerSlot } from "@/lib/data/gameRoom";

/**
 * The phone never sees the question — it's on the big screen. All it offers is
 * the four marks, so answering means looking up and then down at a shape.
 */
function QuizPad({ room, slot }: { room: string; slot: PlayerSlot }) {
  // Held against the round it was for, so a new question clears it without an
  // effect having to reach in and reset anything.
  const [tapped, setTapped] = useState<{ round: number; choice: number } | null>(null);
  const state = useQuizRoom(room);
  const round = state?.round ?? -1;
  const live = round >= 0;

  // What the screen has actually recorded, which also survives a reload.
  const mine = state?.controls[slot];
  const picked = tapped?.round === round ? tapped.choice : mine?.round === round ? mine.choice : null;

  function answer(choice: number) {
    if (!live || picked !== null) return;
    setTapped({ round, choice });
    sendAnswer(room, slot, round, choice);
    vibrateSuccess();
  }

  if (!live) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <span className="text-5xl">🧠</span>
        <p className="font-heading text-xl font-black">Mira la pantalla grande</p>
        <p className="text-sm text-white/60">Las formas aparecerán aquí cuando salga la pregunta</p>
      </div>
    );
  }

  return (
    <>
      <p className="pt-3 text-center text-xs font-bold text-white/60">
        {picked === null ? "Mira la pantalla y elige" : "Respuesta enviada ✓"}
      </p>
      <div className="grid flex-1 grid-cols-2 gap-3 p-4">
        {SHAPES.map((s, i) => (
          <button
            key={s.shape}
            onClick={() => answer(i)}
            disabled={picked !== null}
            aria-label={`Respuesta ${i + 1}`}
            className="flex items-center justify-center rounded-3xl text-white shadow-lg transition active:scale-95"
            style={{
              background: s.color,
              // Once you've answered, only your pick stays lit.
              opacity: picked === null || picked === i ? 1 : 0.25,
            }}
          >
            <AnswerShape index={i} size={64} />
          </button>
        ))}
      </div>
    </>
  );
}

function QuizControllerInner() {
  const room = useSearchParams().get("room");
  return (
    <ControllerShell collection={QUIZ_COLLECTION} room={room} emoji="🧠">
      {({ slot }) => <QuizPad room={room!} slot={slot} />}
    </ControllerShell>
  );
}

export default function QuizControllerPage() {
  return (
    <Suspense fallback={null}>
      <QuizControllerInner />
    </Suspense>
  );
}
