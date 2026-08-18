import type { BudgetPerRuolo, Player, Ruolo } from "@/lib/blob/schemas";

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];

export type RigaRosa = { player: Player; price: number };

/** Spesa reale per reparto dalla rosa finale di una squadra. */
export function spesaPerRuolo(rosa: RigaRosa[]): BudgetPerRuolo {
  const spesa: BudgetPerRuolo = { P: 0, D: 0, C: 0, A: 0 };
  for (const riga of rosa) spesa[riga.player.ruolo] += riga.price;
  return spesa;
}

export type ScostamentoReparto = {
  ruolo: Ruolo;
  pianificato: number;
  effettivo: number;
  // positivo = speso più del pianificato, negativo = speso meno.
  scostamento: number;
};

/**
 * Confronta il budget pianificato in strategy.budgetReparto con la spesa
 * reale a fine asta, reparto per reparto (§ Post-asta nel piano:
 * "scostamento dalla strategia pianificata").
 */
export function scostamentoStrategia(
  pianificato: BudgetPerRuolo,
  effettivo: BudgetPerRuolo,
): ScostamentoReparto[] {
  return RUOLI.map((ruolo) => ({
    ruolo,
    pianificato: pianificato[ruolo],
    effettivo: effettivo[ruolo],
    scostamento: effettivo[ruolo] - pianificato[ruolo],
  }));
}
