import { describe, expect, it } from "vitest";
import { reduceBoard } from "@/lib/asta/reducer";
import type { BoardEvent, Ruolo, SetupDoc } from "@/lib/blob/schemas";

function setup(overrides: Partial<SetupDoc> = {}): SetupDoc {
  return {
    id: "a1",
    nome: "Lega Test",
    stagione: "2026-27",
    listoneVersionId: "v1",
    modalita: "classic",
    creditiBase: 500,
    slot: { P: 1, D: 2, C: 2, A: 1 },
    squadre: [
      { id: "t1", nome: "Team 1" },
      { id: "t2", nome: "Team 2" },
    ],
    miaSquadraId: "t1",
    sforo: { tipo: "nessuno" },
    createdAt: 0,
    ...overrides,
  };
}

const ruoli: Record<number, Ruolo> = { 1: "P", 2: "D", 3: "D", 4: "D", 5: "C", 6: "A" };

function assign(id: string, playerId: number, teamId: string, price: number, ts = Number(id)): BoardEvent {
  return { id, ts, type: "ASSIGN", playerId, teamId, price };
}

describe("reduceBoard — assegnazione", () => {
  it("applica un ASSIGN valido", () => {
    const state = reduceBoard([assign("1", 1, "t1", 20)], setup(), ruoli);
    expect(state.assegnazioni["1"]).toEqual({ playerId: 1, teamId: "t1", price: 20 });
  });
});

describe("reduceBoard — undo", () => {
  it("un UNDO rimuove l'assegnazione originaria", () => {
    const events: BoardEvent[] = [assign("1", 1, "t1", 20), { id: "2", ts: 2, type: "UNDO", targetEventId: "1" }];
    const state = reduceBoard(events, setup(), ruoli);
    expect(state.assegnazioni).toEqual({});
  });

  it("un UNDO su un evento inesistente non ha effetto", () => {
    const events: BoardEvent[] = [assign("1", 1, "t1", 20), { id: "2", ts: 2, type: "UNDO", targetEventId: "999" }];
    const state = reduceBoard(events, setup(), ruoli);
    expect(state.assegnazioni["1"]).toBeDefined();
  });
});

describe("reduceBoard — edit", () => {
  it("un EDIT cambia il prezzo mantenendo lo stesso eventId chiave", () => {
    const events: BoardEvent[] = [
      assign("1", 1, "t1", 20),
      { id: "2", ts: 2, type: "EDIT", targetEventId: "1", price: 35 },
    ];
    const state = reduceBoard(events, setup(), ruoli);
    expect(state.assegnazioni["1"]).toEqual({ playerId: 1, teamId: "t1", price: 35 });
  });

  it("un EDIT cambia la squadra", () => {
    const events: BoardEvent[] = [
      assign("1", 1, "t1", 20),
      { id: "2", ts: 2, type: "EDIT", targetEventId: "1", teamId: "t2" },
    ];
    const state = reduceBoard(events, setup(), ruoli);
    expect(state.assegnazioni["1"].teamId).toBe("t2");
  });

  it("un EDIT su un target già annullato non ha effetto", () => {
    const events: BoardEvent[] = [
      assign("1", 1, "t1", 20),
      { id: "2", ts: 2, type: "UNDO", targetEventId: "1" },
      { id: "3", ts: 3, type: "EDIT", targetEventId: "1", price: 99 },
    ];
    const state = reduceBoard(events, setup(), ruoli);
    expect(state.assegnazioni).toEqual({});
  });
});

describe("reduceBoard — doppia assegnazione dello stesso giocatore", () => {
  it("il secondo ASSIGN sullo stesso playerId non ha effetto", () => {
    const events: BoardEvent[] = [assign("1", 1, "t1", 20), assign("2", 1, "t2", 30)];
    const state = reduceBoard(events, setup(), ruoli);
    expect(Object.keys(state.assegnazioni)).toEqual(["1"]);
    expect(state.assegnazioni["1"]).toEqual({ playerId: 1, teamId: "t1", price: 20 });
  });

  it("dopo un UNDO il giocatore torna assegnabile", () => {
    const events: BoardEvent[] = [
      assign("1", 1, "t1", 20),
      { id: "2", ts: 2, type: "UNDO", targetEventId: "1" },
      assign("3", 1, "t2", 30),
    ];
    const state = reduceBoard(events, setup(), ruoli);
    expect(state.assegnazioni["3"]).toEqual({ playerId: 1, teamId: "t2", price: 30 });
  });
});

describe("reduceBoard — superamento budget", () => {
  it("un ASSIGN che sfora il budget chiuso non ha effetto", () => {
    const s = setup({ creditiBase: 50 });
    const events: BoardEvent[] = [assign("1", 1, "t1", 30), assign("2", 2, "t1", 30)]; // 30+30 > 50
    const state = reduceBoard(events, s, ruoli);
    expect(Object.keys(state.assegnazioni)).toEqual(["1"]);
  });

  it("in modalità sforo il budget non blocca l'assegnazione", () => {
    const s = setup({ creditiBase: 50, sforo: { tipo: "a-pagamento", euroPerCredito: 0.1 } });
    const events: BoardEvent[] = [assign("1", 1, "t1", 30), assign("2", 2, "t1", 30)];
    const state = reduceBoard(events, s, ruoli);
    expect(Object.keys(state.assegnazioni)).toEqual(["1", "2"]);
  });
});

describe("reduceBoard — superamento slot", () => {
  it("un ASSIGN oltre lo slot del ruolo non ha effetto (slot D pieno)", () => {
    const s = setup({ slot: { P: 1, D: 1, C: 2, A: 1 } });
    // giocatori 2,3,4 sono tutti D; slot D = 1
    const events: BoardEvent[] = [assign("1", 2, "t1", 10), assign("2", 3, "t1", 10)];
    const state = reduceBoard(events, s, ruoli);
    expect(Object.keys(state.assegnazioni)).toEqual(["1"]);
  });

  it("squadre diverse hanno slot indipendenti", () => {
    const s = setup({ slot: { P: 1, D: 1, C: 2, A: 1 } });
    const events: BoardEvent[] = [assign("1", 2, "t1", 10), assign("2", 3, "t2", 10)];
    const state = reduceBoard(events, s, ruoli);
    expect(Object.keys(state.assegnazioni)).toEqual(["1", "2"]);
  });
});

describe("reduceBoard — ordine eventi", () => {
  it("ordina gli eventi per ts prima di applicarli, indipendentemente dall'ordine nell'array", () => {
    const events: BoardEvent[] = [
      { id: "2", ts: 2, type: "UNDO", targetEventId: "1" },
      assign("1", 1, "t1", 20, 1),
    ];
    const state = reduceBoard(events, setup(), ruoli);
    expect(state.assegnazioni).toEqual({});
  });
});
