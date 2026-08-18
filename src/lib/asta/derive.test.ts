import { describe, expect, it } from "vitest";
import { derivaInflazione, derivaSquadre, giocatoriLiberiPerRuolo } from "@/lib/asta/derive";
import type { AstaState } from "@/lib/asta/reducer";
import type { BoardEvent, Player, SetupDoc } from "@/lib/blob/schemas";

function giocatore(id: number, ruolo: Player["ruolo"], squadra = "Milan"): Player {
  return { id, nome: `G${id}`, squadra, ruolo, quotazioneAttuale: 10, quotazioneIniziale: 10 };
}

function setup(overrides: Partial<SetupDoc> = {}): SetupDoc {
  return {
    id: "a1",
    nome: "Lega Test",
    stagione: "2026-27",
    listoneVersionId: "v1",
    modalita: "classic",
    creditiBase: 100,
    slot: { P: 1, D: 2, C: 2, A: 1 },
    squadre: [{ id: "t1", nome: "Team 1" }],
    miaSquadraId: "t1",
    sforo: { tipo: "nessuno" },
    createdAt: 0,
    ...overrides,
  };
}

function stato(assegnazioni: AstaState["assegnazioni"]): AstaState {
  return { assegnazioni };
}

describe("derivaSquadre — massima offerta", () => {
  it("caso limite: un solo slot residuo -> massima offerta = crediti residui (crediti - 0)", () => {
    const s = setup({ slot: { P: 1, D: 0, C: 0, A: 0 }, creditiBase: 100 });
    const [team] = derivaSquadre(stato({}), s, [giocatore(1, "P")]);
    expect(team.slotResiduiTotali).toBe(1);
    expect(team.massimaOfferta).toBe(100); // 100 - (1-1) = 100, non 99
  });

  it("due slot residui: crediti residui - (slot - 1)", () => {
    const s = setup({ slot: { P: 2, D: 0, C: 0, A: 0 }, creditiBase: 100 });
    const [team] = derivaSquadre(stato({}), s, [giocatore(1, "P"), giocatore(2, "P")]);
    expect(team.massimaOfferta).toBe(99); // 100 - (2-1)
  });

  it("squadra a budget esaurito: massima offerta è 0", () => {
    const s = setup({ slot: { P: 1, D: 0, C: 0, A: 0 }, creditiBase: 100 });
    const state = stato({ e1: { playerId: 1, teamId: "t1", price: 100 } });
    const [team] = derivaSquadre(state, s, [giocatore(1, "P"), giocatore(2, "D")]);
    expect(team.creditiResidui).toBe(0);
  });

  it("squadra con rosa completa: slotResiduiTotali 0, massima offerta 0", () => {
    const s = setup({ slot: { P: 1, D: 0, C: 0, A: 0 }, creditiBase: 100 });
    const state = stato({ e1: { playerId: 1, teamId: "t1", price: 20 } });
    const [team] = derivaSquadre(state, s, [giocatore(1, "P")]);
    expect(team.rosaCompleta).toBe(true);
    expect(team.slotResiduiTotali).toBe(0);
    expect(team.massimaOfferta).toBe(0);
  });
});

describe("derivaSquadre — modalità sforo", () => {
  it("crediti residui negativi quando la spesa supera il budget base", () => {
    const s = setup({ creditiBase: 100, sforo: { tipo: "a-pagamento", euroPerCredito: 0.1 } });
    const state = stato({ e1: { playerId: 1, teamId: "t1", price: 150 } });
    const [team] = derivaSquadre(state, s, [giocatore(1, "P")]);
    expect(team.creditiResidui).toBe(-50);
  });

  it("calcola lo sforo in crediti e in euro", () => {
    const s = setup({ creditiBase: 100, sforo: { tipo: "a-pagamento", euroPerCredito: 0.1 } });
    const state = stato({ e1: { playerId: 1, teamId: "t1", price: 150 } });
    const [team] = derivaSquadre(state, s, [giocatore(1, "P")]);
    expect(team.sforoCrediti).toBe(50);
    expect(team.sforoEuro).toBeCloseTo(5);
  });

  it("sforo a zero quando la spesa eguaglia esattamente il budget", () => {
    const s = setup({ creditiBase: 100, sforo: { tipo: "a-pagamento", euroPerCredito: 0.1 } });
    const state = stato({ e1: { playerId: 1, teamId: "t1", price: 100 } });
    const [team] = derivaSquadre(state, s, [giocatore(1, "P")]);
    expect(team.sforoCrediti).toBe(0);
    expect(team.sforoEuro).toBe(0);
  });

  it("massima offerta è null (il tetto in crediti non esiste più)", () => {
    const s = setup({ sforo: { tipo: "a-pagamento", euroPerCredito: 0.1 } });
    const [team] = derivaSquadre(stato({}), s, [giocatore(1, "P")]);
    expect(team.massimaOfferta).toBeNull();
  });
});

