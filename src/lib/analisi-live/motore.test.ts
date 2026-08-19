import { describe, expect, it } from "vitest";
import {
  calcolaMercato,
  calcolaMetriche,
  calcolaMoltiplicatoreDiPiano,
  calcolaPianoRicalibrato,
  costruisciRegistro,
  derivaSquadra,
  playerIdMancantiDalRegistro,
  ripartizioneLargestRemainder,
  stimaPrezzoGiocatori,
  type GiocatoreInfo,
} from "@/lib/analisi-live/motore";
import type { Lega, StatoAsta } from "@/lib/analisi-live/schemas";

const LEGA: Lega = {
  nSquadre: 4,
  budget: 500,
  slot: { P: 3, D: 8, C: 8, A: 6 },
  modalita: "classic",
  budgetChiuso: true,
  regolePunteggio: {},
};

function statoBase(overrides: Partial<StatoAsta> = {}): StatoAsta {
  return {
    lega: LEGA,
    fase: "pre-asta",
    miaSquadra: { nome: "Io", rosa: [] },
    avversari: [],
    pianoIniziale: {},
    ...overrides,
  };
}

function giocatore(id: number, ruolo: GiocatoreInfo["ruolo"], club: string, quotazione: number): GiocatoreInfo {
  return { id, ruolo, nome: `Giocatore ${id}`, club, quotazione };
}

describe("calcolaMoltiplicatoreDiPiano — fallback quando il piano non ha target risolvibili", () => {
  // Bug segnalato dall'utente durante un'asta reale: senza questo fallback,
  // il motore restituiva il moltiplicatore neutro 1 (= "il prezzo vero è la
  // quotazione grezza") ogni volta che l'asta era appena iniziata e nessuno
  // slotObiettivi/prezzoMassimo era ancora stato compilato — anche con un
  // budget di lega molto più alto dei 500 crediti a cui è tarato il listino.
  it("usa il rapporto crediti-in-lega/valore-listino-libero invece del neutro 1", () => {
    const stato = statoBase({
      lega: { ...LEGA, nSquadre: 4, budget: 1100 },
      listoneDisponibili: [
        { id: 1, ruolo: "P", nome: "Svilar", club: "Roma", quotazione: 18 },
        { id: 2, ruolo: "C", nome: "Calhanoglu", club: "Inter", quotazione: 26 },
      ],
    });
    const registro = costruisciRegistro([]);
    // 4 squadre * 1100 = 4400 crediti ancora in circolo (nessun acquisto), 44 di quotazioni libere.
    const risultato = calcolaMoltiplicatoreDiPiano(stato, registro, 4400);
    expect(risultato).toBeCloseTo(100, 5); // 4400 / 44
  });

  it("resta 1 (neutro) se anche il listone disponibili è vuoto — nessun segnale da cui dedurre la scala", () => {
    const stato = statoBase();
    const registro = costruisciRegistro([]);
    expect(calcolaMoltiplicatoreDiPiano(stato, registro, 1000)).toBe(1);
  });

  it("preferisce i target di piano quando risolvibili, ignorando il fallback su budget/listino", () => {
    const stato = statoBase({
      lega: { ...LEGA, budget: 1100 },
      pianoIniziale: { budgetReparto: { P: 100, D: 0, C: 0, A: 0 }, prezziMassimi: [{ playerId: 1, valore: 999 }] },
      listoneDisponibili: [{ id: 1, ruolo: "P", nome: "Svilar", club: "Roma", quotazione: 18 }],
    });
    const registro = costruisciRegistro([{ id: 1, ruolo: "P", nome: "Svilar", club: "Roma", quotazione: 18 }]);
    // budgetTotale (100) / sommaQuot dei target (18) = 5.55..., non il fallback su budget/listino.
    expect(calcolaMoltiplicatoreDiPiano(stato, registro, 4400)).toBeCloseTo(100 / 18, 5);
  });
});

