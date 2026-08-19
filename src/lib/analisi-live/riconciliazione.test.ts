import { describe, expect, it } from "vitest";
import { calcolaMetriche, costruisciRegistro } from "@/lib/analisi-live/motore";
import { riconcilia } from "@/lib/analisi-live/riconciliazione";
import { AnalisiAstaLiveSchema, type AnalisiAstaLive, type StatoAsta } from "@/lib/analisi-live/schemas";

const stato: StatoAsta = {
  lega: {
    nSquadre: 2,
    budget: 500,
    slot: { P: 1, D: 2, C: 0, A: 0 },
    modalita: "classic",
    budgetChiuso: true,
    regolePunteggio: {},
  },
  fase: "dopo-P",
  miaSquadra: { nome: "Io", rosa: [{ playerId: 1, prezzoPagato: 50 }] },
  avversari: [{ nome: "Rivale", rosa: [{ playerId: 2, prezzoPagato: 30 }] }],
  listoneDisponibili: [
    { id: 3, ruolo: "D", nome: "Bersaglio", club: "Roma", quotazione: 20 },
    { id: 4, ruolo: "D", nome: "Escluso", club: "Lazio", quotazione: 5 },
  ],
  pianoIniziale: {
    budgetReparto: { P: 0, D: 100, C: 0, A: 0 },
    slotObiettivi: [{ ruolo: "D", indiceSlot: 0, obiettivoPrincipale: 3, alternative: [4, 2] }],
    prezziMassimi: [{ playerId: 3, valore: 15 }],
  },
  vincoli: { esclusi: [4] },
};

const registro = costruisciRegistro([
  { id: 1, ruolo: "P", nome: "Mio Portiere", club: "Inter", quotazione: 10 },
  { id: 2, ruolo: "D", nome: "Preso da Rivale", club: "Milan", quotazione: 25 },
  { id: 3, ruolo: "D", nome: "Bersaglio", club: "Roma", quotazione: 20 },
  { id: 4, ruolo: "D", nome: "Escluso", club: "Lazio", quotazione: 5 },
]);

const metriche = calcolaMetriche(stato, registro);

function outputConErrori(): AnalisiAstaLive {
  return {
    meta: {
      fase: "dopo-P",
      affidabilita: "alta",
      ricercaWebEseguita: true,
      degradato: false,
      noteDegrado: null,
      fonti: [
        { titolo: "Fonte reale", url: "https://esempio.it/vera" },
        { titolo: "Fonte inventata", url: "https://esempio.it/mai-vista" },
      ],
    },
    mercato: {
      moltiplicatoreMedio: 999, // allucinato — deve essere sovrascritto
      moltiplicatorePerFascia: [],
      creditiResiduiLega: 12345, // allucinato
      slotResiduiLega: 999,
      prezzoMedioResiduo: 0,
      indicePressione: [],
      scostamentoVsPiano: "giudizio del modello, non toccare",
    },
    avversari: [
      {
        squadra: "Rivale",
        creditiResidui: 999999, // allucinato — deve essere sovrascritto con quello calcolato
        slotResidui: { P: 9, D: 9, C: 9, A: 9 },
        potereAcquistoMax: 999999,
        creditiPerSlotResiduo: 999,
        profilo: "equilibrato",
        descrizioneProfilo: "test",
        livelloMinaccia: "alto",
        repartiChiusi: [],
        blocchiClub: [],
        obiettiviProbabili: [{ playerId: 2, probabilita: 0.5, prezzoStimato: 10, motivo: "già sua, non dovrebbe restare" }],
      },
    ],
    minaccePerSlot: [
      {
        ruolo: "D",
        indiceSlot: 0,
        playerId: 3,
        disponibile: true,
        nRivaliAttivi: 999,
        rivaliPrincipali: [],
        prezzoStimatoMercato: 999,
        mioTettoAggiornato: 999999, // sopra il tetto consentito — deve essere clampato
        verdetto: "rilancia-deciso",
        note: "test",
      },
    ],
    pianoAggiornato: {
      creditiResiduiMiei: 1, // allucinato — deve essere sovrascritto
      budgetResiduoReparto: { P: 0, D: 0, C: 0, A: 0 },
      slotResidui: { P: 0, D: 0, C: 0, A: 0 },
      riservaMinima: 0,
      prezziMassimiAggiornati: [
        { playerId: 3, valore: 999999, valorePrecedente: 15, delta: 1, motivo: "test" }, // sopra il tetto + delta sbagliato
        { playerId: 4, valore: 20, valorePrecedente: null, delta: 20, motivo: "test" }, // escluso — deve sparire (I5)
        { playerId: 2, valore: 10, valorePrecedente: null, delta: 10, motivo: "test" }, // già di un avversario — deve sparire (I4)
      ],
      slotObiettiviAggiornati: [{ ruolo: "D", indiceSlot: 0, obiettivoPrincipale: 3, alternative: [4, 2] }],
    },
    consigliChiamata: [
      { playerId: 4, tipo: "chiama-ora", prezzoAtteso: 10, motivo: "azionabile su un escluso — deve sparire" },
      { playerId: 4, tipo: "non-chiamare", prezzoAtteso: 0, motivo: "è nei tuoi esclusi — deve restare" },
    ],
    alert: [],
    sintesi: "sintesi del modello",
  };
}

