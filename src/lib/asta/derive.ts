import type { AstaState } from "@/lib/asta/reducer";
import { inflazioneOsservata, inflazioneTeorica, type AcquistoConcluso } from "@/lib/pricing";
import type { BoardEvent, Player, Ruolo, SetupDoc, Squadra } from "@/lib/blob/schemas";

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];

function contaPerRuolo(): Record<Ruolo, number> {
  return { P: 0, D: 0, C: 0, A: 0 };
}

export type StatoSquadraDerivato = {
  teamId: string;
  nome: string;
  creditiSpesi: number;
  // Può essere negativo in modalità sforo — è il punto (vedi § Modalità sforo).
  creditiResidui: number;
  slotOccupati: Record<Ruolo, number>;
  slotResidui: Record<Ruolo, number>;
  slotResiduiTotali: number;
  rosaCompleta: boolean;
  // null quando lo sforo è attivo: il tetto in crediti non esiste più, vedi piano.
  massimaOfferta: number | null;
  sforoCrediti: number;
  sforoEuro: number | null;
  // Un ruolo è "obbligato" quando gli slot ancora da riempire di quel ruolo
  // eguagliano (o superano) i giocatori liberi rimasti nell'intero listone:
  // la squadra non ha più margine di scelta su quel reparto.
  obbligoPerRuolo: Record<Ruolo, boolean>;
};

export function giocatoriLiberiPerRuolo(state: AstaState, giocatori: Player[]): Record<Ruolo, number> {
  const assegnati = new Set(Object.values(state.assegnazioni).map((a) => a.playerId));
  const liberi = contaPerRuolo();
  for (const g of giocatori) {
    if (!assegnati.has(g.id)) liberi[g.ruolo]++;
  }
  return liberi;
}

export function derivaSquadre(state: AstaState, setup: SetupDoc, giocatori: Player[]): StatoSquadraDerivato[] {
  const ruoloPerGiocatore: Record<number, Ruolo> = Object.fromEntries(giocatori.map((g) => [g.id, g.ruolo]));
  const liberiPerRuolo = giocatoriLiberiPerRuolo(state, giocatori);

  return setup.squadre.map((squadra) => {
    const assegnazioni = Object.values(state.assegnazioni).filter((a) => a.teamId === squadra.id);

    const slotOccupati = contaPerRuolo();
    for (const a of assegnazioni) {
      const ruolo = ruoloPerGiocatore[a.playerId];
      if (ruolo) slotOccupati[ruolo]++;
    }

    const slotResidui = contaPerRuolo();
    const obbligoPerRuolo = {} as Record<Ruolo, boolean>;
    let slotResiduiTotali = 0;
    for (const ruolo of RUOLI) {
      const residui = Math.max(0, setup.slot[ruolo] - slotOccupati[ruolo]);
      slotResidui[ruolo] = residui;
      slotResiduiTotali += residui;
      obbligoPerRuolo[ruolo] = residui > 0 && residui >= liberiPerRuolo[ruolo];
    }

    const creditiSpesi = assegnazioni.reduce((tot, a) => tot + a.price, 0);
    const creditiResidui = setup.creditiBase - creditiSpesi;
    const { sforo } = setup;
    const sforoCrediti = Math.max(0, creditiSpesi - setup.creditiBase);

    return {
      teamId: squadra.id,
      nome: squadra.nome,
      creditiSpesi,
      creditiResidui,
      slotOccupati,
      slotResidui,
      slotResiduiTotali,
      rosaCompleta: slotResiduiTotali === 0,
      // Caso limite: con un solo slot residuo (slotResiduiTotali === 1) l'offerta
      // massima è l'intero credito residuo (crediti - 0), non crediti - 1. A rosa
      // completa (0 slot residui) nessun ulteriore acquisto è ammesso: 0, non la
      // formula "a vuoto" che darebbe l'intero credito residuo.
      massimaOfferta:
        sforo.tipo === "a-pagamento"
          ? null
          : slotResiduiTotali === 0
            ? 0
            : Math.max(0, creditiResidui - (slotResiduiTotali - 1)),
      sforoCrediti,
      sforoEuro: sforo.tipo === "a-pagamento" ? sforoCrediti * sforo.euroPerCredito : null,
      obbligoPerRuolo,
    };
  });
}

export type RigaRosa = { player: Player; price: number; eventId: string };

/**
 * Rosa di ogni squadra a partire dallo stato derivato dell'asta — estratta da
 * `AstaClient` (dove viveva inline) perché ora serve anche al Riepilogo
 * post-asta (§ Post-asta nel piano), non solo al tracker.
 */
export function costruisciRose(state: AstaState, giocatori: Player[], squadre: Squadra[]): Record<string, RigaRosa[]> {
  const giocatoriPerId = new Map(giocatori.map((g) => [g.id, g]));
  const risultato: Record<string, RigaRosa[]> = {};
  for (const squadra of squadre) risultato[squadra.id] = [];
  for (const [eventId, a] of Object.entries(state.assegnazioni)) {
    const player = giocatoriPerId.get(a.playerId);
    if (!player) continue;
    (risultato[a.teamId] ??= []).push({ player, price: a.price, eventId });
  }
  return risultato;
}

export type InflazioneCorrente = {
  // null a sforo (la formula "si rompe", vedi § Modalità sforo nel piano) o a fine asta.
  teorica: number | null;
  // null finché non c'è almeno un acquisto concluso.
  osservata: number | null;
  // Quella da usare per il prezzo reattivo: teorica quando applicabile (budget
  // chiuso), altrimenti osservata — coincide con "osservata" a sforo.
  effettiva: number | null;
};

/**
 * Inflazione corrente della lega, dedotta dallo stato dell'asta. `events`
 * serve solo per il ts degli ASSIGN (necessario per pesare verso i più
 * recenti in inflazioneOsservata) — AstaState non lo conserva.
 */
export function derivaInflazione(
  state: AstaState,
  setup: SetupDoc,
  giocatori: Player[],
  events: BoardEvent[],
): InflazioneCorrente {
  const assegnatiIds = new Set(Object.values(state.assegnazioni).map((a) => a.playerId));
  const giocatoriLiberi = giocatori.filter((g) => !assegnatiIds.has(g.id));
  const giocatoriPerId = new Map(giocatori.map((g) => [g.id, g]));
  const tsPerAssign = new Map(events.filter((e) => e.type === "ASSIGN").map((e) => [e.id, e.ts]));

  const acquisti: AcquistoConcluso[] = Object.entries(state.assegnazioni).flatMap(([eventId, a]) => {
    const player = giocatoriPerId.get(a.playerId);
    const ts = tsPerAssign.get(eventId);
    if (!player || ts === undefined) return [];
    return [{ prezzoPagato: a.price, quotazione: player.quotazioneAttuale, ts }];
  });

  const osservata = inflazioneOsservata(acquisti);

  let teorica: number | null = null;
  if (setup.sforo.tipo === "nessuno") {
    const squadre = derivaSquadre(state, setup, giocatori);
    const creditiResiduiLega = squadre.reduce((tot, s) => tot + s.creditiResidui, 0);
    teorica = inflazioneTeorica(creditiResiduiLega, giocatoriLiberi);
  }

  return { teorica, osservata, effettiva: teorica ?? osservata };
}
