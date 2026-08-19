import type { Ruolo } from "@/lib/blob/schemas";

// Palette per ruolo condivisa da listone, asta e squadre — stessa convenzione
// cromatica ovunque (P ambra, D verde, C blu, A rosso) così un colore basta a
// riconoscere il reparto senza leggere la lettera.
export const RUOLI: Ruolo[] = ["P", "D", "C", "A"];

export const RUOLO_LABEL: Record<Ruolo, string> = {
  P: "Portieri",
  D: "Difensori",
  C: "Centrocampisti",
  A: "Attaccanti",
};

type RuoloClassi = {
  // Badge outline discreto (liste, filtri non attivi)
  badge: string;
  // Pill piena, per lo stato attivo di un filtro o un riepilogo enfatizzato
  solid: string;
  // Banda di intestazione (gruppo ruolo nella rosa)
  band: string;
  // Pallino/indicatore puntiforme
  dot: string;
};

export const RUOLO_CLASSI: Record<Ruolo, RuoloClassi> = {
  P: {
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    solid: "bg-amber-500 text-white dark:bg-amber-600",
    band: "bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  D: {
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    solid: "bg-emerald-500 text-white dark:bg-emerald-600",
    band: "bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  C: {
    badge: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
    solid: "bg-sky-500 text-white dark:bg-sky-600",
    band: "bg-sky-500/15 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  A: {
    badge: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
    solid: "bg-rose-500 text-white dark:bg-rose-600",
    band: "bg-rose-500/15 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300",
    dot: "bg-rose-500",
  },
};
