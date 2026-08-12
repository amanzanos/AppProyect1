"use client";

import { Loader2, MonitorSmartphone, Play, X } from "lucide-react";
import { MAX_PLAYERS, type PlayerSlot, type Seat } from "@/lib/data/gameRoom";
import { firebaseConfigured } from "@/lib/firebase";

interface GameLobbyProps {
  title: string;
  emoji: string;
  /** Radial background, so each game gets its own colour. */
  background: string;
  steps: { icon: string; text: string }[];
  roomId: string | null;
  /** One code for the whole room — whoever scans it takes the next free seat. */
  qr: string | null;
  seats: Record<PlayerSlot, Seat>;
  /** Below this many the game can't start. Two for the duels, one for the rest. */
  minPlayers?: number;
  /** Some games can't take the full eight — tennis is a duel. */
  maxPlayers?: number;
  onStart: () => void;
  onExit: () => void;
  /** Rendered next to the exit button — the tennis orientation toggle. */
  action?: React.ReactNode;
}

/** A claimed seat, or an empty chair waiting for somebody. */
function SeatCard({ slot, seat }: { slot: PlayerSlot; seat: Seat | undefined }) {
  if (!seat) {
    return (
      <div className="flex h-[4.5rem] w-[4.5rem] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/20 text-white/25">
        <span className="text-xl font-black">{slot}</span>
      </div>
    );
  }
  return (
    <div
      className="animate-pop-in flex h-[4.5rem] w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl px-1"
      style={{ background: seat.color }}
    >
      <span className="text-2xl leading-none">{seat.emoji}</span>
      <span className="w-full truncate text-center text-[10px] font-black leading-tight text-white">
        {seat.name}
      </span>
    </div>
  );
}

/**
 * The join screen: how to play, one QR everybody scans, and the chairs filling
 * up underneath as people arrive.
 *
 * One code rather than one per player is what lets the party be any size. It
 * also means the screen never has to be told how many are coming — it finds
 * out as they turn up.
 */
export default function GameLobby({
  title,
  emoji,
  background,
  steps,
  roomId,
  qr,
  seats,
  minPlayers = 2,
  maxPlayers = MAX_PLAYERS,
  onStart,
  onExit,
  action,
}: GameLobbyProps) {
  const taken = Object.keys(seats).length;
  const ready = taken >= minPlayers;
  const chairs = Array.from({ length: maxPlayers }, (_, i) => i + 1);

  // With no Firebase project behind the build the code is worthless: phones can
  // scan it and nothing will ever happen. Saying so beats a spinner that never
  // resolves.
  if (!firebaseConfigured) {
    return (
      <div
        className="relative flex h-full w-full flex-col items-center justify-center gap-4 px-8 text-center text-white"
        style={{ background }}
      >
        <button
          onClick={onExit}
          aria-label="Salir"
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 active:scale-95"
        >
          <X size={20} />
        </button>
        <span className="text-5xl">🔌</span>
        <h1 className="font-heading text-2xl font-black">Modo fiesta no disponible</h1>
        <p className="max-w-[30ch] text-sm leading-snug text-white/70">
          Esta versión no tiene servidor configurado, así que los móviles no pueden conectarse con la
          pantalla. Los juegos de un jugador funcionan igual.
        </p>
        <button
          onClick={onExit}
          className="mt-2 rounded-full bg-white px-8 py-3.5 font-heading font-black text-neutral-900 active:scale-95"
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full w-full flex-col items-center overflow-y-auto px-4 py-6 text-white"
      style={{ background }}
    >
      <button
        onClick={onExit}
        aria-label="Salir"
        className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 active:scale-95"
      >
        <X size={20} />
      </button>
      {action && <div className="absolute right-4 top-4">{action}</div>}

      <div className="mt-6 flex flex-col items-center gap-0.5">
        <span className="text-3xl">{emoji}</span>
        <h1 className="font-heading text-3xl font-black tracking-tight drop-shadow">{title}</h1>
      </div>

      <div className="mt-4 flex w-full max-w-3xl flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center sm:gap-8">
        {/* The one code. Big, because it is being read from across a room. */}
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div className="rounded-2xl bg-white p-2.5 shadow-xl">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URI generated client-side by QRCode.toDataURL, nothing for the image optimizer to fetch
              <img src={qr} alt="Código QR para unirse a la partida" className="h-40 w-40" />
            ) : (
              <div className="flex h-40 w-40 items-center justify-center">
                <Loader2 size={24} className="animate-spin text-neutral-300" />
              </div>
            )}
          </div>
          {roomId && (
            <p className="rounded-full bg-white/15 px-3 py-1 font-heading text-sm font-black tracking-[0.3em]">
              {roomId}
            </p>
          )}
        </div>

        <div className="w-full max-w-sm rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white/70">
            <MonitorSmartphone size={14} /> Cómo se juega
          </p>
          <ol className="mt-2.5 flex flex-col gap-2.5">
            {steps.map((step, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-base">
                  {step.icon}
                </span>
                <span className="text-sm leading-snug text-white/90">{step.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
        {chairs.map((slot) => (
          <SeatCard key={slot} slot={slot} seat={seats[slot]} />
        ))}
      </div>

      <button
        onClick={onStart}
        disabled={!ready}
        className={`mt-5 flex items-center gap-2 rounded-full px-8 py-3.5 font-heading text-lg font-extrabold shadow-xl transition active:scale-95 ${
          ready
            ? "bg-gradient-to-r from-lime-300 to-emerald-400 text-emerald-950"
            : "bg-white/20 text-white/40"
        }`}
      >
        <Play size={20} fill="currentColor" />
        ¡A jugar!
      </button>

      <p className="mb-4 mt-2 text-center text-xs text-white/60">
        {ready
          ? `${taken} ${taken === 1 ? "jugador listo" : "jugadores listos"} 🎮 · pueden seguir entrando`
          : minPlayers === 1
            ? "Escanead el QR para entrar"
            : `Escanead el QR — hacen falta al menos ${minPlayers}`}
      </p>
    </div>
  );
}
