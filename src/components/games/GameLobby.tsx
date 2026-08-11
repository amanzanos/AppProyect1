"use client";

import { Check, Loader2, MonitorSmartphone, Play, X } from "lucide-react";
import { usePlayers } from "@/lib/players";

/**
 * Deliberately anonymous: the two codes are told apart by the colour of their
 * ring, not by a name. Whoever scans one takes that side.
 */
function QrCard({ qr, joined, color }: { qr: string | null; joined: boolean; color: string }) {

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="relative rounded-2xl bg-white p-2" style={{ boxShadow: `0 0 0 4px ${color}` }}>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URI generated client-side by QRCode.toDataURL, nothing for the image optimizer to fetch
          <img src={qr} alt="Código QR para unirse" className="h-32 w-32" />
        ) : (
          <div className="flex h-32 w-32 items-center justify-center">
            <Loader2 size={22} className="animate-spin text-neutral-300" />
          </div>
        )}
        {joined && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-2xl bg-emerald-500/95 text-white">
            <Check size={32} strokeWidth={3} />
            <span className="text-xs font-bold">¡Conectado!</span>
          </div>
        )}
      </div>
      <span className="h-1.5 w-10 rounded-full" style={{ background: color }} />
    </div>
  );
}

interface GameLobbyProps {
  title: string;
  emoji: string;
  /** Radial background, so each game gets its own colour. */
  background: string;
  steps: { icon: string; text: string }[];
  roomId: string | null;
  qr1: string | null;
  qr2: string | null;
  joined1: boolean;
  joined2: boolean;
  onStart: () => void;
  onExit: () => void;
  /** Rendered next to the exit button — the tennis orientation toggle. */
  action?: React.ReactNode;
}

/** Shared join screen: how to play up top, both codes on one row underneath. */
export default function GameLobby({
  title,
  emoji,
  background,
  steps,
  roomId,
  qr1,
  qr2,
  joined1,
  joined2,
  onStart,
  onExit,
  action,
}: GameLobbyProps) {
  const { players } = usePlayers();
  const bothReady = joined1 && joined2;

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

      <div className="mt-8 flex flex-col items-center gap-0.5">
        <span className="text-3xl">{emoji}</span>
        <h1 className="font-heading text-3xl font-black tracking-tight drop-shadow">{title}</h1>
        {roomId && (
          <p className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-[0.2em]">SALA {roomId}</p>
        )}
      </div>

      <div className="mt-5 w-full max-w-lg rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
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

      <div className="mt-5 flex items-start justify-center gap-6">
        <QrCard qr={qr1} joined={joined1} color={players[1].color} />
        <QrCard qr={qr2} joined={joined2} color={players[2].color} />
      </div>

      <button
        onClick={onStart}
        className={`mt-5 flex items-center gap-2 rounded-full px-8 py-3.5 font-heading text-lg font-extrabold shadow-xl transition active:scale-95 ${
          bothReady ? "bg-gradient-to-r from-lime-300 to-emerald-400 text-emerald-950" : "bg-white/85 text-neutral-700"
        }`}
      >
        <Play size={20} fill="currentColor" />
        {bothReady ? "¡A jugar!" : "Empezar de todas formas"}
      </button>

      <p className="mb-4 mt-2 text-center text-xs text-white/60">
        {bothReady ? "Los dos mandos están listos 🎮" : "Esperando a que los dos móviles se conecten…"}
      </p>
    </div>
  );
}