describe("derivaSquadra — potereAcquistoMax", () => {
  it("con un solo slot residuo, il potere d'acquisto e' uguale ai crediti residui (caso limite)", () => {
    // Lega con 1 solo slot per ruolo così la rosa è quasi completa: resta 1 P.
    const lega: Lega = { ...LEGA, slot: { P: 1, D: 0, C: 0, A: 0 } };
    const registro = costruisciRegistro([]);
    const derivata = derivaSquadra({ nome: "Io", rosa: [] }, lega, registro);

    expect(derivata.slotResiduiTotali).toBe(1);
    expect(derivata.potereAcquistoMax).toBe(derivata.creditiResidui);
  });

  it("a rosa completa il potere d'acquisto e' 0, non e' piu' un rivale", () => {
    const lega: Lega = { ...LEGA, slot: { P: 1, D: 0, C: 0, A: 0 } };
    const registro = costruisciRegistro([giocatore(1, "P", "Inter", 20)]);
    const derivata = derivaSquadra({ nome: "Io", rosa: [{ playerId: 1, prezzoPagato: 50 }] }, lega, registro);

    expect(derivata.slotResiduiTotali).toBe(0);
    expect(derivata.potereAcquistoMax).toBe(0);
  });

  it("rosa vuota, fase pre-asta: metriche coerenti e moltiplicatori a null", () => {
    const stato = statoBase();
    const registro = costruisciRegistro([]);
    const metriche = calcolaMetriche(stato, registro);

    expect(metriche.mia.creditiSpesi).toBe(0);
    expect(metriche.mia.creditiResidui).toBe(LEGA.budget);
    expect(metriche.mercato.moltiplicatoreMedio).toBeNull();
    for (const f of metriche.mercato.moltiplicatorePerFascia) {
      expect(f.moltiplicatore).toBe(0);
      expect(f.campione).toBe(0);
      expect(f.affidabile).toBe(false);
    }
  });

  it("blocchiClub conta solo i club con almeno 2 giocatori, ordinati per conteggio decrescente", () => {
    const registro = costruisciRegistro([
      giocatore(1, "D", "Como", 10),
      giocatore(2, "D", "Como", 9),
      giocatore(3, "D", "Como", 8),
      giocatore(4, "D", "Inter", 30),
      giocatore(5, "A", "Napoli", 25),
    ]);
    const derivata = derivaSquadra(
      {
        nome: "Rivale",
        rosa: [
          { playerId: 1, prezzoPagato: 40 },
          { playerId: 2, prezzoPagato: 35 },
          { playerId: 3, prezzoPagato: 5 },
          { playerId: 4, prezzoPagato: 60 },
          { playerId: 5, prezzoPagato: 1 },
        ],
      },
      LEGA,
      registro,
    );

    expect(derivata.blocchiClub).toEqual([{ club: "Como", conteggio: 3 }]);
  });
});

describe("playerIdMancantiDalRegistro", () => {
  it("segnala i playerId citati in rosa ma assenti dal registro", () => {
    const stato = statoBase({ miaSquadra: { nome: "Io", rosa: [{ playerId: 99, prezzoPagato: 10 }] } });
    expect(playerIdMancantiDalRegistro(stato, costruisciRegistro([]))).toEqual([99]);
    expect(playerIdMancantiDalRegistro(stato, costruisciRegistro([giocatore(99, "P", "Roma", 5)]))).toEqual([]);
  });
});

