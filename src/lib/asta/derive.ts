import type { AstaState } from "@/lib/asta/reducer";
import type { Player, Ruolo, SetupDoc } from "@/lib/blob/schemas";

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