describe("riconcilia — [D] §7", () => {
  it("test 9: sovrascrive i numeri allucinati dal modello con i valori calcolati", () => {
    const risultato = riconcilia(outputConErrori(), stato, metriche, registro, new Set(["https://esempio.it/vera"]));

    expect(risultato.mercato.creditiResiduiLega).toBe(metriche.mercato.creditiResiduiLega);
    expect(risultato.avversari[0].creditiResidui).toBe(metriche.avversari[0].derivata.creditiResidui);
    expect(risultato.avversari[0].potereAcquistoMax).toBe(metriche.avversari[0].derivata.potereAcquistoMax);
    expect(risultato.pianoAggiornato.creditiResiduiMiei).toBe(metriche.pianoRicalibrato.creditiResiduiMiei);
  });

  it("test 10: clampa un tetto proposto sopra il budget consentito", () => {
    const risultato = riconcilia(outputConErrori(), stato, metriche, registro, new Set());
    const tettoMassimo = metriche.pianoRicalibrato.creditiResiduiMiei - metriche.pianoRicalibrato.riservaMinima + 1;

    expect(risultato.minaccePerSlot[0].mioTettoAggiornato).toBe(tettoMassimo);
    expect(risultato.minaccePerSlot[0].mioTettoAggiornato).toBeLessThan(999999);

    const prezzo3 = risultato.pianoAggiornato.prezziMassimiAggiornati.find((p) => p.playerId === 3);
    expect(prezzo3?.valore).toBe(tettoMassimo);
    // §7 step 4: il delta va ricalcolato dal codice, non fidarsi di quello del modello.
    expect(prezzo3?.delta).toBe(tettoMassimo - 15);
  });

  it("test 11: filtra un URL citato dal modello ma assente dai risultati di ricerca", () => {
    const risultato = riconcilia(outputConErrori(), stato, metriche, registro, new Set(["https://esempio.it/vera"]));

    expect(risultato.meta.fonti).toEqual([{ titolo: "Fonte reale", url: "https://esempio.it/vera" }]);
    expect(risultato.alert.some((a) => a.messaggio.includes("fonti"))).toBe(true);
  });

  it("test 12: scarta un obiettivo/prezzo massimo già in rosa di un avversario (I4)", () => {
    const risultato = riconcilia(outputConErrori(), stato, metriche, registro, new Set());

    expect(risultato.pianoAggiornato.prezziMassimiAggiornati.find((p) => p.playerId === 2)).toBeUndefined();
    expect(risultato.pianoAggiornato.slotObiettiviAggiornati[0].alternative).not.toContain(2);
    expect(risultato.avversari[0].obiettiviProbabili).toEqual([]);
    expect(risultato.alert.some((a) => a.messaggio.includes("2") && a.messaggio.includes("avversario"))).toBe(true);
  });

  it("test 13: scarta un obiettivo/prezzo massimo nei vincoli.esclusi (I5), ma tiene il 'non-chiamare' corrispondente", () => {
    const risultato = riconcilia(outputConErrori(), stato, metriche, registro, new Set());

    expect(risultato.pianoAggiornato.prezziMassimiAggiornati.find((p) => p.playerId === 4)).toBeUndefined();
    expect(risultato.pianoAggiornato.slotObiettiviAggiornati[0].alternative).not.toContain(4);

    // Il consiglio azionabile sull'escluso sparisce...
    expect(risultato.consigliChiamata.some((c) => c.playerId === 4 && c.tipo === "chiama-ora")).toBe(false);
    // ...ma "non-chiamare" sullo stesso giocatore è l'uso corretto e resta.
    expect(risultato.consigliChiamata.some((c) => c.playerId === 4 && c.tipo === "non-chiamare")).toBe(true);
  });

  it("l'output riconciliato resta valido rispetto allo schema", () => {
    const risultato = riconcilia(outputConErrori(), stato, metriche, registro, new Set(["https://esempio.it/vera"]));
    expect(() => AnalisiAstaLiveSchema.parse(risultato)).not.toThrow();
  });

  it("con urlRicercaGrezzi=null (Ponte IA manuale) le fonti citate non vengono filtrate", () => {
    const risultato = riconcilia(outputConErrori(), stato, metriche, registro, null);

    expect(risultato.meta.fonti).toHaveLength(2);
    expect(risultato.alert.some((a) => a.messaggio.includes("risultati di ricerca"))).toBe(false);
  });
});
