"use server";

import { statoAstaDaBlob } from "@/lib/analisi-live/adapter-blob";
import { registraStatoAsta } from "@/lib/analisi-live/log";
import { calcolaMetriche, costruisciRegistro, playerIdMancantiDalRegistro } from "@/lib/analisi-live/motore";
import { costruisciPromptAnalisiLive } from "@/lib/analisi-live/prompt";
import { riconcilia } from "@/lib/analisi-live/riconciliazione";
import {
  AnalisiAstaLiveSchema,
  type AnalisiAstaLive,
  type FaseAsta,
  type StatoAsta,
  type SvolgimentoAsta,
} from "@/lib/analisi-live/schemas";
import { validaStatoAsta } from "@/lib/analisi-live/valida";
import { importaRisposta } from "@/lib/ai/importa";
import { reduceBoard } from "@/lib/asta/reducer";
import { getBoard, getListone, getSetup, getStrategy, putAnalisiLive, updateStrategy } from "@/lib/blob/repository";
import type { Ruolo, StrategyDoc } from "@/lib/blob/schemas";

// Duplicato da src/lib/actions/strategia.ts (non esportabile da lì: un file
// "use server" può esportare solo funzioni async, vedi il commento in quel
// file). È solo il fallback per updateStrategy quando non esiste ancora una
// StrategyDoc per questa asta.
const STRATEGY_FALLBACK_VUOTO: Omit<StrategyDoc, "astaId"> = {
  fasce: [],
  budgetReparto: { P: 0, D: 0, C: 0, A: 0 },
  slotObiettivi: [],
  prezziMassimi: [],
  tettoSpesaEuro: null,
  template: null,
  sintesiIA: null,
  updatedAt: 0,
};

// Ponte IA manuale (§ Analisi decisione live nel PLAN.md) applicato al modulo
// Analisi Asta Live: stessa convenzione di src/lib/actions/strategia.ts e
// dossier.ts — genera il prompt, l'utente lo gira in chat, incolla la
// risposta, viene validata e riconciliata coi numeri esatti. Nessuna
// chiamata API: a differenza di quanto ipotizzato inizialmente nella spec del
// modulo (dove la latenza dell'API era il vincolo dominante), qui si accetta
// il ciclo copia-incolla come per il resto dell'app — vedi DECISIONI.md.

type ContestoAsta = { stato: StatoAsta; registro: ReturnType<typeof costruisciRegistro>; nomiPerId: Record<number, string> };
type EsitoContesto = ({ ok: true } & ContestoAsta) | { ok: false; error: string };

async function caricaContesto(astaId: string, fase: FaseAsta, svolgimento?: SvolgimentoAsta): Promise<EsitoContesto> {
  const setup = await getSetup(astaId);
  if (!setup) return { ok: false, error: "Asta non trovata." };

  const [listone, board, strategy] = await Promise.all([
    getListone(setup.data.stagione, setup.data.listoneVersionId),
    getBoard(astaId),
    getStrategy(astaId),
  ]);

  const giocatori = listone?.data.giocatori ?? [];
  if (giocatori.length === 0) {
    return { ok: false, error: `Nessun listone importato per la stagione "${setup.data.stagione}".` };
  }

  const ruoloPerGiocatore = Object.fromEntries(giocatori.map((g) => [g.id, g.ruolo])) as Record<number, Ruolo>;
  const astaState = reduceBoard(board?.data.events ?? [], setup.data, ruoloPerGiocatore);

  const { stato, registro: registroGrezzo } = statoAstaDaBlob({
    setup: setup.data,
    giocatori,
    astaState,
    strategy: strategy?.data ?? null,
    fase,
    svolgimento,
  });
  const registro = costruisciRegistro(registroGrezzo);

  const mancanti = playerIdMancantiDalRegistro(stato, registro);
  if (mancanti.length > 0) {
    return { ok: false, error: `Giocatori in rosa non trovati nel listone: ${mancanti.join(", ")}.` };
  }
  const validazione = validaStatoAsta(stato, registro);
  if (!validazione.ok) return { ok: false, error: validazione.errore };

  const nomiPerId = Object.fromEntries(giocatori.map((g) => [g.id, g.nome]));
  return { ok: true, stato, registro, nomiPerId };
}

export type EsitoPromptAnalisiLive = { ok: true; prompt: string } | { ok: false; error: string };

