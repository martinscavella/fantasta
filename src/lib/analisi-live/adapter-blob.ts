import type { AstaState } from "@/lib/asta/reducer";
import { costruisciRose } from "@/lib/asta/derive";
import type { GiocatoreInfo } from "@/lib/analisi-live/motore";
import type { FaseAsta, StatoAsta, SvolgimentoAsta } from "@/lib/analisi-live/schemas";
import type { Player, SetupDoc, Squadra, StrategyDoc } from "@/lib/blob/schemas";

// Adapter tra i documenti Blob dell'app (SetupDoc/Player/AstaState/StrategyDoc)
// e il contratto autonomo del modulo Analisi Asta Live (StatoAsta +
// registro giocatori — vedi DECISIONI.md "Il registro giocatori non è nel
// contratto JSON"). Vive fuori da src/lib/analisi-live/ di proposito: è
// l'unico file che conosce ENTRAMBI i mondi, il modulo resta autonomo.

export function registroDaListone(giocatori: Player[]): GiocatoreInfo[] {
  return giocatori.map((g) => ({ id: g.id, ruolo: g.ruolo, nome: g.nome, club: g.squadra, quotazione: g.quotazioneAttuale }));
}

export function statoAstaDaBlob(params: {
  setup: SetupDoc;
  giocatori: Player[];
  astaState: AstaState;
  strategy: StrategyDoc | null;
  fase: FaseAsta;
  svolgimento?: SvolgimentoAsta;
}): { stato: StatoAsta; registro: GiocatoreInfo[] } {
  const { setup, giocatori, astaState, strategy, fase, svolgimento } = params;

  const registro = registroDaListone(giocatori);
  const rose = costruisciRose(astaState, giocatori, setup.squadre);
  const assegnatiIds = new Set(Object.values(astaState.assegnazioni).map((a) => a.playerId));

  const squadraInput = (squadra: Squadra) => ({
    nome: squadra.nome,
    rosa: (rose[squadra.id] ?? []).map((r) => ({ playerId: r.player.id, prezzoPagato: r.price })),
    allenatore: squadra.allenatore,
    squadraDelCuore: squadra.squadraDelCuore,
    note: squadra.note,
  });

  const miaSquadra = setup.squadre.find((s) => s.id === setup.miaSquadraId);
  if (!miaSquadra) {
    throw new Error(`La squadra miaSquadraId (${setup.miaSquadraId}) non è tra le squadre di questa asta.`);
  }

  const listoneDisponibili = giocatori
    .filter((g) => !assegnatiIds.has(g.id))
    .map((g) => ({ id: g.id, ruolo: g.ruolo, nome: g.nome, club: g.squadra, quotazione: g.quotazioneAttuale }));

  // Le regole di punteggio di lega (modificatore difesa, portiere imbattuto...)
  // non sono ancora persistite in nessun documento Blob esistente — vedi
  // DECISIONI.md. `pianoIniziale` resta {} se non è mai stata generata una
  // StrategyDoc: è un campo permissivo (additionalProperties: true).
  const pianoIniziale = strategy
    ? {
        budgetReparto: strategy.budgetReparto,
        prezziMassimi: strategy.prezziMassimi.map((p) => ({ playerId: p.playerId, valore: p.valore })),
        slotObiettivi: strategy.slotObiettivi,
        fasce: strategy.fasce,
        sintesi: strategy.sintesiIA ?? undefined,
      }
    : {};

  const stato: StatoAsta = {
    lega: {
      nSquadre: setup.squadre.length,
      budget: setup.creditiBase,
      slot: setup.slot,
      modalita: "classic",
      budgetChiuso: setup.sforo.tipo === "nessuno",
      svolgimento,
      regolePunteggio: {},
    },
    fase,
    miaSquadra: squadraInput(miaSquadra),
    avversari: setup.squadre.filter((s) => s.id !== setup.miaSquadraId).map(squadraInput),
    listoneDisponibili,
    pianoIniziale,
  };

  return { stato, registro };
}
