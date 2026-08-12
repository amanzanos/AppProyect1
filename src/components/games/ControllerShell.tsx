"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wifi, X } from "lucide-react";
import { useMySeat } from "@/lib/roomPlayers";
import type { PlayerSlot, Seat } from "@/lib/data/gameRoom";

interface ControllerShellProps {
  collection: string;
  room: string | null;
  emoji: string;
  /** Rendered once this phone actually has a seat. */
  children: (seat: { slot: PlayerSlot; me: Seat }) => ReactNode;
}

/** Centred message on the game's own background — every dead end looks alike. */
function Notice({
  emoji,
  title,
  body,
  onRetry,
}: {
  emoji: string;
  title: string;
  body: string;
  onRetry?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-3 bg-neutral-900 px-8 text-center text-white">
      <span className="text-5xl">{emoji}</span>
      <p className="font-heading text-lg font-black">{title}</p>
      <p className="max-w-[32ch] text-sm leading-snug text-white/60">{body}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 rounded-full bg-white px-7 py-3 font-heading font-black text-neutral-900 active:scale-95"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

/**
 * Everything every controller needs before the game itself starts: take a
 * seat, say who you are, and know which room you're in.
 *
 * The name is typed here rather than on the television. With one QR for the
 * whole party the screen has no idea who is about to walk in, and asking eight
 * people to take turns typing on a TV remote is nobody's idea of a party.
 */
export default function ControllerShell({ collection, room, emoji, children }: ControllerShellProps) {
  const router = useRouter();
  const { slot, me, status, rename, retry } = useMySeat(collection, room);
  // Null until they type something: the field shows the seat's own name until
  // then, so nothing has to be copied into state when the seat arrives.
  const [draft, setDraft] = useState<string | null>(null);

  if (!room) {
    return (
      <Notice
        emoji={emoji}
        title="Falta el código de sala"
        body="Escanea el QR de la pantalla grande para unirte a la partida."
      />
    );
  }

  if (status === "offline") {
    return (
      <Notice
        emoji="🔌"
        title="Sin servidor"
        body="Esta versión no tiene servidor configurado, así que el móvil no puede conectarse con la pantalla."
      />
    );
  }

  if (status === "full") {
    return (
      <Notice
        emoji="🪑"
        title="La sala está llena"
        body="Ya hay ocho jugadores dentro. Cuando alguien salga, vuelve a escanear el QR."
        onRetry={retry}
      />
    );
  }

  if (status === "unreachable") {
    return (
      <Notice
        emoji="📡"
        title="No llego a la partida"
        body="Comprueba que tienes internet y que la pantalla sigue en el lobby de esta sala."
        onRetry={retry}
      />
    );
  }

  if (status === "claiming" || !slot) {
    return (
      <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-3 bg-neutral-900 text-white">
        <Loader2 size={28} className="animate-spin text-white/50" />
        <p className="text-sm text-white/60">Buscándote sitio…</p>
      </div>
    );
  }

  function commit() {
    if (draft !== null && draft.trim() !== me.name) rename(draft);
  }

  return (
    <div
      className="fixed inset-0 z-[999] flex flex-col text-white"
      style={{ background: `radial-gradient(circle at 50% 12%, ${me.color} 0%, #1b1040 70%)` }}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button
          onClick={() => router.push("/games")}
          aria-label="Salir"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 active:scale-95"
        >
          <X size={20} />
        </button>

        <label className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
          <span className="shrink-0 text-lg">{me.emoji}</span>
          <input
            value={draft ?? me.name}
            onChange={(e) => setDraft(e.target.value.slice(0, 12))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            aria-label="Tu nombre"
            className="min-w-0 flex-1 rounded-lg bg-white/10 px-2 py-1 text-center font-heading text-lg font-black text-white outline-none focus:bg-white/20"
          />
        </label>

        <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-white/70">
          <Wifi size={13} /> {room}
        </span>
      </div>

      {children({ slot, me })}
    </div>
  );
}
