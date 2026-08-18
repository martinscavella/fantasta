import type { BudgetPerRuolo, Ruolo } from "@/lib/blob/schemas";

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];

export function totaleBudget(budget: BudgetPerRuolo): number {
  return budget.P + budget.D + budget.C + budget.A;
}

export function percentuali(budget: BudgetPerRuolo, creditiBase: number): Record<Ruolo, number> {
  if (creditiBase <= 0) return { P: 0, D: 0, C: 0, A: 0 };
  return {
    P: (budget.P / creditiBase) * 100,
    D: (budget.D / creditiBase) * 100,
    C: (budget.C / creditiBase) * 100,
    A: (budget.A / creditiBase) * 100,
  };
}

// Positivo = il budget dei reparti supera i crediti base della lega.
export function sforamento(budget: BudgetPerRuolo, creditiBase: number): number {
  return totaleBudget(budget) - creditiBase;
}

/**
 * Cambia il credito di un reparto e ridistribuisce automaticamente il resto
 * sugli altri tre, in proporzione al loro peso attuale — così il totale resta
 * ancorato a `creditiBase` (§ Budget per reparto: "ricalcolo automatico" nel
 * piano). Se i tre reparti restanti non hanno ancora peso (tutti a 0), il
 * residuo si divide in parti uguali tra loro.
 */
export function ricalcolaBudget(
  budget: BudgetPerRuolo,
  creditiBase: number,
  ruolo: Ruolo,
  nuovoValore: number,
): BudgetPerRuolo {
  const valore = Math.max(0, Math.min(creditiBase, Math.round(nuovoValore)));
  const altri = RUOLI.filter((r) => r !== ruolo);
  const residuo = creditiBase - valore;
  const pesoAltriAttuale = altri.reduce((tot, r) => tot + budget[r], 0);

  const risultato = { ...budget, [ruolo]: valore } as BudgetPerRuolo;

  if (pesoAltriAttuale === 0) {
    const quota = Math.floor(residuo / altri.length);
    altri.forEach((r, i) => {
      risultato[r] = i === altri.length - 1 ? residuo - quota * (altri.length - 1) : quota;
    });
    return risultato;
  }

  let assegnato = 0;
  altri.forEach((r, i) => {
    if (i === altri.length - 1) {
      risultato[r] = Math.max(0, residuo - assegnato);
    } else {
      const quota = Math.max(0, Math.round((budget[r] / pesoAltriAttuale) * residuo));
      risultato[r] = quota;
      assegnato += quota;
    }
  });
  return risultato;
}
