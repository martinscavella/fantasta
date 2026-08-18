import { describe, expect, it } from "vitest";
import { costruisciBlocchi } from "@/lib/ai/prompts/dossier";
import type { Player } from "@/lib/blob/schemas";

function giocatore(id: number, quotazione: number): Player {
  return { id, nome: `G${id}`, squadra: "Team", ruolo: "A", quotazioneAttuale: quotazione, quotazioneIniziale: quotazione };
}

describe("costruisciBlocchi", () => {
  it("divide in blocchi della dimensione richiesta", () => {
    const giocatori = Array.from({ length: 12 }, (_, i) => giocatore(i + 1, 20));
    const blocchi = costruisciBlocchi(giocatori, 5);
    expect(blocchi.map((b) => b.giocatori.length)).toEqual([5, 5, 2]);
  });

  it("assegna blockId stabili nell'ordine dei blocchi", () => {
    const giocatori = Array.from({ length: 6 }, (_, i) => giocatore(i + 1, 20));
    const blocchi = costruisciBlocchi(giocatori, 5);
    expect(blocchi.map((b) => b.blockId)).toEqual(["blocco-1", "blocco-2"]);
  });

  it("ordina per quotazione decrescente prima di dividere in blocchi", () => {
    const giocatori = [giocatore(1, 10), giocatore(2, 40), giocatore(3, 25)];
    const blocchi = costruisciBlocchi(giocatori, 5);
    expect(blocchi[0].giocatori.map((g) => g.id)).toEqual([2, 3, 1]);
  });

  it("ritorna nessun blocco per una lista vuota", () => {
    expect(costruisciBlocchi([], 5)).toEqual([]);
  });
});
