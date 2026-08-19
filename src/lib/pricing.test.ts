import { describe, expect, it } from "vitest";
import {
  fasceStandard,
  fasciaStandard,
  fattoreScalaBudget,
  inflazioneOsservata,
  inflazioneTeorica,
  prezzoMassimoDefault,
  prezzoReattivo,
  type AcquistoConcluso,
} from "@/lib/pricing";

describe("fattoreScalaBudget", () => {
  it("è 1 al budget standard (500)", () => {
    expect(fattoreScalaBudget(500)).toBe(1);
  });

  it("scala proporzionalmente per budget diversi", () => {
    expect(fattoreScalaBudget(1000)).toBe(2);
    expect(fattoreScalaBudget(250)).toBe(0.5);
  });
});

describe("prezzoMassimoDefault", () => {
  it("coincide con la quotazione grezza al budget standard", () => {
    expect(prezzoMassimoDefault(18, 500)).toBe(18);
  });

  it("scala la quotazione sul budget reale della lega — il bug segnalato: quotazioni 500-based su una lega da 1100 crediti", () => {
    // 18 * (1100/500) = 39.6 -> 40
    expect(prezzoMassimoDefault(18, 1100)).toBe(40);
  });
});

describe("fasceStandard", () => {
  it("coincide con le soglie standard al budget di riferimento (500)", () => {
    expect(fasceStandard(500)).toEqual([
      { nome: "Top", sogliaMin: 30, sogliaMax: null },
      { nome: "Semitop", sogliaMin: 15, sogliaMax: 29 },
      { nome: "Terza fascia", sogliaMin: 6, sogliaMax: 14 },
      { nome: "Scommesse", sogliaMin: 1, sogliaMax: 5 },
    ]);
  });

  it("scala le soglie proporzionalmente per un budget diverso", () => {
    const fasce = fasceStandard(1000); // fattoreScalaBudget 2
    expect(fasce.find((f) => f.nome === "Top")?.sogliaMin).toBe(60);
    expect(fasce.find((f) => f.nome === "Semitop")).toEqual({ nome: "Semitop", sogliaMin: 30, sogliaMax: 58 });
  });
});

describe("fasciaStandard", () => {
  it.each([
    [30, "Top"],
    [29, "Semitop"],
    [15, "Semitop"],
    [14, "Terza fascia"],
    [6, "Terza fascia"],
    [5, "Scommesse"],
    [1, "Scommesse"],
    [0, null],
  ] as const)("quotazione %i, budget standard (500) -> %s", (quotazione, atteso) => {
    expect(fasciaStandard(quotazione)).toBe(atteso);
  });

  it("scala le soglie sul budget di lega: con budget 1000 (2x lo standard) la soglia Top raddoppia", () => {
    expect(fasciaStandard(30, 1000)).toBe("Semitop"); // 30 non basta più: serve 60
    expect(fasciaStandard(60, 1000)).toBe("Top");
  });
});

describe("inflazioneTeorica", () => {
  it("a inizio asta (nessun acquisto), con budget di lega pari allo standard riflette il rapporto crediti/quotazioni grezzo", () => {
    const liberi = [{ quotazioneAttuale: 100 }, { quotazioneAttuale: 100 }];
    // 2 squadre da 100 crediti = 200 crediti in circolazione, 200 di quotazioni totali -> 1
    // creditiBase 500 = lo standard di calibrazione del listino -> fattoreScalaBudget 1, nessuna correzione.
    expect(inflazioneTeorica(200, liberi, 500)).toBe(1);
  });

  it("a fine asta (nessun giocatore libero), il denominatore è 0 e ritorna null invece di dividere per zero", () => {
    expect(inflazioneTeorica(50, [], 500)).toBeNull();
  });

  it(">1 quando la lega ha più crediti residui del valore dei giocatori liberi (a parità di scala budget)", () => {
    const liberi = [{ quotazioneAttuale: 50 }];
    expect(inflazioneTeorica(100, liberi, 500)).toBe(2);
  });

  it("normalizza per la scala del budget: un budget doppio dello standard non conta come inflazione", () => {
    const liberi = [{ quotazioneAttuale: 100 }, { quotazioneAttuale: 100 }];
    // 2 squadre da 200 crediti (budget 200, il doppio dello standard 500... qui
    // creditiBase è il budget PER SQUADRA, non l'aggregato): fattoreScalaBudget = 200/500 = 0.4.
    // Rapporto grezzo 400/200 = 2, normalizzato 2 / 0.4 = 5 — riflette che il
    // mercato sta pagando 5x la quotazione anche tenendo conto del budget più alto.
    expect(inflazioneTeorica(400, liberi, 200)).toBe(5);
  });
});

describe("inflazioneOsservata", () => {
  it("con zero acquisti ritorna null", () => {
    expect(inflazioneOsservata([], 500)).toBeNull();
  });

  it("con un solo acquisto e budget standard, l'inflazione è esattamente prezzo/quotazione di quell'acquisto", () => {
    const acquisti: AcquistoConcluso[] = [{ prezzoPagato: 15, quotazione: 10, ts: 1 }];
    expect(inflazioneOsservata(acquisti, 500)).toBe(1.5);
  });

  it("pesa di più gli acquisti più recenti", () => {
    const acquisti: AcquistoConcluso[] = [
      { prezzoPagato: 10, quotazione: 10, ts: 1 }, // rapporto 1.0, il più vecchio
      { prezzoPagato: 30, quotazione: 10, ts: 2 }, // rapporto 3.0, il più recente
    ];
    const risultato = inflazioneOsservata(acquisti, 500);
    // media pesata (1*1.0 + 2*3.0)/3 = 2.33, sopra la media semplice (1.0+3.0)/2 = 2.0
    expect(risultato).toBeCloseTo(2.333, 2);
    expect(risultato!).toBeGreaterThan(2);
  });

  it("ignora gli acquisti con quotazione 0 invece di produrre Infinity/NaN", () => {
    const acquisti: AcquistoConcluso[] = [
      { prezzoPagato: 5, quotazione: 0, ts: 1 },
      { prezzoPagato: 20, quotazione: 10, ts: 2 },
    ];
    expect(inflazioneOsservata(acquisti, 500)).toBe(2);
  });

  it("non dipende dall'ordine di inserimento, solo dal ts", () => {
    const acquisti: AcquistoConcluso[] = [
      { prezzoPagato: 30, quotazione: 10, ts: 2 },
      { prezzoPagato: 10, quotazione: 10, ts: 1 },
    ];
    expect(inflazioneOsservata(acquisti, 500)).toBeCloseTo(2.333, 2);
  });

  it("normalizza per la scala del budget, come inflazioneTeorica", () => {
    const acquisti: AcquistoConcluso[] = [{ prezzoPagato: 30, quotazione: 10, ts: 1 }];
    // budget 1000 = 2x lo standard -> fattoreScalaBudget 2; rapporto grezzo 3, normalizzato 1.5.
    expect(inflazioneOsservata(acquisti, 1000)).toBe(1.5);
  });
});

describe("prezzoReattivo", () => {
  it("resta invariato quando l'inflazione non è calcolabile", () => {
    expect(prezzoReattivo(20, null)).toBe(20);
  });

  it("applica il moltiplicatore e arrotonda", () => {
    expect(prezzoReattivo(20, 1.5)).toBe(30);
    expect(prezzoReattivo(21, 1.1)).toBe(23); // 23.1 -> 23
  });
});
