"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { ChevronRight, PartyPopper, RotateCcw, X } from "lucide-react";
import { clearParty, computeAwards, useParty } from "@/lib/party";
import { vibrateSuccess } from "@/lib/haptics";

const BACKGROUND = "radial-gradient(circle at 50% -10%, #f5a524 0%, #c026a3 45%, #1b1040 100%)";

function burst(color: string) {
  confetti({
    particleCount: 130,
    spread: 95,
    origin: { y: 0.4 },
    colors: [color, "#ffc94d", "#ffffff"],
  });
}

type Phase = "intro" | "awards" | "outro";

export default function FiestaPage() {
  const router = useRouter();
  const { matches } = useParty();
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);

  const awards = computeAwards(matches);
  const gamesPlayed = new Set(matches.map((m) => m.gameId)).size;
  const current = awards[index];

  const reveal = useCallback(() => {
    setPhase("awards");
    setIndex(0);
  }, []);

  const next = useCallback(() => {
    vibrateSuccess();
    if (index + 1 >= awards.length) {
      setPhase("outro");
      confetti({ particleCount: 220, spread: 120, origin: { y: 0.5 }, colors: ["#ffc94d", "#f472b6", "#a78bfa", "#4ade80"] });
      return;
    }
    setIndex((i) => i + 1);
  }, [index, awards.length]);

  function newParty() {
    clearParty();
    router.push("/games");
  }

  if (matches.length === 0) {
    return (
      <div
        className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-4 px-8 text-center text-white"
        style={{ background: BACKGROUND }}
      >
        <span className="text-5xl">🎉</span>
        <h1 className="font-heading text-2xl font-black">Aún no hay nada que celebrar</h1>
        <p className="max-w-[30ch] text-sm text-white/70">
          Jugad un par de partidas en grupo y el resumen se va llenando solo.
        </p>
        <button
          onClick={() => router.push("/games")}
          className="mt-2 rounded-full bg-white px-8 py-3.5 font-heading font-black text-neutral-900 active:scale-95"
        >
          Volver
        </button>
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div
        className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-4 px-8 text-center text-white"
        style={{ background: BACKGROUND }}
      >
        <button
          onClick={() => router.push("/games")}
          aria-label="Salir"
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 active:scale-95"
        >
          <X size={20} />
        </button>

        <span className="animate-float text-6xl">🎉</span>
        <h1 className="font-heading text-4xl font-black drop-shadow">Resumen de la fiesta</h1>
        <p className="tnum text-sm font-bold text-white/80">
          {matches.length} {matches.length === 1 ? "partida jugada" : "partidas jugadas"} en {gamesPlayed}{" "}
          {gamesPlayed === 1 ? "juego" : "juegos"}
        </p>

        <button
          onClick={reveal}
          disabled={awards.length === 0}
          className="mt-3 flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-300 to-fuchsia-400 px-9 py-4 font-heading text-lg font-black text-fuchsia-950 shadow-xl active:scale-95 disabled:opacity-50"
        >
          <PartyPopper size={20} /> {awards.length > 0 ? "Ver los premios" : "Nadie destacó esta vez"}
        </button>
        {awards.length === 0 && (
          <p className="max-w-[30ch] text-xs text-white/60">
            Todo muy reñido — ni un solo premio sin empate. La próxima seguro que sí.
          </p>
        )}
      </div>
    );
  }

  if (phase === "awards" && current) {
    return (
      <button
        onClick={next}
        aria-label="Siguiente premio"
        className="fixed inset-0 z-[999] flex w-full flex-col items-center justify-center gap-3 px-8 text-center text-white"
        style={{ background: BACKGROUND }}
      >
        <span className="text-xs font-black uppercase tracking-[0.3em] text-white/50">
          Premio {index + 1} de {awards.length}
        </span>

        {/* Re-keyed per award so the pop-in and the confetti fire fresh every time,
            even when two awards in a row share an emoji. */}
        <AwardCard key={current.id} award={current} />

        <span className="mt-4 flex items-center gap-1 text-xs font-bold text-white/50">
          Toca para seguir <ChevronRight size={14} />
        </span>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-4 px-8 text-center text-white"
      style={{ background: BACKGROUND }}
    >
      <span className="text-6xl">🏆</span>
      <h1 className="font-heading text-3xl font-black drop-shadow">¡Eso ha sido la fiesta!</h1>
      <p className="max-w-[32ch] text-sm text-white/70">
        Los récords de cada juego se quedan guardados en este móvil. Este resumen se borra cuando cerréis la app.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <button
          onClick={() => router.push("/games")}
          className="rounded-full bg-white px-7 py-3.5 font-heading font-black text-neutral-900 active:scale-95"
        >
          Seguir jugando
        </button>
        <button
          onClick={newParty}
          className="flex items-center gap-1.5 rounded-full bg-white/15 px-7 py-3.5 font-heading font-black text-white active:scale-95"
        >
          <RotateCcw size={16} /> Empezar otra fiesta
        </button>
      </div>
    </div>
  );
}

function AwardCard({ award }: { award: ReturnType<typeof computeAwards>[number] }) {
  // Re-mounted per award (the parent keys this by award.id), so this fires
  // once, right as that award's card appears — not once per re-render.
  useEffect(() => {
    burst(award.color);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately once per mount, not on every prop change
  }, []);

  return (
    <div className="animate-pop-in flex flex-col items-center gap-2">
      <span className="text-7xl drop-shadow-lg">{award.emoji}</span>
      <h2 className="font-heading text-lg font-black uppercase tracking-wide text-white/85">{award.title}</h2>
      <p
        className="mt-1 rounded-3xl px-6 py-3 font-heading text-4xl font-black shadow-xl"
        style={{ background: award.color, color: "#ffffff" }}
      >
        {award.name}
      </p>
      <p className="tnum text-sm font-bold text-white/70">
        {award.subtitle} · {award.stat}
      </p>
    </div>
  );
}
