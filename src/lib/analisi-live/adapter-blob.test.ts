import { describe, expect, it } from "vitest";
import { statoAstaDaBlob } from "@/lib/analisi-live/adapter-blob";
import type { AstaState } from "@/lib/asta/reducer";
import type { Player, SetupDoc } from "@/lib/blob/schemas";

const setup: SetupDoc = {
  id: "asta-1",
  nome: "Test",
  stagione: "2026/27",
  listoneVersionId: "v1",
  modalita: "classic",
  creditiBase: 500,
  slot: { P: 1, D: 1, C: 0, A: 0 },
  squadre: [
    { id: "io", nome: "Io" },
    { id: "rivale", nome: "Rivale FC" },
  ],
  miaSquadraId: "io",
  sforo: { tipo: "nessuno" },
  createdAt: 0,
};

const giocatori: Player[] = [
  { id: 1, nome: "Mio Portiere", squadra: "Roma", ruolo: "P", quotazioneAttuale: 20, quotazioneIniziale: 20 },
  { id: 2, nome: "Preso Da Rivale", squadra: "Milan", ruolo: "D", quotazioneAttuale: 25, quotazioneIniziale: 25 },
  { id: 3, nome: "Libero", squadra: "Lazio", ruolo: "D", quotazioneAttuale: 10, quotazioneIniziale: 10 },
];

const astaState: AstaState = {
  assegnazioni: {
    ev1: { playerId: 1, teamId: "io", price: 50 },
    ev2: { playerId: 2, teamId: "rivale", price: 30 },
  },
};

describe("statoAstaDaBlob", () => {
  it("identifica la mia squadra e gli avversari a partire da miaSquadraId", () => {
    const { stato } = statoAstaDaBlob({ setup, giocatori, astaState, strategy: null, fase: "in-corso" });

    expect(stato.miaSquadra.nome).toBe("Io");
    expect(stato.miaSquadra.rosa).toEqual([{ playerId: 1, prezzoPagato: 50 }]);
    expect(stato.avversari).toEqual([{ nome: "Rivale FC", rosa: [{ playerId: 2, prezzoPagato: 30 }] }]);
  });

  it("esclude dal listone disponibili i giocatori già assegnati", () => {
    const { stato } = statoAstaDaBlob({ setup, giocatori, astaState, strategy: null, fase: "in-corso" });

    const idDisponibili = (stato.listoneDisponibili ?? []).map((g) => g.id);
    expect(idDisponibili).toEqual([3]);
  });

  it("il registro copre TUTTI i giocatori, non solo i disponibili", () => {
    const { registro } = statoAstaDaBlob({ setup, giocatori, astaState, strategy: null, fase: "in-corso" });
    expect(registro.map((g) => g.id).sort()).toEqual([1, 2, 3]);
  });

  it("budgetChiuso riflette sforo.tipo === 'nessuno'", () => {
    const setupSforo: SetupDoc = { ...setup, sforo: { tipo: "a-pagamento", euroPerCredito: 0.1 } };
    const { stato } = statoAstaDaBlob({ setup: setupSforo, giocatori, astaState, strategy: null, fase: "in-corso" });
    expect(stato.lega.budgetChiuso).toBe(false);
  });
});
