import { describe, expect, it } from "vitest";
import {
  autoMapColumns,
  cellToText,
  detectHeaderRow,
  diffListoni,
  mappaCompleta,
  parseCsv,
  parseGiocatori,
  rowsFromXlsx,
  type MappaColonne,
} from "@/lib/listone/parser";
import { buildXlsxFixture } from "@/lib/listone/xlsx-fixture";
import type { Player } from "@/lib/blob/schemas";

// --- fixture xlsx ufficiale, con titolo prima dell'intestazione e foglio Ceduti ---

const HEADER_UFFICIALE = ["Id", "R", "RM", "Nome", "Squadra", "Qt.A", "Qt.I", "Diff.", "FVM", "FVM M"];

function xlsxUfficiale() {
  return buildXlsxFixture([
    {
      nome: "Quotazioni",
      righe: [
        ["Listone Fantacalcio 2026/27"], // intestazione non alla prima riga
        HEADER_UFFICIALE,
        [1, "P", "Por", "Maignan", "Milan", 12, 10, 2, 15, 14],
        [2, "A", "Att", "Lautaro Martinez", "Inter", 28, 30, -2, 32, 30],
        [], // riga vuota
        [3, "D", "Dc", "Bastoni", "Inter", 14, 12, 2, 16, 15],
      ],
    },
    {
      nome: "Ceduti",
      righe: [HEADER_UFFICIALE, [99, "A", "Att", "Giocatore Ceduto", "Ex Squadra", 5, 5, 0, 5, 5]],
    },
  ]);
}

describe("rowsFromXlsx", () => {
  it("legge il foglio principale e ignora il foglio Ceduti", async () => {
    const rows = await rowsFromXlsx(xlsxUfficiale());
    const testoRighe = rows.map((r) => r.map((c) => (c === null ? "" : String(c))).join("|"));
    expect(testoRighe.some((r) => r.includes("Giocatore Ceduto"))).toBe(false);
    expect(testoRighe.some((r) => r.includes("Maignan"))).toBe(true);
  });
});

describe("detectHeaderRow", () => {
  it("trova l'intestazione anche quando non è sulla prima riga", async () => {
    const rows = await rowsFromXlsx(xlsxUfficiale());
    expect(detectHeaderRow(rows)).toBe(1);
  });

  it("ritorna null se nessuna riga scansionata assomiglia a un'intestazione", () => {
    const rows = [
      ["a", "b"],
      ["c", "d"],
    ];
    expect(detectHeaderRow(rows)).toBeNull();
  });
});

describe("autoMapColumns + parseGiocatori — formato ufficiale", () => {
  it("mappa da sola le colonne ufficiali e ignora RM (ruolo Mantra)", () => {
    const mappa = autoMapColumns(HEADER_UFFICIALE);
    expect(mappa["R"]).toBe("ruolo");
    expect(mappa["FVM M"]).toBe("fvmMantra");
    expect(mappaCompleta(mappa)).toBe(true);
  });

  it("estrae i giocatori saltando la riga vuota e quelli del foglio Ceduti", async () => {
    const rows = await rowsFromXlsx(xlsxUfficiale());
    const headerRowIndex = detectHeaderRow(rows)!;
    const mappa = autoMapColumns(rows[headerRowIndex].map(cellToText));
    const { giocatori, righeSaltate } = parseGiocatori(rows, headerRowIndex, mappa);

    expect(giocatori).toHaveLength(3);
    expect(righeSaltate).toBe(0); // la riga vuota è ignorata, non "saltata per dati mancanti"
    expect(giocatori.map((g) => g.nome)).toEqual(["Maignan", "Lautaro Martinez", "Bastoni"]);
    expect(giocatori[0]).toMatchObject({ ruolo: "P", quotazioneAttuale: 12, quotazioneIniziale: 10 });
  });
});

