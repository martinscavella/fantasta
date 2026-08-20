import { describe, expect, it } from "vitest";
import { costruisciAnteprima, problemiBloccanti, problemiDaConfermare } from "@/lib/rose/importa";
import type { RoseImportate } from "@/lib/rose/parser-fantaleghe";
import type { Player, RegoleSforo, Ruolo, SetupDoc, SlotPerRuolo } from "@/lib/blob/schemas";

function player(id: number, ruolo: Ruolo): Player {
  return { id, nome: `Giocatore ${id}`, squadra: "Club", ruolo, quotazioneAttuale: 10, quotazioneIniziale: 10 };
}

// Listone di comodo: 40 giocatori per ruolo, id 100+ per i P, 200+ per i D, ecc.
const BASE_PER_RUOLO: Record<Ruolo, number> = { P: 100, D: 200, C: 300, A: 400 };
const LISTONE: Player[] = (["P", "D", "C", "A"] as Ruolo[]).flatMap((ruolo) =>
  Array.from({ length: 40 }, (_, i) => player(BASE_PER_RUOLO[ruolo] + i, ruolo)),
);

function setup(
  nomiSquadre: string[],
  opzioni: { creditiBase?: number; slot?: SlotPerRuolo; sforo?: RegoleSforo } = {},
): SetupDoc {
  return {
    id: "asta-1",
    nome: "Lega di prova",
    stagione: "2026-27",
    listoneVersionId: "v1",
    modalita: "classic",
    creditiBase: opzioni.creditiBase ?? 1000,
    slot: opzioni.slot ?? { P: 3, D: 8, C: 8, A: 6 },
    squadre: nomiSquadre.map((nome, i) => ({ id: `team-${i}`, nome })),
    miaSquadraId: "team-0",
    sforo: opzioni.sforo ?? { tipo: "nessuno" },
    createdAt: 0,
  };
}

/**
 * Rosa regolamentare da 25 giocatori (3 P, 8 D, 8 C, 6 A) per un totale dato.
 * `offset` sposta la finestra di id: due squadre della stessa anteprima devono
 * pescare giocatori diversi, o risulterebbero tutti duplicati.
 */
function rosaCompleta(squadra: string, totale: number, offset = 0): RoseImportate["righe"] {
  const conteggi: [Ruolo, number][] = [
    ["P", 3],
    ["D", 8],
    ["C", 8],
    ["A", 6],
  ];
  const righe: RoseImportate["righe"] = [];
  for (const [ruolo, quanti] of conteggi) {
    for (let i = 0; i < quanti; i++) {
      righe.push({ squadra, playerId: BASE_PER_RUOLO[ruolo] + offset + i, prezzo: 1 });
    }
  }
  // Il resto del budget finisce tutto sull'ultimo acquisto.
  righe[righe.length - 1].prezzo = totale - (righe.length - 1);
  return righe;
}

function rose(righe: RoseImportate["righe"], righeSaltate = 0): RoseImportate {
  return { squadre: [...new Set(righe.map((r) => r.squadra))], righe, righeSaltate };
}

