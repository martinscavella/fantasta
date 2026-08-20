import { prezzoMassimoDefault } from "@/lib/pricing";
import type { BudgetPerRuolo, Player, Ruolo, SetupDoc, StrategyDoc } from "@/lib/blob/schemas";

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];

export type SlotSimulato = {
  ruolo: Ruolo;
  indiceSlot: number;
  giocatore: Player | null;
  prezzo: number;
  fonteScelta: "obiettivo" | "alternativa" | "nessuno";
};

export type RisultatoSimulazione = {
  slot: SlotSimulato[];
  spesaTotale: number;
  entroBudget: boolean;
  // Spesa simulata per reparto, da confrontare con strategy.budgetReparto: la
  // UI la ricavava a mano dallo slot, ed e la meta della domanda "il piano sta
  // in piedi?" — l altra meta e il totale.
  spesaPerRuolo: BudgetPerRuolo;
  slotCoperti: number;
  slotTotali: number;
  // Quota del giocatore piu caro sulla spesa totale: e il numero da cui esce
  // il rating di concentrazione, esposto perche la UI possa spiegare il voto
  // invece di mostrare cinque stelle senza motivo.
  quotaMassima: number;
  rating: {
    // 0 = nessuno slot ancora impostato. 1-5 altrimenti.
    coperturaSlot: number;
    concentrazioneSpesa: number;
  };
};

/**
 * Costruisce la rosa "ideale" seguendo gli obiettivi/alternative impostati in
 * strategy.slotObiettivi, in ordine di ruolo e indice slot: per ogni slot
 * prende il primo giocatore (obiettivo, poi alternative in ordine) non ancora
 * assegnato a uno slot precedente. Non consulta il tracker d'asta — è una
 * simulazione "a bocce ferme", utile in fase di preparazione.
 *
 * Il rating copre solo ciò che è calcolabile da qui: copertura degli slot e
 * concentrazione della spesa. Il terzo fattore del piano — rischio da
 * titolarità/infortuni — richiede i dati di scraping (Fase 7) e non è ancora
 * disponibile.
 */
export function simulaRosa(setup: SetupDoc, giocatori: Player[], strategy: StrategyDoc): RisultatoSimulazione {
  const giocatoriPerId = new Map(giocatori.map((g) => [g.id, g]));
  const prezzoPerId = new Map(strategy.prezziMassimi.map((p) => [p.playerId, p.valore]));
  const usati = new Set<number>();

  const slot: SlotSimulato[] = [...strategy.slotObiettivi]
    .sort((a, b) => a.ruolo.localeCompare(b.ruolo) || a.indiceSlot - b.indiceSlot)
    .map((obiettivo): SlotSimulato => {
      const candidati = [obiettivo.obiettivoPrincipale, ...obiettivo.alternative].filter(
        (id): id is number => id !== null && giocatoriPerId.has(id),
      );
      const scelto = candidati.find((id) => !usati.has(id));

      if (scelto === undefined) {
        return { ruolo: obiettivo.ruolo, indiceSlot: obiettivo.indiceSlot, giocatore: null, prezzo: 0, fonteScelta: "nessuno" };
      }

      usati.add(scelto);
      const giocatore = giocatoriPerId.get(scelto)!;
      return {
        ruolo: obiettivo.ruolo,
        indiceSlot: obiettivo.indiceSlot,
        giocatore,
        prezzo: prezzoPerId.get(scelto) ?? prezzoMassimoDefault(giocatore.quotazioneAttuale, setup.creditiBase),
        fonteScelta: scelto === obiettivo.obiettivoPrincipale ? "obiettivo" : "alternativa",
      };
    });

  const spesaTotale = slot.reduce((tot, s) => tot + s.prezzo, 0);
  const slotTotaliAttesi = RUOLI.reduce((tot, r) => tot + setup.slot[r], 0);
  const slotCoperti = slot.filter((s) => s.giocatore !== null).length;

  const coperturaSlot =
    slotTotaliAttesi === 0 || slotCoperti === 0
      ? 0
      : Math.max(1, Math.min(5, Math.round((slotCoperti / slotTotaliAttesi) * 5)));

  const quotaMax = spesaTotale > 0 ? Math.max(...slot.map((s) => s.prezzo)) / spesaTotale : 0;
  const concentrazioneSpesa =
    slotCoperti === 0
      ? 0
      : quotaMax > 0.5
        ? 1
        : quotaMax > 0.4
          ? 2
          : quotaMax > 0.3
            ? 3
            : quotaMax > 0.2
              ? 4
              : 5;

  const spesaPerRuolo: BudgetPerRuolo = { P: 0, D: 0, C: 0, A: 0 };
  for (const s of slot) spesaPerRuolo[s.ruolo] += s.prezzo;

  return {
    slot,
    spesaTotale,
    entroBudget: spesaTotale <= setup.creditiBase,
    spesaPerRuolo,
    slotCoperti,
    slotTotali: slotTotaliAttesi,
    quotaMassima: quotaMax,
    rating: { coperturaSlot, concentrazioneSpesa },
  };
}
