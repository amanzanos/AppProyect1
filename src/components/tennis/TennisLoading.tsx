"use client";

import { useEffect, useRef } from "react";

const LOAD_MS = 2800;

/**
 * Arcade-cabinet loading card shown between the lobby and the match.
 *
 * The artwork used to be a 720 KB animated GIF — more than half the weight of
 * the entire app, for a card that is on screen for under three seconds, and
 * paid for on mobile data by everyone who ever opens the game. It is drawn
 * now instead: a few shapes and two CSS animations, a couple of hundred bytes,
 * and it scales to any screen instead of being a fixed 480×360 bitmap.
 */
function LoadingArt() {
  return (
    <svg viewBox="0 0 240 150" className="block w-full" aria-hidden>
      <rect width="240" height="150" fill="#0d2818" />

      {/* Court, in perspective. */}
      <path d="M40 150 L95 58 L145 58 L200 150 Z" fill="#1b6b3f" />
      <path d="M40 150 L95 58 L145 58 L200 150 Z" fill="none" stroke="#bef264" strokeWidth="1.6" />
      <line x1="120" y1="58" x2="120" y2="150" stroke="#bef264" strokeWidth="1" opacity="0.5" />
      <line x1="72" y1="102" x2="168" y2="102" stroke="#bef264" strokeWidth="1" opacity="0.5" />

      {/* Net. */}
      <rect x="78" y="88" width="84" height="15" fill="#0d2818" opacity="0.55" />
      <line x1="78" y1="88" x2="162" y2="88" stroke="#f8fafc" strokeWidth="2" />

      {/* Two players, bobbing out of phase so it reads as a rally. */}
      <g className="tennis-figure" style={{ transformOrigin: "112px 74px" }}>
        <circle cx="112" cy="66" r="5" fill="#fde047" />
        <rect x="108" y="71" width="8" height="13" rx="3" fill="#fde047" />
      </g>
      <g className="tennis-figure" style={{ transformOrigin: "126px 132px", animationDelay: "0.85s" }}>
        <circle cx="126" cy="120" r="7" fill="#f472b6" />
        <rect x="120" y="127" width="12" height="18" rx="4" fill="#f472b6" />
      </g>

      {/* The ball, arcing over the net and back. */}
      <circle r="5" fill="#eaff6b" stroke="#0d2818" strokeWidth="0.8">
        <animateMotion dur="1.4s" repeatCount="indefinite" path="M118 78 Q 122 40 128 126 Q 122 40 118 78" />
      </circle>
    </svg>
  );
}

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
        <LoadingArt />
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

      {/* Was "¡A POR LOS TICKETS!" — a leftover from the love-coupon prizes
          that came out with the couple app. */}
      <p className="animate-arcade-blink font-heading text-sm font-black tracking-[0.3em] text-white/80">
        ¡AL LÍO!
      </p>
    </div>
  );
}
