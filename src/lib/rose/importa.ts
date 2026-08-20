import { randomUUID } from "node:crypto";
import { reduceBoard } from "@/lib/asta/reducer";
import type { BoardEvent, Player, Ruolo, SetupDoc } from "@/lib/blob/schemas";
import type { RoseImportate } from "@/lib/rose/parser-fantaleghe";

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];

function contaPerRuolo(): Record<Ruolo, number> {
  return { P: 0, D: 0, C: 0, A: 0 };
}

export type RiepilogoSquadra = {
  // Nome come appare nel file: è la chiave con cui il setup provvisorio è
  // stato costruito, ed è quello che la UI mostra.
  nome: string;
  teamId: string;
  giocatori: number;
  totaleSpeso: number;
  conteggioPerRuolo: Record<Ruolo, number>;
  sforoCrediti: number;
  sforoEuro: number | null;
};

export type ProblemaImport =
  | { tipo: "giocatore-sconosciuto"; playerId: number; squadra: string }
  | { tipo: "giocatore-duplicato"; playerId: number; nome: string; squadre: string[] }
  | { tipo: "budget-superato"; squadra: string; speso: number; budget: number }
  | { tipo: "slot-superato"; squadra: string; ruolo: Ruolo; conteggio: number; slot: number };

export type AnteprimaRose = {
  squadre: RiepilogoSquadra[];
  problemi: ProblemaImport[];
  eventi: BoardEvent[];
  // Quanti degli `eventi` sopravvivono davvero al reducer di produzione.
  eventiApplicati: number;
  righeSaltate: number;
  // Valori minimi compatibili col file: crediti base che non fa scartare
  // nessuna squadra, e slot per ruolo che reggono la rosa più capiente.
  creditiBaseMinimo: number;
  slotMinimi: Record<Ruolo, number>;
};

/**
 * Problemi che indicano una configurazione sbagliata (crediti/slot), non un
 * file sbagliato: sono correggibili nel form, quindi bloccano l'import invece
 * di far perdere righe in silenzio.
 */
export function problemiBloccanti(problemi: ProblemaImport[]): ProblemaImport[] {
  return problemi.filter((p) => p.tipo === "budget-superato" || p.tipo === "slot-superato");
}

/**
 * Problemi nei dati del file (id fuori listone, giocatore in due rose): non si
 * risolvono cambiando le impostazioni, quindi l'import passa solo con una
 * conferma esplicita che accetta di scartare quelle righe.
 */
export function problemiDaConfermare(problemi: ProblemaImport[]): ProblemaImport[] {
  return problemi.filter(
    (p) => p.tipo === "giocatore-sconosciuto" || p.tipo === "giocatore-duplicato",
  );
}

/**
 * Traduce le righe del file negli `ASSIGN` che verrebbero scritti su
 * board.json e ne verifica la compatibilità col regolamento scelto.
 *
 * `setup` è il documento *provvisorio* costruito dai valori del form: le sue
 * `squadre` devono avere gli stessi `nome` che compaiono nel file (è il
 * chiamante a costruirle da `rose.squadre`), perché l'abbinamento riga →
 * squadra passa da lì.
 *
 * Il conteggio `eventiApplicati` non è ricalcolato a mano: si fa girare
 * `reduceBoard`, lo stesso reducer che poi alimenta Tracker e Riepilogo. È
 * l'unico modo perché l'anteprima non possa divergere da ciò che l'app mostra
 * dopo l'import — il reducer scarta in silenzio gli ASSIGN che sforano budget
 * o slot, e senza questo confronto l'import sembrerebbe riuscito.
 *
 * Le righe con un id fuori dal listone non diventano eventi e non entrano nei
 * totali per squadra: così `creditiBaseMinimo` resta coerente con ciò che
 * verrà davvero scritto, invece di gonfiarsi per righe che l'app scarterà.
 */
