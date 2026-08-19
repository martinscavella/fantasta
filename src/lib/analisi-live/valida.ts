import { RUOLI, type RegistroGiocatori } from "@/lib/analisi-live/motore";
import { StatoAstaSchema, type StatoAsta } from "@/lib/analisi-live/schemas";

// §8 della spec — validazioni da eseguire PRIMA di chiamare il modello, così
// un input corrotto non arriva mai al motore deterministico (che assume dati
// coerenti) né brucia una chiamata API inutile.

export type EsitoValidazione = { ok: true; stato: StatoAsta } | { ok: false; status: 400; errore: string };

function contaOccupatiGrezzo(rosa: { playerId: number }[], registro: RegistroGiocatori) {
  const conteggio: Record<string, number> = { P: 0, D: 0, C: 0, A: 0 };
  for (const riga of rosa) {
    const info = registro.get(riga.playerId);
    if (info) conteggio[info.ruolo]++;
  }
  return conteggio;
}

/**
 * Valida lo schema JSON e le regole di business di §8: rose con più giocatori
 * dei slot consentiti in un ruolo (I10), sforamento di budget quando la lega è
 * a budget chiuso, e playerId di rosa assenti dal registro passato dal
 * chiamante (vedi motore.ts — il registro non fa parte del contratto JSON).
 */
export function validaStatoAsta(input: unknown, registro: RegistroGiocatori): EsitoValidazione {
  const parsed = StatoAstaSchema.safeParse(input);
  if (!parsed.success) {
    const primo = parsed.error.issues[0];
    const path = primo.path.join(".");
    return { ok: false, status: 400, errore: path ? `Campo non valido: "${path}" — ${primo.message}` : primo.message };
  }
  const stato = parsed.data;

  const squadre = [stato.miaSquadra, ...stato.avversari];
  for (const squadra of squadre) {
    for (const riga of squadra.rosa) {
      if (!registro.has(riga.playerId)) {
        return {
          ok: false,
          status: 400,
          errore: `Il giocatore ${riga.playerId} nella rosa di "${squadra.nome}" non è presente nel listone: impossibile determinarne ruolo e club.`,
        };
      }
    }

    const occupati = contaOccupatiGrezzo(squadra.rosa, registro);
    for (const ruolo of RUOLI) {
      if (occupati[ruolo] > stato.lega.slot[ruolo]) {
        return {
          ok: false,
          status: 400,
          errore: `La squadra "${squadra.nome}" ha più giocatori del consentito nel ruolo ${ruolo} (${occupati[ruolo]} su ${stato.lega.slot[ruolo]} slot).`,
        };
      }
    }

    // Lo sforamento di budget è ammesso di proposito in modalità sforo
    // (budgetChiuso: false) — vedi § Modalità sforo nel PLAN.md del progetto.
    // Il contratto di questo modulo non porta il tasso €/credito: qui si
    // verifica solo la coerenza dei crediti, non la componente in euro.
    if (stato.lega.budgetChiuso) {
      const creditiSpesi = squadra.rosa.reduce((tot, r) => tot + r.prezzoPagato, 0);
      if (creditiSpesi > stato.lega.budget) {
        return {
          ok: false,
          status: 400,
          errore: `La squadra "${squadra.nome}" ha speso ${creditiSpesi} crediti, ${creditiSpesi - stato.lega.budget} oltre il budget di ${stato.lega.budget} in una lega a budget chiuso.`,
        };
      }
    }
  }

  return { ok: true, stato };
}
