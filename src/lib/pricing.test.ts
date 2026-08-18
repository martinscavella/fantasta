import { describe, expect, it } from "vitest";
import {
  fasciaStandard,
  inflazioneOsservata,
  inflazioneTeorica,
  prezzoReattivo,
  type AcquistoConcluso,
} from "@/lib/pricing";

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
  ] as const)("quotazione %i -> %s", (quotazione, atteso) => {
    expect(fasciaStandard(quotazione)).toBe(atteso);
  });
});

describe("inflazioneTeorica", () => {
  it("a inizio asta (nessun acquisto), riflette il rapporto crediti/quotazioni di partenza", () => {
    const liberi = [{ quotazioneAttuale: 100 }, { quotazioneAttuale: 100 }];
    // 2 squadre da 100 crediti = 200 crediti in circolazione, 200 di quotazioni totali -> 1
    expect(inflazioneTeorica(200, liberi)).toBe(1);
  });

  it("a fine asta (nessun giocatore libero), il denominatore è 0 e ritorna null invece di dividere per zero", () => {
    expect(inflazioneTeorica(50, [])).toBeNull();
  });

  it(">1 quando la lega ha più crediti residui del valore dei giocatori liberi", () => {
    const liberi = [{ quotazioneAttuale: 50 }];
    expect(inflazioneTeorica(100, liberi)).toBe(2);
  });
});

describe("inflazioneOsservata", () => {
  it("con zero acquisti ritorna null", () => {
    expect(inflazioneOsservata([])).toBeNull();
  });

  it("con un solo acquisto, l'inflazione è esattamente prezzo/quotazione di quell'acquisto", () => {
    const acquisti: AcquistoConcluso[] = [{ prezzoPagato: 15, quotazione: 10, ts: 1 }];
    expect(inflazioneOsservata(acquisti)).toBe(1.5);
  });

  it("pesa di più gli acquisti più recenti", () => {
    const acquisti: AcquistoConcluso[] = [
      { prezzoPagato: 10, quotazione: 10, ts: 1 }, // rapporto 1.0, il più vecchio
      { prezzoPagato: 30, quotazione: 10, ts: 2 }, // rapporto 3.0, il più recente
    ];
    const risultato = inflazioneOsservata(acquisti);
    // media pesata (1*1.0 + 2*3.0)/3 = 2.33, sopra la media semplice (1.0+3.0)/2 = 2.0
    expect(risultato).toBeCloseTo(2.333, 2);
    expect(risultato!).toBeGreaterThan(2);
  });

  it("ignora gli acquisti con quotazione 0 invece di produrre Infinity/NaN", () => {
    const acquisti: AcquistoConcluso[] = [
      { prezzoPagato: 5, quotazione: 0, ts: 1 },
      { prezzoPagato: 20, quotazione: 10, ts: 2 },
    ];
    expect(inflazioneOsservata(acquisti)).toBe(2);
  });

  it("non dipende dall'ordine di inserimento, solo dal ts", () => {
    const acquisti: AcquistoConcluso[] = [
      { prezzoPagato: 30, quotazione: 10, ts: 2 },
      { prezzoPagato: 10, quotazione: 10, ts: 1 },
    ];
    expect(inflazioneOsservata(acquisti)).toBeCloseTo(2.333, 2);
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