export function costruisciAnteprima(
  rose: RoseImportate,
  giocatori: Player[],
  setup: SetupDoc,
): AnteprimaRose {
  const giocatoriPerId = new Map(giocatori.map((g) => [g.id, g]));
  const ruoloPerGiocatore = Object.fromEntries(giocatori.map((g) => [g.id, g.ruolo])) as Record<number, Ruolo>;
  const teamIdPerNome = new Map(setup.squadre.map((s) => [s.nome, s.id]));

  const problemi: ProblemaImport[] = [];
  const eventi: BoardEvent[] = [];
  const squadrePerPlayerId = new Map<number, string[]>();
  const aggregati = new Map<string, { totale: number; ruoli: Record<Ruolo, number>; giocatori: number }>();
  for (const nome of rose.squadre) {
    aggregati.set(nome, { totale: 0, ruoli: contaPerRuolo(), giocatori: 0 });
  }

  // ts sintetico: il file non porta orari, ma l'ordine delle righe è l'ordine
  // in cui l'asta si è svolta. Un incremento per riga lo preserva ed evita
  // pareggi su ts, su cui il sort del reducer non darebbe garanzie.
  const baseTs = Date.now();

  rose.righe.forEach((riga, i) => {
    const player = giocatoriPerId.get(riga.playerId);
    if (!player) {
      problemi.push({ tipo: "giocatore-sconosciuto", playerId: riga.playerId, squadra: riga.squadra });
      return;
    }
    const teamId = teamIdPerNome.get(riga.squadra);
    if (!teamId) return;

    squadrePerPlayerId.set(riga.playerId, [...(squadrePerPlayerId.get(riga.playerId) ?? []), riga.squadra]);

    const aggregato = aggregati.get(riga.squadra);
    if (aggregato) {
      aggregato.totale += riga.prezzo;
      aggregato.ruoli[player.ruolo]++;
      aggregato.giocatori++;
    }

    eventi.push({
      id: randomUUID(),
      ts: baseTs + i,
      type: "ASSIGN",
      playerId: riga.playerId,
      teamId,
      price: riga.prezzo,
    });
  });

  for (const [playerId, squadre] of squadrePerPlayerId) {
    if (squadre.length < 2) continue;
    problemi.push({
      tipo: "giocatore-duplicato",
      playerId,
      nome: giocatoriPerId.get(playerId)?.nome ?? String(playerId),
      squadre: [...new Set(squadre)],
    });
  }

  const { sforo } = setup;
  const squadre: RiepilogoSquadra[] = rose.squadre.map((nome) => {
    const aggregato = aggregati.get(nome) ?? { totale: 0, ruoli: contaPerRuolo(), giocatori: 0 };
    const sforoCrediti = Math.max(0, aggregato.totale - setup.creditiBase);

    if (sforo.tipo === "nessuno" && aggregato.totale > setup.creditiBase) {
      problemi.push({
        tipo: "budget-superato",
        squadra: nome,
        speso: aggregato.totale,
        budget: setup.creditiBase,
      });
    }
    for (const ruolo of RUOLI) {
      if (aggregato.ruoli[ruolo] > setup.slot[ruolo]) {
        problemi.push({
          tipo: "slot-superato",
          squadra: nome,
          ruolo,
          conteggio: aggregato.ruoli[ruolo],
          slot: setup.slot[ruolo],
        });
      }
    }

    return {
      nome,
      teamId: teamIdPerNome.get(nome) ?? "",
      giocatori: aggregato.giocatori,
      totaleSpeso: aggregato.totale,
      conteggioPerRuolo: aggregato.ruoli,
      sforoCrediti,
      sforoEuro: sforo.tipo === "a-pagamento" ? sforoCrediti * sforo.euroPerCredito : null,
    };
  });

  const slotMinimi = contaPerRuolo();
  for (const s of squadre) {
    for (const ruolo of RUOLI) {
      slotMinimi[ruolo] = Math.max(slotMinimi[ruolo], s.conteggioPerRuolo[ruolo]);
    }
  }

  const stato = reduceBoard(eventi, setup, ruoloPerGiocatore);

  return {
    squadre,
    problemi,
    eventi,
    eventiApplicati: Object.keys(stato.assegnazioni).length,
    righeSaltate: rose.righeSaltate,
    creditiBaseMinimo: squadre.reduce((max, s) => Math.max(max, s.totaleSpeso), 0),
    slotMinimi,
  };
}
