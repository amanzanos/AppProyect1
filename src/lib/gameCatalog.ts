/** Every game in one place, so the hub, the records and the wheel agree. */

export type GameId = "tennis" | "darts" | "bowling" | "quiz" | "karaoke" | "moles" | "simon" | "odd";

export interface GameStatBar {
  label: string;
  /** 0-100, purely flavour — how the game feels, not a measurement. */
  value: number;
  color: string;
}

export interface GameDef {
  id: GameId;
  name: string;
  tagline: string;
  /** Artwork for the card; games without a photo fall back to the emoji. */
  thumbnail?: string;
  emoji: string;
  /** The two-phones-and-a-screen version. */
  href: string;
  /** The one-phone version, where there is one yet. */
  soloHref?: string;
  /** One line explaining the solo run, for the card. */
  soloTagline?: string;
  /** Card accent, used for the button and the glow behind the thumbnail. */
  accent: string;
  /** What a score is counted in, for the records list. */
  unit: string;
  bars: GameStatBar[];
}

export const GAMES: GameDef[] = [
  {
    id: "tennis",
    name: "Tenis virtual",
    emoji: "🎾",
    tagline: "Proyectad la pantalla y agitad los móviles como raquetas",
    thumbnail: "/games/tennis.jpg",
    href: "/games/tennis",
    accent: "#3fae6a",
    unit: "puntos",
    bars: [
      { label: "Movimiento", value: 92, color: "#22c55e" },
      { label: "Precisión", value: 58, color: "#38bdf8" },
      { label: "Piques", value: 80, color: "#f472b6" },
    ],
  },
  {
    id: "darts",
    name: "Dardos",
    emoji: "🎯",
    tagline: "Apuntad inclinando el móvil y lanzadlo hacia delante",
    soloTagline: "Para las líneas y clava el dardo — 6 tiros",
    thumbnail: "/games/darts.jpg",
    href: "/games/darts",
    soloHref: "/games/darts/solo",
    accent: "#ef4444",
    unit: "puntos",
    bars: [
      { label: "Puntería", value: 95, color: "#f97316" },
      { label: "Pulso", value: 74, color: "#a78bfa" },
      { label: "Piques", value: 66, color: "#f472b6" },
    ],
  },
  {
    id: "bowling",
    name: "Bolos",
    emoji: "🎳",
    tagline: "Elegid la línea inclinando el móvil y soltad la bola",
    thumbnail: "/games/bowling.jpg",
    href: "/games/bowling",
    accent: "#c0335f",
    unit: "puntos",
    bars: [
      { label: "Línea", value: 88, color: "#e0413f" },
      { label: "Efecto", value: 70, color: "#3f9d99" },
      { label: "Piques", value: 72, color: "#f472b6" },
    ],
  },
  {
    id: "quiz",
    name: "Quiz",
    emoji: "🧠",
    tagline: "Las preguntas salen en la pantalla y respondéis con el móvil",
    thumbnail: "/games/quiz.jpg",
    href: "/games/quiz",
    accent: "#7c4dea",
    unit: "puntos",
    bars: [
      { label: "Cultura", value: 90, color: "#7c4dea" },
      { label: "Reflejos", value: 82, color: "#e6a419" },
      { label: "Piques", value: 95, color: "#f472b6" },
    ],
  },
  {
    id: "karaoke",
    name: "Karaoke",
    emoji: "🎤",
    tagline: "La letra sale en la tele y cantáis por turnos al móvil",
    href: "/games/karaoke",
    accent: "#d9457f",
    unit: "puntos",
    bars: [
      { label: "Oído", value: 92, color: "#d9457f" },
      { label: "Vergüenza", value: 98, color: "#e6a419" },
      { label: "Piques", value: 88, color: "#f472b6" },
    ],
  },
];

/** The one-phone games. These are the front door: no room, no QR, no second
    person — tap the card and you are playing. */
export const SOLO_ONLY: GameDef[] = [
  {
    id: "moles",
    name: "Topos",
    emoji: "🐹",
    tagline: "Dales antes de que se escondan",
    soloTagline: "Dales antes de que se escondan — cuidado con las bombas",
    thumbnail: "/games/moles.jpg",
    href: "/games/moles",
    soloHref: "/games/moles",
    accent: "#f59e0b",
    unit: "puntos",
    bars: [
      { label: "Reflejos", value: 96, color: "#f59e0b" },
      { label: "Puntería", value: 70, color: "#38bdf8" },
      { label: "Nervios", value: 84, color: "#f472b6" },
    ],
  },
  {
    id: "simon",
    name: "Simón",
    emoji: "🎵",
    tagline: "Repite la melodía de colores",
    soloTagline: "Repite la melodía — cada ronda es una nota más",
    thumbnail: "/games/simon.jpg",
    href: "/games/simon",
    soloHref: "/games/simon",
    accent: "#22c55e",
    unit: "rondas",
    bars: [
      { label: "Memoria", value: 98, color: "#22c55e" },
      { label: "Oído", value: 80, color: "#a78bfa" },
      { label: "Nervios", value: 72, color: "#f472b6" },
    ],
  },
  {
    id: "odd",
    name: "El diferente",
    emoji: "🔍",
    tagline: "Encuentra el que no encaja",
    soloTagline: "Encuentra el que no encaja, cada vez más escondido",
    href: "/games/odd",
    soloHref: "/games/odd",
    accent: "#06b6d4",
    unit: "aciertos",
    bars: [
      { label: "Vista", value: 94, color: "#06b6d4" },
      { label: "Rapidez", value: 88, color: "#f59e0b" },
      { label: "Nervios", value: 60, color: "#f472b6" },
    ],
  },
];

/** Everything, solo games first — that is the order the hub shows. */
export const ALL_GAMES: GameDef[] = [...SOLO_ONLY, ...GAMES];

export function gameById(id: GameId) {
  return ALL_GAMES.find((g) => g.id === id)!;
}