describe("parseGiocatori — colonna mancante", () => {
  it("segnala i campi obbligatori mancanti dalla mappatura", () => {
    const mappa: MappaColonne = { Nome: "nome", Squadra: "squadra" }; // manca ruolo e quotazioneAttuale
    const rows = [["Nome", "Squadra"], ["Rossi", "Milan"]];
    expect(() => parseGiocatori(rows, 0, mappa)).toThrow(/ruolo/);
  });

  it("salta le righe con un dato obbligatorio vuoto, senza interrompere il parsing", () => {
    const mappa: MappaColonne = { Nome: "nome", Squadra: "squadra", R: "ruolo", "Qt.A": "quotazioneAttuale" };
    const rows = [
      ["Nome", "Squadra", "R", "Qt.A"],
      ["Rossi", "Milan", "P", 10],
      ["Bianchi", "", "D", 8], // squadra mancante
      ["Verdi", "Roma", "X", 12], // ruolo non riconosciuto
      ["Neri", "Lazio", "A", 20],
    ];
    const { giocatori, righeSaltate } = parseGiocatori(rows, 0, mappa);
    expect(giocatori.map((g) => g.nome)).toEqual(["Rossi", "Neri"]);
    expect(righeSaltate).toBe(2);
  });
});

// --- CSV in stile Fanta Club: intestazioni libere, mapping guidato ------------

describe("parseCsv — formato Fanta Club (ipotetico, mapping libero)", () => {
  const csvFantaClub = [
    "Giocatore;Sq;Ruolo;Prezzo",
    "Rossi;Milan;P;15",
    "Bianchi;Inter;D;20",
    "", // riga vuota
    "Verdi;Roma;A;25",
  ].join("\n");

  it("rileva il delimitatore ';' e produce righe di celle", () => {
    const rows = parseCsv(csvFantaClub);
    expect(rows[0]).toEqual(["Giocatore", "Sq", "Ruolo", "Prezzo"]);
    expect(rows).toHaveLength(4); // la riga vuota viene scartata
  });

  it("con un profilo di mapping salvato per la fonte, il parsing va a segno senza mapping automatico", () => {
    // "Giocatore"/"Sq" non sono negli alias del formato ufficiale: autoMapColumns non li riconosce.
    const rows = parseCsv(csvFantaClub);
    const auto = autoMapColumns(rows[0].map(cellToText));
    expect(mappaCompleta(auto)).toBe(false);

    // profilo salvato in precedenza per questa fonte (riuso, vedi § Import listone)
    const profiloSalvato: MappaColonne = {
      Giocatore: "nome",
      Sq: "squadra",
      Ruolo: "ruolo",
      Prezzo: "quotazioneAttuale",
    };
    const { giocatori } = parseGiocatori(rows, 0, profiloSalvato);
    expect(giocatori.map((g) => g.nome)).toEqual(["Rossi", "Bianchi", "Verdi"]);
    // quotazioneIniziale non mappata: default alla quotazione attuale
    expect(giocatori[0].quotazioneIniziale).toBe(15);
  });
});

describe("parseCsv — quotazioni con virgola decimale", () => {
  it("interpreta la virgola come separatore decimale", () => {
    const rows = parseCsv(["Nome,Squadra,R,Qt.A", "Rossi,Milan,P,\"12,5\""].join("\n"));
    const mappa = autoMapColumns(rows[0].map(cellToText));
    const { giocatori } = parseGiocatori(rows, 0, mappa);
    expect(giocatori[0].quotazioneAttuale).toBe(12.5);
  });
});

// --- diff rispetto alla versione precedente -----------------------------------

describe("diffListoni", () => {
  const base: Player = {
    id: 1,
    nome: "Rossi",
    squadra: "Milan",
    ruolo: "P",
    quotazioneAttuale: 10,
    quotazioneIniziale: 10,
  };

  it("individua nuovi, ceduti e quotazioni variate", () => {
    const precedenti: Player[] = [base, { ...base, id: 2, nome: "Bianchi", squadra: "Inter" }];
    const attuali: Player[] = [
      { ...base, quotazioneAttuale: 12 }, // quotazione variata
      { ...base, id: 3, nome: "Verdi", squadra: "Roma" }, // nuovo
      // Bianchi non c'è più -> ceduto
    ];

    const diff = diffListoni(precedenti, attuali);
    expect(diff.nuovi.map((p) => p.nome)).toEqual(["Verdi"]);
    expect(diff.ceduti.map((p) => p.nome)).toEqual(["Bianchi"]);
    expect(diff.quotazioniVariate).toEqual([{ nome: "Rossi", squadra: "Milan", prima: 10, dopo: 12 }]);
  });

  it("non segnala nulla quando i due listoni sono identici", () => {
    const diff = diffListoni([base], [base]);
    expect(diff).toEqual({ nuovi: [], ceduti: [], quotazioniVariate: [] });
  });
});