describe("calcolaMercato — §4.2 rapporto delle somme, non media dei rapporti", () => {
  it("usa il rapporto delle somme quando diverge dalla media dei rapporti", () => {
    // Due acquisti: uno a basso costo con rapporto altissimo (fa esplodere la
    // media), uno grande in linea. Rapporto-delle-somme resta vicino a 1.
    const registro = costruisciRegistro([giocatore(1, "A", "Milan", 1), giocatore(2, "A", "Inter", 40)]);
    const squadre = [
      {
        squadra: { nome: "X", rosa: [{ playerId: 1, prezzoPagato: 5 }, { playerId: 2, prezzoPagato: 40 }] },
        derivata: derivaSquadra(
          { nome: "X", rosa: [{ playerId: 1, prezzoPagato: 5 }, { playerId: 2, prezzoPagato: 40 }] },
          LEGA,
          registro,
        ),
      },
    ];

    const mercato = calcolaMercato(registro, squadre);

    const mediaDeiRapporti = (5 / 1 + 40 / 40) / 2; // = 3.0
    const rapportoDelleSomme = (5 + 40) / (1 + 40); // ~1.098

    expect(mercato.moltiplicatoreMedio).toBeCloseTo(rapportoDelleSomme, 5);
    expect(mercato.moltiplicatoreMedio).not.toBeCloseTo(mediaDeiRapporti, 1);
  });

  it("marca inaffidabile un bucket con campione < 3", () => {
    const registro = costruisciRegistro([giocatore(1, "D", "Roma", 30), giocatore(2, "D", "Roma", 28)]);
    const squadra = { nome: "X", rosa: [{ playerId: 1, prezzoPagato: 60 }, { playerId: 2, prezzoPagato: 50 }] };
    const derivata = derivaSquadra(squadra, LEGA, registro);

    const mercato = calcolaMercato(registro, [{ squadra, derivata }]);
    const top = mercato.moltiplicatorePerFascia.find((f) => f.fascia === "top")!;

    expect(top.campione).toBe(2);
    expect(top.affidabile).toBe(false);
  });
});

describe("stimaPrezzoGiocatori — nRivaliAttivi (§4.4)", () => {
  it("esclude gli avversari col reparto chiuso e quelli senza potere d'acquisto sufficiente", () => {
    const registro = costruisciRegistro([giocatore(10, "D", "Inter", 20)]);
    const legaLocale: Lega = { ...LEGA, slot: { P: 0, D: 1, C: 0, A: 0 } };

    // Avversario A: reparto D chiuso (0 slot residui) — non conta come rivale.
    const registroA = costruisciRegistro([giocatore(1, "D", "Roma", 20), giocatore(10, "D", "Inter", 20)]);
    const avvChiuso = derivaSquadra({ nome: "Chiuso", rosa: [{ playerId: 1, prezzoPagato: 15 }] }, legaLocale, registroA);

    // Avversario B: reparto D aperto ma potere d'acquisto sotto prezzoBase.
    const legaAmpia: Lega = { ...LEGA, slot: { P: 0, D: 5, C: 0, A: 0 }, budget: 10 };
    const avvPovero = derivaSquadra({ nome: "Povero", rosa: [] }, legaAmpia, registro);

    // Avversario C: reparto D aperto e potere d'acquisto sufficiente.
    const legaRicca: Lega = { ...LEGA, slot: { P: 0, D: 5, C: 0, A: 0 }, budget: 500 };
    const avvRicco = derivaSquadra({ nome: "Ricco", rosa: [] }, legaRicca, registro);

    const stato = statoBase({
      lega: legaLocale,
      listoneDisponibili: [{ id: 10, ruolo: "D", nome: "Test", club: "Inter", quotazione: 20 }],
    });

    const mercato = calcolaMercato(registro, []);
    const stime = stimaPrezzoGiocatori(stato, mercato, 1, [avvChiuso, avvPovero, avvRicco]);

    // moltiplicatore fallback = moltiplicatoreDiPiano = 1 -> prezzoBase = 20.
    // avvPovero ha potereAcquistoMax basso (budget 10, slot 5 -> max(0, 10-4)=6 < 20): escluso.
    // avvChiuso: reparto chiuso, escluso. avvRicco: incluso.
    expect(stime[0].nRivaliAttivi).toBe(1);
  });
});

describe("ripartizioneLargestRemainder — §4.5, invariante Σ = totale", () => {
  it("la somma ripartita e' sempre esattamente il totale, su input casuali", () => {
    for (let i = 0; i < 200; i++) {
      const totale = Math.floor(Math.random() * 2000) - 500; // include negativi
      const pesi = { P: Math.random() * 100, D: Math.random() * 100, C: Math.random() * 100, A: Math.random() * 100 };
      const risultato = ripartizioneLargestRemainder(totale, pesi);
      const somma = risultato.P + risultato.D + risultato.C + risultato.A;
      expect(somma).toBe(totale);
    }
  });

  it("con pesi tutti zero non esplode e restituisce zero ovunque", () => {
    const risultato = ripartizioneLargestRemainder(100, { P: 0, D: 0, C: 0, A: 0 });
    expect(risultato).toEqual({ P: 0, D: 0, C: 0, A: 0 });
  });
});