describe("costruisciAnteprima", () => {
  it("traduce ogni riga in un ASSIGN quando tutto torna", () => {
    const righe = [
      { squadra: "Alfa", playerId: 100, prezzo: 30 },
      { squadra: "Alfa", playerId: 200, prezzo: 20 },
      { squadra: "Beta", playerId: 101, prezzo: 50 },
    ];
    const anteprima = costruisciAnteprima(rose(righe), LISTONE, setup(["Alfa", "Beta"]));

    expect(anteprima.problemi).toEqual([]);
    expect(anteprima.eventi).toHaveLength(3);
    expect(anteprima.eventiApplicati).toBe(3);
    expect(anteprima.eventi.every((e) => e.type === "ASSIGN")).toBe(true);
    expect(new Set(anteprima.eventi.map((e) => e.id)).size).toBe(3);
  });

  it("preserva l'ordine del file in ts strettamente crescenti", () => {
    const righe = Array.from({ length: 5 }, (_, i) => ({ squadra: "Alfa", playerId: 200 + i, prezzo: 1 }));
    const { eventi } = costruisciAnteprima(rose(righe), LISTONE, setup(["Alfa"]));

    const ts = eventi.map((e) => e.ts);
    expect(ts).toEqual([...ts].sort((a, b) => a - b));
    expect(new Set(ts).size).toBe(ts.length);
  });

  it("riporta gli id fuori listone e li tiene fuori da eventi e totali", () => {
    const righe = [
      { squadra: "Alfa", playerId: 100, prezzo: 30 },
      { squadra: "Alfa", playerId: 999999, prezzo: 40 },
    ];
    const anteprima = costruisciAnteprima(rose(righe), LISTONE, setup(["Alfa"]));

    expect(anteprima.problemi).toEqual([{ tipo: "giocatore-sconosciuto", playerId: 999999, squadra: "Alfa" }]);
    expect(anteprima.eventi).toHaveLength(1);
    expect(anteprima.eventiApplicati).toBe(1);
    expect(anteprima.squadre[0].totaleSpeso).toBe(30);
    expect(anteprima.creditiBaseMinimo).toBe(30);
  });

  it("segnala un giocatore comparso in due rose e ne applica solo il primo", () => {
    const righe = [
      { squadra: "Alfa", playerId: 100, prezzo: 30 },
      { squadra: "Beta", playerId: 100, prezzo: 45 },
    ];
    const anteprima = costruisciAnteprima(rose(righe), LISTONE, setup(["Alfa", "Beta"]));

    expect(anteprima.problemi).toContainEqual({
      tipo: "giocatore-duplicato",
      playerId: 100,
      nome: "Giocatore 100",
      squadre: ["Alfa", "Beta"],
    });
    expect(anteprima.eventi).toHaveLength(2);
    expect(anteprima.eventiApplicati).toBe(1);
  });

  it("a budget chiuso segnala lo sforamento E il fatto che il reducer scarterebbe righe", () => {
    const anteprima = costruisciAnteprima(
      rose(rosaCompleta("Alfa", 1091)),
      LISTONE,
      setup(["Alfa"], { creditiBase: 1000, sforo: { tipo: "nessuno" } }),
    );

    expect(anteprima.problemi).toContainEqual({
      tipo: "budget-superato",
      squadra: "Alfa",
      speso: 1091,
      budget: 1000,
    });
    // È il caso che senza anteprima passerebbe inosservato: l'import
    // sembrerebbe riuscito e il Riepilogo mostrerebbe una rosa incompleta.
    expect(anteprima.eventiApplicati).toBeLessThan(anteprima.eventi.length);
    expect(problemiBloccanti(anteprima.problemi)).toHaveLength(1);
  });

  it("a sforo lo stesso file passa intero e quantifica crediti ed euro", () => {
    const anteprima = costruisciAnteprima(
      rose(rosaCompleta("Alfa", 1091)),
      LISTONE,
      setup(["Alfa"], { creditiBase: 1000, sforo: { tipo: "a-pagamento", euroPerCredito: 0.1 } }),
    );

    expect(anteprima.problemi).toEqual([]);
    expect(anteprima.eventiApplicati).toBe(25);
    expect(anteprima.squadre[0].sforoCrediti).toBe(91);
    expect(anteprima.squadre[0].sforoEuro).toBeCloseTo(9.1);
  });

  it("non segnala sforo quando la spesa eguaglia esattamente il budget", () => {
    const anteprima = costruisciAnteprima(
      rose(rosaCompleta("Alfa", 1000)),
      LISTONE,
      setup(["Alfa"], { creditiBase: 1000, sforo: { tipo: "nessuno" } }),
    );

    expect(anteprima.problemi).toEqual([]);
    expect(anteprima.squadre[0].sforoCrediti).toBe(0);
    expect(anteprima.squadre[0].sforoEuro).toBeNull();
  });

  it("segnala il reparto che non entra negli slot configurati", () => {
    const righe = Array.from({ length: 9 }, (_, i) => ({ squadra: "Alfa", playerId: 200 + i, prezzo: 1 }));
    const anteprima = costruisciAnteprima(rose(righe), LISTONE, setup(["Alfa"], { slot: { P: 3, D: 8, C: 8, A: 6 } }));

    expect(anteprima.problemi).toContainEqual({
      tipo: "slot-superato",
      squadra: "Alfa",
      ruolo: "D",
      conteggio: 9,
      slot: 8,
    });
    expect(anteprima.eventiApplicati).toBe(8);
    expect(problemiBloccanti(anteprima.problemi)).toHaveLength(1);
  });

  it("suggerisce crediti e slot minimi compatibili col file", () => {
    const anteprima = costruisciAnteprima(
      rose([...rosaCompleta("Alfa", 1091), ...rosaCompleta("Beta", 1100, 10)]),
      LISTONE,
      setup(["Alfa", "Beta"], { creditiBase: 1100, sforo: { tipo: "nessuno" } }),
    );

    expect(anteprima.creditiBaseMinimo).toBe(1100);
    expect(anteprima.slotMinimi).toEqual({ P: 3, D: 8, C: 8, A: 6 });
    expect(anteprima.problemi).toEqual([]);
    expect(anteprima.eventiApplicati).toBe(50);
  });

  it("riporta le righe saltate dal parser e distingue i problemi da confermare", () => {
    const righe = [{ squadra: "Alfa", playerId: 999999, prezzo: 40 }];
    const anteprima = costruisciAnteprima(rose(righe, 3), LISTONE, setup(["Alfa"]));

    expect(anteprima.righeSaltate).toBe(3);
    expect(problemiBloccanti(anteprima.problemi)).toHaveLength(0);
    expect(problemiDaConfermare(anteprima.problemi)).toHaveLength(1);
  });
});
