import { describe, expect, it } from "vitest";
import { simulaRosa } from "@/lib/strategia/simula";
import type { Player, SetupDoc, StrategyDoc } from "@/lib/blob/schemas";

function giocatore(id: number, ruolo: Player["ruolo"], quotazione: number): Player {
  return { id, nome: `G${id}`, squadra: "Team", ruolo, quotazioneAttuale: quotazione, quotazioneIniziale: quotazione };
}

function setup(overrides: Partial<SetupDoc> = {}): SetupDoc {
  return {
    id: "a1",
    nome: "Lega Test",
    stagione: "2026-27",
    listoneVersionId: "v1",
    modalita: "classic",
    creditiBase: 100,
    slot: { P: 1, D: 1, C: 0, A: 0 },
    squadre: [{ id: "t1", nome: "Team 1" }],
    miaSquadraId: "t1",
    sforo: { tipo: "nessuno" },
    createdAt: 0,
    ...overrides,
  };
}

function strategy(overrides: Partial<StrategyDoc> = {}): StrategyDoc {
  return {
    astaId: "a1",
    fasce: [],
    budgetReparto: { P: 5, D: 20, C: 30, A: 45 },
    slotObiettivi: [],
    prezziMassimi: [],
    tettoSpesaEuro: null,
    template: null,
    sintesiIA: null,
    updatedAt: 0,
    ...overrides,
  };
}

describe("simulaRosa — scelta del giocatore per slot", () => {
  it("usa l'obiettivo principale quando disponibile", () => {
    const giocatori = [giocatore(1, "P", 10)];
    const s = strategy({ slotObiettivi: [{ ruolo: "P", indiceSlot: 0, obiettivoPrincipale: 1, alternative: [] }] });
    const risultato = simulaRosa(setup(), giocatori, s);
    expect(risultato.slot[0].giocatore?.id).toBe(1);
    expect(risultato.slot[0].fonteScelta).toBe("obiettivo");
  });

  it("ricade sulla prima alternativa disponibile se l'obiettivo è già usato in uno slot precedente", () => {
    const giocatori = [giocatore(1, "P", 10), giocatore(2, "P", 8)];
    const s = strategy({
      slotObiettivi: [
        { ruolo: "P", indiceSlot: 0, obiettivoPrincipale: 1, alternative: [] },
        { ruolo: "P", indiceSlot: 1, obiettivoPrincipale: 1, alternative: [2] }, // stesso obiettivo del primo slot
      ],
    });
    const risultato = simulaRosa(setup({ slot: { P: 2, D: 0, C: 0, A: 0 } }), giocatori, s);
    expect(risultato.slot[0].giocatore?.id).toBe(1);
    expect(risultato.slot[1].giocatore?.id).toBe(2);
    expect(risultato.slot[1].fonteScelta).toBe("alternativa");
  });

  it("nessun candidato disponibile -> slot vuoto", () => {
    const s = strategy({ slotObiettivi: [{ ruolo: "P", indiceSlot: 0, obiettivoPrincipale: null, alternative: [] }] });
    const risultato = simulaRosa(setup(), [], s);
    expect(risultato.slot[0].giocatore).toBeNull();
    expect(risultato.slot[0].fonteScelta).toBe("nessuno");
  });
});

describe("simulaRosa — prezzo", () => {
  it("usa il prezzo massimo personale quando impostato", () => {
    const giocatori = [giocatore(1, "P", 10)];
    const s = strategy({
      slotObiettivi: [{ ruolo: "P", indiceSlot: 0, obiettivoPrincipale: 1, alternative: [] }],
      prezziMassimi: [{ playerId: 1, valore: 25, origine: "manuale" }],
    });
    const risultato = simulaRosa(setup(), giocatori, s);
    expect(risultato.slot[0].prezzo).toBe(25);
    expect(risultato.spesaTotale).toBe(25);
  });

  it("ricade sulla quotazione attuale se non c'è un prezzo massimo impostato", () => {
    const giocatori = [giocatore(1, "P", 10)];
    const s = strategy({ slotObiettivi: [{ ruolo: "P", indiceSlot: 0, obiettivoPrincipale: 1, alternative: [] }] });
    const risultato = simulaRosa(setup(), giocatori, s);
    expect(risultato.slot[0].prezzo).toBe(10);
  });

  it("entroBudget è false quando la spesa totale supera i crediti base", () => {
    const giocatori = [giocatore(1, "P", 150)];
    const s = strategy({ slotObiettivi: [{ ruolo: "P", indiceSlot: 0, obiettivoPrincipale: 1, alternative: [] }] });
    const risultato = simulaRosa(setup({ creditiBase: 100 }), giocatori, s);
    expect(risultato.entroBudget).toBe(false);
  });
});

describe("simulaRosa — rating", () => {
  it("copertura 0 quando non è impostato nessuno slotObiettivi", () => {
    const risultato = simulaRosa(setup(), [], strategy());
    expect(risultato.rating.coperturaSlot).toBe(0);
    expect(risultato.rating.concentrazioneSpesa).toBe(0);
  });

  it("concentrazione bassa quando un solo giocatore pesa la maggior parte della spesa", () => {
    const giocatori = [giocatore(1, "P", 90), giocatore(2, "D", 5)];
    const s = strategy({
      slotObiettivi: [
        { ruolo: "P", indiceSlot: 0, obiettivoPrincipale: 1, alternative: [] },
        { ruolo: "D", indiceSlot: 0, obiettivoPrincipale: 2, alternative: [] },
      ],
    });
    const risultato = simulaRosa(setup({ creditiBase: 100 }), giocatori, s);
    expect(risultato.rating.concentrazioneSpesa).toBeLessThanOrEqual(2);
  });

  it("concentrazione alta quando la spesa è ben distribuita su molti slot", () => {
    // 5 slot allo stesso prezzo: nessuno pesa più del 20% della spesa totale.
    const giocatori = [1, 2, 3, 4, 5].map((id) => giocatore(id, "D", 20));
    const s = strategy({
      slotObiettivi: giocatori.map((g, i) => ({
        ruolo: "D" as const,
        indiceSlot: i,
        obiettivoPrincipale: g.id,
        alternative: [],
      })),
    });
    const risultato = simulaRosa(setup({ creditiBase: 500, slot: { P: 0, D: 5, C: 0, A: 0 } }), giocatori, s);
    expect(risultato.rating.concentrazioneSpesa).toBe(5);
  });
});
