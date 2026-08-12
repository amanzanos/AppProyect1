"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Lock, Pencil, Play, Star, Users, Volume2, VolumeX } from "lucide-react";
import PlayerSetup from "@/components/PlayerSetup";
import { adsActive, hideBanner, showBanner } from "@/lib/ads";
import { getMuted, setMuted, sfx } from "@/lib/juice";
import { soloBest, totalStars, useSolo } from "@/lib/solo";
import { recordFor, useRecords } from "@/lib/records";
import { usePlayers } from "@/lib/players";
import { ALL_GAMES, GAMES, type GameDef } from "@/lib/gameCatalog";

/** Three pips under a card, showing what that game has been beaten to. */
function Stars({ count }: { count: number }) {
  return (
    <span className="flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <Star
          key={i}
          size={13}
          className={i < count ? "text-amber-400" : "text-neutral-300"}
          fill={i < count ? "currentColor" : "none"}
          strokeWidth={2.5}
        />
      ))}
    </span>
  );
}

function GameCard({ game, stars, best }: { game: GameDef; stars: number; best: number }) {
  const solo = game.soloHref;
  // The solo-only games point `href` at their own route, so there is no
  // second-phone version to offer.
  const versus = game.href !== game.soloHref ? game.href : null;

  return (
    <article className="overflow-hidden rounded-[26px] bg-[#fdfbff] shadow-[0_14px_30px_-12px_rgba(20,8,60,0.7)]">
      <div className="flex items-stretch gap-3 p-3">
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 py-1">
          <div>
            <p className="font-heading text-lg font-black leading-tight text-[#2b1a5e]">{game.name}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-neutral-400">
              {game.soloTagline ?? game.tagline}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Stars count={stars} />
            {best > 0 && (
              <span className="tnum text-[11px] font-bold text-neutral-400">récord {best}</span>
            )}
          </div>
        </div>

        <span
          className="relative flex h-auto w-[92px] shrink-0 items-center justify-center self-stretch overflow-hidden rounded-[20px] text-4xl"
          style={{ background: `${game.accent}1f` }}
        >
          {game.thumbnail ? (
            <Image src={game.thumbnail} alt="" fill sizes="92px" className="object-cover" />
          ) : (
            game.emoji
          )}
        </span>
      </div>

      <div className="flex gap-2 px-3 pb-3">
        {solo ? (
          <Link
            href={solo}
            onClick={() => sfx.tap()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-3 font-heading text-base font-black text-white active:scale-95"
            style={{ background: game.accent }}
          >
            <Play size={15} fill="currentColor" /> JUGAR
          </Link>
        ) : (
          <span className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-neutral-100 py-3 font-heading text-xs font-black text-neutral-400">
            <Lock size={13} /> SOLO, PRÓXIMAMENTE
          </span>
        )}

        {/* The two-player version is still here, just no longer the front
            door — it needs a second phone and a screen, which is a lot to
            ask of someone who has had the app for ten seconds. */}
        {versus && (
          <Link
            href={versus}
            onClick={() => sfx.tap()}
            aria-label={`${game.name} — dos jugadores`}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-[#2b1a5e]/8 px-4 py-3 font-heading text-xs font-black text-[#2b1a5e]/70 active:scale-95"
          >
            <Users size={14} /> 2
          </Link>
        )}
      </div>
    </article>
  );
}

export default function GamesPage() {
  const { players, update } = usePlayers();
  const { store: solo, refresh } = useSolo();
  const { store: versus } = useRecords();
  const [editing, setEditing] = useState(false);
  const [quiet, setQuiet] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage isn't readable during render
    setQuiet(getMuted());
    refresh();
  }, [refresh]);

  // The hub is the only screen carrying a banner: it's the one place nobody
  // is mid-throw. Games hide it going in and it comes back here.
  useEffect(() => {
    showBanner();
    return () => {
      hideBanner();
    };
  }, []);

  const stars = totalStars(solo);
  const maxStars = ALL_GAMES.length * 3;
  const versusPlays = GAMES.reduce((sum, g) => {
    const r = recordFor(versus, g.id);
    return sum + r[1].plays + r[2].plays;
  }, 0);

  return (
    <main
      className={`min-h-dvh bg-[#2b1a5e] bg-[radial-gradient(circle_at_20%_-5%,#4b2ea8_0%,#2b1a5e_45%,#1b1040_100%)] ${
        adsActive() ? "pb-[calc(6rem+env(safe-area-inset-bottom))]" : "pb-12"
      }`}
    >
      <header className="flex items-start justify-between gap-3 px-5 pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <div>
          <h1 className="font-heading text-4xl font-black tracking-tight text-white">Blopy</h1>
          <p className="mt-0.5 text-xs font-semibold text-violet-200/70">{ALL_GAMES.length} juegos, un dedo</p>
        </div>
        <button
          onClick={() => {
            const next = !quiet;
            setQuiet(next);
            setMuted(next);
            if (!next) sfx.tap();
          }}
          aria-label={quiet ? "Activar sonido" : "Silenciar"}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white active:scale-95"
        >
          {quiet ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </header>

      {/* Total stars — the one number worth chasing, and the reason to come
          back tomorrow. */}
      <section className="mx-5 mt-4 flex items-center gap-3 rounded-[26px] bg-white/10 px-4 py-3.5 backdrop-blur-sm">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400/20">
          <Star size={24} className="text-amber-300" fill="currentColor" strokeWidth={0} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="tnum font-heading text-2xl font-black leading-none text-white">
            {stars}
            <span className="text-base text-white/35"> / {maxStars}</span>
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-white/50">
            {stars === maxStars ? "¡Todas conseguidas!" : "estrellas conseguidas"}
          </p>
        </div>
        <span className="h-9 w-px bg-white/15" />
        <div className="shrink-0 text-right">
          <p className="tnum font-heading text-lg font-black leading-none text-white/80">{versusPlays}</p>
          <p className="mt-0.5 text-[10px] font-semibold text-white/40">partidas a 2</p>
        </div>
      </section>

      <div className="mt-4 flex flex-col gap-3 px-5">
        {ALL_GAMES.map((g) => {
          const best = soloBest(solo, g.id);
          return <GameCard key={g.id} game={g} stars={best.stars} best={best.score} />;
        })}
      </div>

      <button
        onClick={() => {
          sfx.tap();
          setEditing(true);
        }}
        className="mx-5 mt-5 flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-[11px] font-bold text-white/60 active:scale-95"
      >
        <Pencil size={11} /> Jugadores para el modo a 2
      </button>

      <Link href="/privacidad" className="mx-5 mt-4 block pb-2 text-[11px] font-semibold text-white/30">
        Privacidad
      </Link>

      {editing && <PlayerSetup players={players} onChange={update} onDone={() => setEditing(false)} />}
    </main>
  );
}
