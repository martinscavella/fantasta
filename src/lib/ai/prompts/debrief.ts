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

  return `Sei il mio collega d'asta per il fantacalcio (Serie A, modalità Classic) e l'asta è appena finita. Facciamo il punto insieme.

## Asta: ${nomeAsta}

## Rosa finale (ruolo, nome, squadra, prezzo pagato)
${rosaTesto || "(nessun giocatore acquistato)"}

Spesa totale: ${spesaTotale} crediti.

## Piano di partenza
${strategiaTesto}

## Come leggerlo
Il piano era un'ipotesi scritta prima di sedersi al tavolo, non un contratto: al tavolo c'erano altre persone con i loro crediti e le loro idee, e i prezzi li ha fatti il mercato. Scostarsi dal piano non è di per sé un errore — spesso è la reazione giusta a un'asta andata diversamente. Quindi niente pagelle e niente "avresti dovuto": valuta la rosa che ho in mano adesso, e quando parli di uno scostamento dimmi se è stato un adattamento sensato o un cedimento all'asta, e cosa me ne porto per la prossima volta.

## Cosa produrre
Prosa, niente formato particolare. In quest'ordine:
1. La rosa com'è: dove sono forte davvero e su quali reparti mi giocherò la stagione.
2. I punti deboli concreti — buchi di titolarità, reparti sottili, giocatori pagati oltre quello che rendono.
3. Rischio di concentrazione: se ho tre o più giocatori dello stesso club, dimmelo esplicitamente — una domenica storta di quella squadra, un cambio di allenatore o il turnover delle coppe mi affondano mezza rosa in una volta.
4. Dove il piano e il mercato hanno divergito, e la lettura onesta di quella divergenza (mercato più caro del previsto? obiettivi spariti subito? occasione colta al volo?).
5. Il mercato di riparazione: due o tre mosse concrete, in ordine di priorità, con chi cedere e su quale profilo puntare.`;
}