describe("calcolaPianoRicalibrato — §4.5", () => {
  it("Σ residuoTeorico = 0 (ho sforato ovunque) → fallback proporzionale agli slot residui", () => {
    const lega: Lega = { ...LEGA, budget: 100, slot: { P: 1, D: 1, C: 0, A: 0 } };
    const registro = costruisciRegistro([giocatore(1, "P", "Roma", 5), giocatore(2, "D", "Roma", 5)]);
    // Piano iniziale a budget zero sui reparti ancora aperti (P, D): residuoTeorico
    // e' 0 ovunque pur non avendo ancora speso nulla -> scatta il fallback.
    const statoSforato = statoBase({
      lega,
      miaSquadra: { nome: "Io", rosa: [] },
      pianoIniziale: { budgetReparto: { P: 0, D: 0, C: 0, A: 0 } },
    });

    const mia = derivaSquadra(statoSforato.miaSquadra, lega, registro);
    const piano = calcolaPianoRicalibrato(statoSforato, mia, registro);

    expect(piano.fallbackSforatoOvunque).toBe(true);
    // slotResidui(P)=1, slotResidui(D)=1 -> ripartizione 50/50 di creditiResiduiMiei (100).
    expect(piano.budgetResiduoReparto.P + piano.budgetResiduoReparto.D).toBe(piano.creditiResiduiMiei);
    expect(piano.budgetResiduoReparto.P).toBe(50);
    expect(piano.budgetResiduoReparto.D).toBe(50);
  });

  it("invariante I1: Σ budgetResiduoReparto = creditiResiduiMiei, anche con reparti chiusi", () => {
    const lega: Lega = { ...LEGA, budget: 979, slot: { P: 3, D: 8, C: 8, A: 6 } };
    const registro = costruisciRegistro([giocatore(1, "P", "Roma", 20)]);
    const stato = statoBase({
      lega,
      miaSquadra: { nome: "Io", rosa: [{ playerId: 1, prezzoPagato: 121 }] },
      pianoIniziale: { budgetReparto: { P: 120, D: 330, C: 380, A: 270 } },
    });
    const mia = derivaSquadra(stato.miaSquadra, lega, registro);
    const piano = calcolaPianoRicalibrato(stato, mia, registro);

    const somma = piano.budgetResiduoReparto.P + piano.budgetResiduoReparto.D + piano.budgetResiduoReparto.C + piano.budgetResiduoReparto.A;
    expect(somma).toBe(piano.creditiResiduiMiei);
    // P e' chiuso (slot P = 3, occupati 3 dopo... in realta' qui e' 1/3, resta aperto):
    // verifichiamo solo l'invariante di somma, il caso "reparto chiuso" e' coperto
    // esplicitamente nel test seguente.
  });

  it("un reparto chiuso non riceve budget anche se il piano iniziale prevedeva una cifra li'", () => {
    const lega: Lega = { ...LEGA, budget: 400, slot: { P: 1, D: 8, C: 8, A: 6 } };
    const registro = costruisciRegistro([giocatore(1, "P", "Roma", 20)]);
    const stato = statoBase({
      lega,
      miaSquadra: { nome: "Io", rosa: [{ playerId: 1, prezzoPagato: 50 }] },
      pianoIniziale: { budgetReparto: { P: 120, D: 100, C: 100, A: 80 } },
    });
    const mia = derivaSquadra(stato.miaSquadra, lega, registro);
    expect(mia.slotResidui.P).toBe(0);

    const piano = calcolaPianoRicalibrato(stato, mia, registro);
    expect(piano.budgetResiduoReparto.P).toBe(0);
  });
});
