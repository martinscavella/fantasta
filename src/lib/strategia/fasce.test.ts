import { describe, expect, it } from "vitest";
import {
  aggiungiFascia,
  conteggioPerFascia,
  giocatoriFuoriFascia,
  impostaSoglia,
  indiceFascia,
  normalizzaFasce,
  rimuoviFascia,
} from "@/lib/strategia/fasce";
import type { Fascia, Player } from "@/lib/blob/schemas";

const STANDARD: Fascia[] = [
  { nome: "Top", sogliaMin: 30, sogliaMax: null },
  { nome: "Semitop", sogliaMin: 15, sogliaMax: 29 },
  { nome: "Terza fascia", sogliaMin: 6, sogliaMax: 14 },
  { nome: "Scommesse", sogliaMin: 1, sogliaMax: 5 },
];

function player(id: number, quotazioneAttuale: number): Player {
  return { id, nome: `G${id}`, squadra: "Club", ruolo: "A", quotazioneAttuale, quotazioneIniziale: quotazioneAttuale };
}

describe("normalizzaFasce", () => {
  it("ordina per soglia decrescente e lascia senza tetto solo la più alta", () => {
    const disordinate: Fascia[] = [
      { nome: "Scommesse", sogliaMin: 1, sogliaMax: 5 },
      { nome: "Top", sogliaMin: 30, sogliaMax: null },
      { nome: "Semitop", sogliaMin: 15, sogliaMax: 29 },
    ];
    const risultato = normalizzaFasce(disordinate);

    expect(risultato.map((f) => f.nome)).toEqual(["Top", "Semitop", "Scommesse"]);
    expect(risultato[0].sogliaMax).toBeNull();
    expect(risultato.slice(1).every((f) => f.sogliaMax !== null)).toBe(true);
  });

  it("chiude i buchi ricalcolando i tetti dalla soglia successiva", () => {
    // Top da 30 e Semitop fino a 28: la quotazione 29 non cadeva in nessuna fascia.
    const conBuco: Fascia[] = [
      { nome: "Top", sogliaMin: 30, sogliaMax: null },
      { nome: "Semitop", sogliaMin: 15, sogliaMax: 28 },
    ];
    expect(normalizzaFasce(conBuco)[1].sogliaMax).toBe(29);
  });

  it("elimina le sovrapposizioni", () => {
    const sovrapposte: Fascia[] = [
      { nome: "Top", sogliaMin: 30, sogliaMax: null },
      { nome: "Semitop", sogliaMin: 15, sogliaMax: 35 },
    ];
    expect(normalizzaFasce(sovrapposte)[1].sogliaMax).toBe(29);
  });

  it("è idempotente su fasce già a posto", () => {
    expect(normalizzaFasce(normalizzaFasce(STANDARD))).toEqual(normalizzaFasce(STANDARD));
  });

  it("regge la lista vuota", () => {
    expect(normalizzaFasce([])).toEqual([]);
  });
});

describe("impostaSoglia", () => {
  it("sposta un confine e aggiorna il tetto della fascia sotto", () => {
    const risultato = impostaSoglia(STANDARD, 0, 40);

    expect(risultato[0].sogliaMin).toBe(40);
    expect(risultato[1].sogliaMax).toBe(39);
  });

  it("non lascia scavalcare la fascia sopra", () => {
    // Semitop non può salire a 50: sopra c'è Top a 30.
    const risultato = impostaSoglia(STANDARD, 1, 50);
    expect(risultato[1].sogliaMin).toBe(29);
  });

  it("non lascia scavalcare la fascia sotto", () => {
    // Terza fascia non può scendere a 0: sotto c'è Scommesse a 1.
    const risultato = impostaSoglia(STANDARD, 2, 0);
    expect(risultato[2].sogliaMin).toBe(2);
  });

  it("la fascia più bassa può arrivare fino a zero", () => {
    expect(impostaSoglia(STANDARD, 3, 0)[3].sogliaMin).toBe(0);
  });

  it("mantiene la contiguità dopo qualunque spostamento", () => {
    const risultato = impostaSoglia(STANDARD, 1, 20);
    for (let i = 1; i < risultato.length; i++) {
      expect(risultato[i].sogliaMax).toBe(risultato[i - 1].sogliaMin - 1);
    }
  });
});

describe("aggiungiFascia e rimuoviFascia", () => {
  it("inserisce la nuova fascia in un intervallo valido, non a zero", () => {
    const risultato = aggiungiFascia(STANDARD);
    const nuova = risultato.find((f) => f.nome === "Nuova fascia");

    expect(nuova).toBeDefined();
    expect(nuova!.sogliaMin).toBeGreaterThan(0);
    expect(nuova!.sogliaMin).toBeLessThan(6);
  });

  it("crea la prima fascia partendo da una lista vuota", () => {
    expect(aggiungiFascia([])).toEqual([{ nome: "Nuova fascia", sogliaMin: 1, sogliaMax: null }]);
  });

  it("rimuovendo una fascia intermedia la partizione resta contigua", () => {
    const risultato = rimuoviFascia(STANDARD, 1);

    expect(risultato).toHaveLength(3);
    expect(risultato[1].sogliaMax).toBe(risultato[0].sogliaMin - 1);
  });
});

describe("indiceFascia", () => {
  it("assegna correttamente le quotazioni ai bordi", () => {
    expect(indiceFascia(STANDARD, 30)).toBe(0);
    expect(indiceFascia(STANDARD, 29)).toBe(1);
    expect(indiceFascia(STANDARD, 15)).toBe(1);
    expect(indiceFascia(STANDARD, 14)).toBe(2);
    expect(indiceFascia(STANDARD, 6)).toBe(2);
    expect(indiceFascia(STANDARD, 5)).toBe(3);
    expect(indiceFascia(STANDARD, 1)).toBe(3);
  });

  it("restituisce -1 sotto la soglia più bassa", () => {
    expect(indiceFascia(STANDARD, 0)).toBe(-1);
  });

  it("non ha limite superiore sulla fascia più alta", () => {
    expect(indiceFascia(STANDARD, 999)).toBe(0);
  });
});

describe("conteggioPerFascia", () => {
  it("conta i giocatori e somma le quotazioni per fascia", () => {
    const giocatori = [player(1, 40), player(2, 35), player(3, 20), player(4, 3)];
    const conteggi = conteggioPerFascia(STANDARD, giocatori);

    expect(conteggi.map((c) => c.giocatori)).toEqual([2, 1, 0, 1]);
    expect(conteggi[0].valoreTotale).toBe(75);
  });

  it("ignora i giocatori sotto la soglia più bassa", () => {
    const conteggi = conteggioPerFascia(STANDARD, [player(1, 0)]);
    expect(conteggi.reduce((tot, c) => tot + c.giocatori, 0)).toBe(0);
  });

  it("restituisce una voce per fascia anche senza giocatori", () => {
    expect(conteggioPerFascia(STANDARD, [])).toHaveLength(4);
  });
});

describe("giocatoriFuoriFascia", () => {
  it("conta chi resta sotto la soglia più bassa", () => {
    expect(giocatoriFuoriFascia(STANDARD, [player(1, 0), player(2, 1), player(3, 40)])).toBe(1);
  });

  it("senza fasce sono tutti fuori", () => {
    expect(giocatoriFuoriFascia([], [player(1, 10)])).toBe(1);
  });
});