describe("giocatoriLiberiPerRuolo e obbligo", () => {
  it("un ruolo diventa obbligato quando slot residui = liberi rimasti", () => {
    const s = setup({ slot: { P: 1, D: 2, C: 0, A: 0 }, creditiBase: 500 });
    // Solo 2 difensori in tutto il listone, la squadra ne deve prendere 2.
    const giocatori = [giocatore(1, "P"), giocatore(2, "D"), giocatore(3, "D")];
    const [team] = derivaSquadre(stato({}), s, giocatori);
    expect(giocatoriLiberiPerRuolo(stato({}), giocatori).D).toBe(2);
    expect(team.obbligoPerRuolo.D).toBe(true);
    expect(team.obbligoPerRuolo.P).toBe(true); // 1 slot P residuo, 1 solo P libero nel listone
  });

  it("un ruolo con abbondanza di giocatori liberi non è obbligato", () => {
    const s = setup({ slot: { P: 1, D: 1, C: 0, A: 0 }, creditiBase: 500 });
    const giocatori = [
      giocatore(1, "P"),
      giocatore(2, "D"),
      giocatore(3, "D"),
      giocatore(4, "D"),
      giocatore(5, "D"),
    ];
    const [team] = derivaSquadre(stato({}), s, giocatori);
    expect(team.obbligoPerRuolo.D).toBe(false);
  });

  it("un ruolo già completo non è mai obbligato", () => {
    const s = setup({ slot: { P: 1, D: 0, C: 0, A: 0 }, creditiBase: 500 });
    const state = stato({ e1: { playerId: 1, teamId: "t1", price: 10 } });
    const [team] = derivaSquadre(state, s, [giocatore(1, "P")]);
    expect(team.obbligoPerRuolo.P).toBe(false);
  });
});

describe("derivaInflazione", () => {
  function assign(id: string, playerId: number, teamId: string, price: number, ts: number): BoardEvent {
    return { id, ts, type: "ASSIGN", playerId, teamId, price };
  }

  it("a budget chiuso calcola sia teorica che osservata", () => {
    const s = setup({ slot: { P: 2, D: 0, C: 0, A: 0 }, creditiBase: 100, squadre: [{ id: "t1", nome: "Team 1" }] });
    const giocatori = [giocatore(1, "P"), giocatore(2, "P")]; // quotazione 10 ciascuno
    const events: BoardEvent[] = [assign("e1", 1, "t1", 15, 1)];
    const state = stato({ e1: { playerId: 1, teamId: "t1", price: 15 } });

    const risultato = derivaInflazione(state, s, giocatori, events);
    expect(risultato.teorica).not.toBeNull(); // 85 crediti residui / 10 di quotazione libera
    expect(risultato.osservata).toBe(1.5); // 15/10
    expect(risultato.effettiva).toBe(risultato.teorica);
  });

  it("a sforo, teorica è null e l'effettiva coincide con l'osservata", () => {
    const s = setup({
      slot: { P: 1, D: 0, C: 0, A: 0 },
      creditiBase: 100,
      sforo: { tipo: "a-pagamento", euroPerCredito: 0.1 },
    });
    const giocatori = [giocatore(1, "P")];
    const events: BoardEvent[] = [assign("e1", 1, "t1", 20, 1)];
    const state = stato({ e1: { playerId: 1, teamId: "t1", price: 20 } });

    const risultato = derivaInflazione(state, s, giocatori, events);
    expect(risultato.teorica).toBeNull();
    expect(risultato.osservata).toBe(2);
    expect(risultato.effettiva).toBe(2);
  });

  it("a inizio asta (nessun acquisto), osservata è null ma teorica è comunque calcolabile", () => {
    const s = setup({ slot: { P: 1, D: 0, C: 0, A: 0 }, creditiBase: 100 });
    const giocatori = [giocatore(1, "P")];
    const risultato = derivaInflazione(stato({}), s, giocatori, []);
    expect(risultato.osservata).toBeNull();
    expect(risultato.teorica).toBe(10); // 100 crediti residui / 10 di quotazione
  });

  it("a fine asta (nessun giocatore libero), teorica è null", () => {
    const s = setup({ slot: { P: 1, D: 0, C: 0, A: 0 }, creditiBase: 100 });
    const giocatori = [giocatore(1, "P")];
    const events: BoardEvent[] = [assign("e1", 1, "t1", 10, 1)];
    const state = stato({ e1: { playerId: 1, teamId: "t1", price: 10 } });
    const risultato = derivaInflazione(state, s, giocatori, events);
    expect(risultato.teorica).toBeNull();
  });
});
