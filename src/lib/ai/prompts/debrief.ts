import type { Player, StrategyDoc } from "@/lib/blob/schemas";

export type RigaRosaDebrief = { player: Player; price: number };

/**
 * Nessuno schema JSON qui: il debrief è prosa da leggere (§ Debrief post-asta
 * nel piano — "non serve nemmeno importarla"), non un documento da validare.
 */
export function buildPromptDebrief(
  nomeAsta: string,
  rosaFinale: RigaRosaDebrief[],
  strategy: StrategyDoc | null,
): string {
  const rosaTesto = rosaFinale
    .map((r) => `${r.player.ruolo}\t${r.player.nome}\t${r.player.squadra}\t${r.price}`)
    .join("\n");

  const spesaTotale = rosaFinale.reduce((tot, r) => tot + r.price, 0);

  const strategiaTesto = strategy
    ? `Budget pianificato per reparto: P ${strategy.budgetReparto.P}, D ${strategy.budgetReparto.D}, C ${strategy.budgetReparto.C}, A ${strategy.budgetReparto.A}.${strategy.sintesiIA ? `\nSintesi della strategia pianificata: ${strategy.sintesiIA}` : ""}`
    : "Nessuna strategia pianificata registrata per questa asta.";

  return `Sei un assistente per il debrief post-asta del fantacalcio (Serie A, modalità Classic).

## Asta: ${nomeAsta}

## Rosa finale (ruolo, nome, squadra, prezzo pagato)
${rosaTesto || "(nessun giocatore acquistato)"}

Spesa totale: ${spesaTotale} crediti.

## Strategia pianificata prima dell'asta
${strategiaTesto}

## Cosa produrre
Valuta la rosa finale rispetto al piano: punti deboli per reparto, scostamento dalla strategia pianificata (dove si è speso più o meno del previsto e perché potrebbe essere un problema), e indicazioni concrete per il mercato di riparazione. Rispondi in prosa, non serve nessun formato particolare.`;
}
