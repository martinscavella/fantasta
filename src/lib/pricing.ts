// Fasce di default alla convenzione standard (§ Preparazione asta nel piano).
// Le soglie personalizzate per lega vivono in StrategyDoc.fasce (Fase 5);
// questa è la classificazione generica usata per la sfoglia del listone.

export type FasciaStandard = "Top" | "Semitop" | "Terza fascia" | "Scommesse";

const SOGLIE_STANDARD: { nome: FasciaStandard; min: number }[] = [
  { nome: "Top", min: 30 },
  { nome: "Semitop", min: 15 },
  { nome: "Terza fascia", min: 6 },
  { nome: "Scommesse", min: 1 },
];

// null = fuori quotazione (0 crediti), nessuna fascia applicabile.
export function fasciaStandard(quotazione: number): FasciaStandard | null {
  return SOGLIE_STANDARD.find((s) => quotazione >= s.min)?.nome ?? null;
}
