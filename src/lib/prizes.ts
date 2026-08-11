/**
 * What the wheel hands the winner.
 *
 * The couple app spun for love coupons — massages, gyozas, a surprise date.
 * That doesn't travel: strangers at a party don't owe each other a massage.
 * These are forfeits the loser pays instead, which is the format party games
 * have used forever and needs nothing stored anywhere.
 */

export interface PrizeDef {
  id: string;
  /** Short enough to read off a wheel segment mid-spin. */
  label: string;
  /** The full instruction, once it's landed. */
  detail: string;
  color: string;
}

export const PRIZES: PrizeDef[] = [
  {
    id: "bebida",
    label: "sirve",
    detail: "El que pierde sirve las bebidas de la próxima ronda",
    color: "#6d3bd4",
  },
  {
    id: "acento",
    label: "acento",
    detail: "El que pierde habla con acento hasta la siguiente partida",
    color: "#f5a524",
  },
  {
    id: "doble",
    label: "x2",
    detail: "La próxima partida vale doble para quien ha ganado",
    color: "#8b5cf6",
  },
  {
    id: "elige",
    label: "eliges",
    detail: "El ganador elige a qué se juega la próxima",
    color: "#f97316",
  },
  {
    id: "karaoke",
    label: "canta",
    detail: "El que pierde canta el estribillo de lo que le pidan",
    color: "#5b34c0",
  },
  {
    id: "selfie",
    label: "selfie",
    detail: "Foto de grupo con la cara del que ha perdido",
    color: "#fbbf24",
  },
  {
    id: "mano-mala",
    label: "otra mano",
    detail: "El que pierde juega la siguiente con la mano mala",
    color: "#7c3aed",
  },
  {
    id: "revancha",
    label: "revancha",
    detail: "Revancha inmediata, sin excusas",
    color: "#fb923c",
  },
];

export function prizeById(id: string) {
  return PRIZES.find((p) => p.id === id) ?? PRIZES[0];
}