export async function generaPromptAnalisiLive(
  astaId: string,
  fase: FaseAsta,
  svolgimento?: SvolgimentoAsta,
): Promise<EsitoPromptAnalisiLive> {
  const contesto = await caricaContesto(astaId, fase, svolgimento);
  if (!contesto.ok) return contesto;

  const metriche = calcolaMetriche(contesto.stato, contesto.registro);
  // Fire-and-forget: alimenta lo storico per scripts/analisi-live/calibra.ts (§10).
  void registraStatoAsta(contesto.stato, [...contesto.registro.values()]);

  return { ok: true, prompt: costruisciPromptAnalisiLive(contesto.stato, metriche, contesto.registro) };
}

export type EsitoApplicaAnalisiLive =
  | { ok: true; analisi: AnalisiAstaLive; nomiPerId: Record<number, string> }
  | { ok: false; error: string };

/**
 * Valida il JSON incollato dall'utente e lo riconcilia [D] coi numeri esatti
 * del motore deterministico — stessa garanzia con o senza API: se la chat ha
 * allucinato un numero, viene sovrascritto qui, non prima. Il risultato viene
 * salvato su Blob (aste/{astaId}/analisi-live.json): riaprendo la pagina lo
 * si ritrova senza dover reincollare la risposta.
 */
export async function applicaAnalisiLive(
  astaId: string,
  fase: FaseAsta,
  testoIncollato: string,
  svolgimento?: SvolgimentoAsta,
): Promise<EsitoApplicaAnalisiLive> {
  const risultato = importaRisposta(testoIncollato, AnalisiAstaLiveSchema);
  if (!risultato.ok) return { ok: false, error: risultato.errore };

  const contesto = await caricaContesto(astaId, fase, svolgimento);
  if (!contesto.ok) return contesto;

  const metriche = calcolaMetriche(contesto.stato, contesto.registro);
  const analisi = riconcilia(risultato.data, contesto.stato, metriche, contesto.registro, null);

  await putAnalisiLive({ astaId, fase, analisi, updatedAt: Date.now() });

  return { ok: true, analisi, nomiPerId: contesto.nomiPerId };
}

export type EsitoApplicaPiano = { ok: true } | { ok: false; error: string };

/**
 * Applica al piano SOLO i campi concreti e azionabili di `pianoAggiornato`:
 * prezzi massimi (upsert per playerId, origine "ia" — stessa convenzione di
 * applicaStrategiaGenerata) e obiettivi di slot (upsert per ruolo+indiceSlot).
 *
 * Non tocca `budgetReparto`: `pianoAggiornato.budgetResiduoReparto` è il
 * budget RESIDUO sui reparti ancora aperti (§4.5 del motore), un concetto
 * diverso da `StrategyDoc.budgetReparto` (la ripartizione ORIGINALE
 * dell'intero budget di lega, usata per il ricalcolo automatico delle
 * percentuali in fase di preparazione — vedi src/lib/strategia/budget.ts).
 * Scriverci sopra il residuo perderebbe silenziosamente il piano originale.
 */
export async function applicaPianoAllaStrategia(astaId: string, analisi: AnalisiAstaLive): Promise<EsitoApplicaPiano> {
  const parsed = AnalisiAstaLiveSchema.safeParse(analisi);
  if (!parsed.success) return { ok: false, error: "Analisi non valida." };
  const { pianoAggiornato } = parsed.data;

  try {
    await updateStrategy(astaId, { astaId, ...STRATEGY_FALLBACK_VUOTO }, (current) => {
      const prezziPerId = new Map(current.prezziMassimi.map((p) => [p.playerId, p]));
      for (const p of pianoAggiornato.prezziMassimiAggiornati) {
        prezziPerId.set(p.playerId, { playerId: p.playerId, valore: p.valore, origine: "ia" as const });
      }

      const slotPerChiave = new Map(current.slotObiettivi.map((s) => [`${s.ruolo}#${s.indiceSlot}`, s]));
      for (const s of pianoAggiornato.slotObiettiviAggiornati) {
        slotPerChiave.set(`${s.ruolo}#${s.indiceSlot}`, {
          ruolo: s.ruolo,
          indiceSlot: s.indiceSlot,
          obiettivoPrincipale: s.obiettivoPrincipale,
          alternative: s.alternative,
        });
      }

      return {
        ...current,
        prezziMassimi: [...prezziPerId.values()],
        slotObiettivi: [...slotPerChiave.values()],
        updatedAt: Date.now(),
      };
    });
  } catch {
    return { ok: false, error: "Impossibile applicare il piano alla strategia." };
  }

  return { ok: true };
}
