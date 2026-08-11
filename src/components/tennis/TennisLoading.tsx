"use client";

import { useEffect, useRef } from "react";

const LOAD_MS = 2800;

/** Arcade-cabinet style loading card shown between the lobby and the match. */
export default function TennisLoading({ onDone }: { onDone: () => void }) {
  // Held in a ref so the countdown starts once and stays started. Depending on
  // the callback restarted it on every re-render, and a controller sending
  // swings while this screen is up re-renders the page constantly — the
  // loading card would never hand over to the match.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    const id = setTimeout(() => done.current(), LOAD_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-[#12121c] px-6">
      <p className="font-heading text-xs font-black tracking-[0.45em] text-lime-300">TENIS VIRTUAL</p>

      <div className="w-full max-w-[420px] overflow-hidden rounded-xl border-4 border-lime-300/80 shadow-[0_0_38px_rgba(190,242,100,0.35)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- animated GIF: next/image would strip the animation */}
        <img src="/games/tennis-loading.gif" alt="" className="block w-full" />
      </div>

      <div className="w-full max-w-[420px]">
        <div className="flex items-end justify-between">
          <span className="font-heading text-lg font-black tracking-[0.2em] text-white">CARGANDO</span>
          <span className="animate-arcade-blink font-heading text-xs font-black tracking-[0.2em] text-lime-300">
            ¡PREPARAOS!
          </span>
        </div>
        <div className="mt-2 h-6 border-4 border-white/85 bg-black/60 p-[3px]">
          <div
            className="animate-arcade-load h-full bg-lime-300"
            style={{ "--load-duration": `${LOAD_MS}ms` } as React.CSSProperties}
          />
        </div>
      </div>

      <p className="animate-arcade-blink font-heading text-sm font-black tracking-[0.3em] text-white/80">
        ¡A POR LOS TICKETS!
      </p>
    </div>
  );
}
