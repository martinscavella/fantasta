import { describe, expect, it } from "vitest";
import { BoardEventSchema, PlayerSchema, RegoleSforoSchema, SetupDocSchema } from "@/lib/blob/schemas";

describe("BoardEventSchema", () => {
  it("valida un evento ASSIGN", () => {
    const event = { id: "e1", ts: 1, type: "ASSIGN", playerId: 10, teamId: "t1", price: 25 };
    expect(BoardEventSchema.parse(event)).toEqual(event);
  });

  it("valida un evento UNDO senza i campi di ASSIGN", () => {
    const event = { id: "e2", ts: 2, type: "UNDO", targetEventId: "e1" };
    expect(BoardEventSchema.parse(event)).toEqual(event);
  });

  it("rifiuta un tipo di evento sconosciuto", () => {
    expect(() => BoardEventSchema.parse({ id: "e3", ts: 3, type: "REASSIGN" })).toThrow();
  });

  it("rifiuta ASSIGN con prezzo negativo", () => {
    const event = { id: "e4", ts: 4, type: "ASSIGN", playerId: 10, teamId: "t1", price: -5 };
    expect(() => BoardEventSchema.parse(event)).toThrow();
  });
});

describe("RegoleSforoSchema", () => {
  it("valida la modalità senza sforo", () => {
    expect(RegoleSforoSchema.parse({ tipo: "nessuno" })).toEqual({ tipo: "nessuno" });
  });

  it("valida la modalità a sforo con cambio euro", () => {
    const regole = { tipo: "a-pagamento", euroPerCredito: 0.1 };
    expect(RegoleSforoSchema.parse(regole)).toEqual(regole);
  });

  it("rifiuta 'a-pagamento' senza euroPerCredito", () => {
    expect(() => RegoleSforoSchema.parse({ tipo: "a-pagamento" })).toThrow();
  });
});

describe("PlayerSchema", () => {
  it("rifiuta un ruolo Mantra", () => {
    const player = {
      id: 1,
      nome: "Rossi",
      squadra: "Milan",
      ruolo: "Trq",
      quotazioneAttuale: 10,
      quotazioneIniziale: 10,
    };
    expect(() => PlayerSchema.parse(player)).toThrow();
  });
});

describe("SetupDocSchema", () => {
  it("rifiuta una modalità diversa da classic", () => {
    const setup = {
      id: "a1",
      nome: "Lega Test",
      stagione: "2026-27",
      listoneVersionId: "v1",
      modalita: "mantra",
      creditiBase: 500,
      slot: { P: 3, D: 8, C: 8, A: 6 },
      squadre: [],
      sforo: { tipo: "nessuno" },
      createdAt: 0,
    };
    expect(() => SetupDocSchema.parse(setup)).toThrow();
  });
});
