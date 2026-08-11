"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Wifi, X } from "lucide-react";
import AnswerShape from "@/components/games/AnswerShape";
import { SHAPES } from "@/lib/quiz";
import { joinQuizRoom, sendAnswer, useQuizRoom } from "@/lib/data/quizGame";
import { useRoomPlayers } from "@/lib/roomPlayers";
import { vibrateSuccess } from "@/lib/haptics";

/**
 * The phone never sees the question — it's on the big screen. All it offers is
 * the four marks, so answering means looking up and then down at a shape.
 */
function QuizControllerInner() {
  const router = useRouter();
  const params = useSearchParams();
  const room = params.get("room");
  const player = params.get("player") === "2" ? 2 : 1;
  const me = useRoomPlayers("quizGames", room)[player];

  // Held against the round it was for, so a new question clears it without an
  // effect having to reach in and reset anything.
  const [tapped, setTapped] = useState<{ round: number; choice: number } | null>(null);
  const state = useQuizRoom(room);
  const round = state?.round ?? -1;
  const live = round >= 0;

  // What the screen has actually recorded, which also survives a reload.
  const mine = player === 1 ? state?.player1Answer : state?.player2Answer;
  const picked =
    tapped?.round === round ? tapped.choice : mine?.round === round ? mine.choice : null;

  useEffect(() => {
    if (!room) return;
    joinQuizRoom(room, player);
  }, [room, player]);

  function answer(choice: number) {
    if (!room || !live || picked !== null) return;
    setTapped({ round, choice });
    sendAnswer(room, player, round, choice);
    vibrateSuccess();
  }

  if (!room) {
    return (
      <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-3 bg-neutral-900 px-8 text-center text-white">
        <span className="text-4xl">🧠</span>
        <p className="font-heading text-lg font-bold">Falta el código de sala</p>
        <p className="text-sm text-white/60">Escanea el QR de la pantalla grande para unirte a la partida.</p>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[999] flex flex-col text-white"
      style={{ background: `radial-gradient(circle at 50% 12%, ${me.color} 0%, #1b1040 70%)` }}
    >
      <div className="flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button
          onClick={() => router.push("/games")}
          aria-label="Salir"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 active:scale-95"
        >
          <X size={20} />
        </button>
        <p className="font-heading text-lg font-black drop-shadow">{me.name}</p>
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-white/70">
          <Wifi size={13} /> {room}
        </span>
      </div>

      {live ? (
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
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <span className="text-5xl">🧠</span>
          <p className="font-heading text-xl font-black">Mira la pantalla grande</p>
          <p className="text-sm text-white/60">Las formas aparecerán aquí cuando salga la pregunta</p>
        </div>
      )}
    </div>
  );
}

export default function QuizControllerPage() {
  return (
    <Suspense fallback={null}>
      <QuizControllerInner />
    </Suspense>
  );
}
