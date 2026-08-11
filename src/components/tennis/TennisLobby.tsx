"use client";

import { RectangleHorizontal, RectangleVertical } from "lucide-react";
import GameLobby from "@/components/games/GameLobby";
import type { Orientation } from "@/lib/tennisTypes";

interface TennisLobbyProps {
  roomId: string | null;
  qr1: string | null;
  qr2: string | null;
  joined1: boolean;
  joined2: boolean;
  orientation: Orientation;
  onToggleOrientation: () => void;
  onStart: () => void;
  onExit: () => void;
}

const STEPS = [
  { icon: "📱", text: "Cada uno escanea su QR con la cámara del móvil" },
  { icon: "🎾", text: "Agita el móvil como si dieras un raquetazo" },
  { icon: "🏆", text: "Devuelve la bola — el primero en llegar a 5 gana" },
];

export default function TennisLobby({
  roomId,
  qr1,
  qr2,
  joined1,
  joined2,
  orientation,
  onToggleOrientation,
  onStart,
  onExit,
}: TennisLobbyProps) {
  return (
    <GameLobby
      title="TENIS VIRTUAL"
      emoji="🎾"
      background="radial-gradient(circle at 50% -10%, #1e6f9a 0%, #0d3b52 45%, #07202e 100%)"
      steps={STEPS}
      roomId={roomId}
      qr1={qr1}
      qr2={qr2}
      joined1={joined1}
      joined2={joined2}
      onStart={onStart}
      onExit={onExit}
      action={
        <button
          onClick={onToggleOrientation}
          className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-2 text-xs font-bold active:scale-95"
        >
          {orientation === "landscape" ? <RectangleHorizontal size={15} /> : <RectangleVertical size={15} />}
          {orientation === "landscape" ? "Horizontal" : "Vertical"}
        </button>
      }
    />
  );
}
