import type { BoardEvent, Ruolo, SetupDoc } from "@/lib/blob/schemas";

export type Assegnazione = {
  playerId: number;
  teamId: string;
  price: number;
};

// Chiave = id dell'evento ASSIGN originario: UNDO ed EDIT successivi si
// riferiscono sempre a quell'id, anche dopo una modifica (vedi board.json
// event log nel piano). Una entry presente = assegnazione attiva.
export type AstaState = {
  assegnazioni: Record<string, Assegnazione>;
};

const STATO_VUOTO: AstaState = { assegnazioni: {} };

function assegnazioniSquadra(state: AstaState, teamId: string, escludiEventId?: string) {
  return Object.entries(state.assegnazioni)
    .filter(([eventId, a]) => a.teamId === teamId && eventId !== escludiEventId)
    .map(([, a]) => a);
}

function creditiSpesi(state: AstaState, teamId: string, escludiEventId?: string): number {
  return assegnazioniSquadra(state, teamId, escludiEventId).reduce((tot, a) => tot + a.price, 0);
}

function contaRuolo(
  state: AstaState,
  teamId: string,
  ruolo: Ruolo,
  ruoloPerGiocatore: Record<number, Ruolo>,
  escludiEventId?: string,
): number {
  return assegnazioniSquadra(state, teamId, escludiEventId).filter(
    (a) => ruoloPerGiocatore[a.playerId] === ruolo,
  ).length;
}

function giaAssegnato(state: AstaState, playerId: number, escludiEventId?: string): boolean {
  return Object.entries(state.assegnazioni).some(
    ([eventId, a]) => a.playerId === playerId && eventId !== escludiEventId,
  );
}

/**
 * Applica un singolo evento allo stato. Un evento non valido (giocatore già
 * assegnato, slot pieno, budget superato in modalità non-sforo, target
 * inesistente per UNDO/EDIT) non ha effetto — non lancia mai, per poter
 * ripiegare su un log storico senza interrompere il fold (vedi board.json
 * come event log nel piano: gli eventi non si riscrivono mai).
 */
function applicaEvento(
  state: AstaState,
  event: BoardEvent,
  setup: SetupDoc,
  ruoloPerGiocatore: Record<number, Ruolo>,
): AstaState {
  switch (event.type) {
    case "ASSIGN": {
      if (!setup.squadre.some((s) => s.id === event.teamId)) return state;
      if (giaAssegnato(state, event.playerId)) return state;

      const ruolo = ruoloPerGiocatore[event.playerId];
      if (!ruolo) return state;

      const occupati = contaRuolo(state, event.teamId, ruolo, ruoloPerGiocatore);
      if (occupati >= setup.slot[ruolo]) return state;

      if (setup.sforo.tipo === "nessuno") {
        const spesa = creditiSpesi(state, event.teamId);
        if (spesa + event.price > setup.creditiBase) return state;
      }

      return {
        assegnazioni: {
          ...state.assegnazioni,
          [event.id]: { playerId: event.playerId, teamId: event.teamId, price: event.price },
        },
      };
    }

    case "UNDO": {
      if (!(event.targetEventId in state.assegnazioni)) return state;
      const resto = Object.fromEntries(
        Object.entries(state.assegnazioni).filter(([eventId]) => eventId !== event.targetEventId),
      );
      return { assegnazioni: resto };
    }

    case "EDIT": {
      const target = state.assegnazioni[event.targetEventId];
      if (!target) return state;

      const nuovoTeamId = event.teamId ?? target.teamId;
      const nuovoPrice = event.price ?? target.price;
      if (!setup.squadre.some((s) => s.id === nuovoTeamId)) return state;

      const ruolo = ruoloPerGiocatore[target.playerId];
      if (!ruolo) return state;

      // Ricalcola slot/budget della squadra di destinazione escludendo questa
      // stessa assegnazione dal computo corrente (altrimenti si conterebbe due volte).
      const occupati = contaRuolo(state, nuovoTeamId, ruolo, ruoloPerGiocatore, event.targetEventId);
      if (occupati >= setup.slot[ruolo]) return state;

      if (setup.sforo.tipo === "nessuno") {
        const spesa = creditiSpesi(state, nuovoTeamId, event.targetEventId);
        if (spesa + nuovoPrice > setup.creditiBase) return state;
      }

      return {
        assegnazioni: {
          ...state.assegnazioni,
          [event.targetEventId]: { playerId: target.playerId, teamId: nuovoTeamId, price: nuovoPrice },
        },
      };
    }
  }
}

export function reduceBoard(
  events: BoardEvent[],
  setup: SetupDoc,
  ruoloPerGiocatore: Record<number, Ruolo>,
): AstaState {
  const eventiOrdinati = [...events].sort((a, b) => a.ts - b.ts);
  return eventiOrdinati.reduce(
    (state, event) => applicaEvento(state, event, setup, ruoloPerGiocatore),
    STATO_VUOTO,
  );
}
