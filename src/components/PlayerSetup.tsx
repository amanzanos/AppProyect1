"use client";

import { Check } from "lucide-react";
import { EMOJI, PALETTE, type Player, type Players } from "@/lib/players";
import type { PlayerSlot } from "@/lib/data/gameRoom";

const SLOTS = [1, 2] as const;

/**
 * Naming the two seats. Deliberately a sheet you can dismiss rather than a
 * gate on first run — someone who just wants to throw a dart shouldn't have
 * to fill in a form first, and "Jugador 1" plays perfectly well.
 */
export default function PlayerSetup({
  players,
  onChange,
  onDone,
}: {
  players: Players;
  onChange: (slot: PlayerSlot, patch: Partial<Player>) => void;
  onDone: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[999] flex items-end justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm rounded-[28px] bg-[#231447] p-5 text-white shadow-2xl">
        <p className="font-heading text-xl font-black">¿Quién juega?</p>
        <p className="mt-1 text-xs text-white/50">Se guarda en este dispositivo</p>

        <div className="mt-5 flex flex-col gap-5">
          {SLOTS.map((slot) => (
            <div key={slot}>
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
                  style={{ background: players[slot].color }}
                >
                  {players[slot].emoji}
                </span>
                <input
                  value={players[slot].name}
                  onChange={(e) => onChange(slot, { name: e.target.value.slice(0, 14) })}
                  aria-label={`Nombre del jugador ${slot}`}
                  maxLength={14}
                  className="min-w-0 flex-1 rounded-2xl bg-white/10 px-3.5 py-2.5 font-heading text-base font-bold text-white outline-none placeholder:text-white/30 focus:bg-white/15"
                  placeholder={`Jugador ${slot}`}
                />
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {PALETTE.map((color) => (
                  <button
                    key={color}
                    onClick={() => onChange(slot, { color })}
                    aria-label={`Color ${color}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full active:scale-90"
                    style={{ background: color }}
                  >
                    {players[slot].color === color && <Check size={13} strokeWidth={4} className="text-white" />}
                  </button>
                ))}
              </div>

              <div className="mt-1.5 flex flex-wrap gap-1">
                {EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => onChange(slot, { emoji })}
                    aria-label={`Icono ${emoji}`}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg text-base active:scale-90 ${
                      players[slot].emoji === emoji ? "bg-white/25" : "bg-white/5"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onDone}
          className="mt-6 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-3.5 font-heading text-base font-black text-white active:scale-95"
        >
          Listo
        </button>
      </div>
    </div>
  );
}
