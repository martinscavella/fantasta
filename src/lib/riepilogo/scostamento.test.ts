import { describe, expect, it } from "vitest";
import { scostamentoStrategia, spesaPerRuolo, type RigaRosa } from "@/lib/riepilogo/scostamento";
import type { Player } from "@/lib/blob/schemas";

function giocatore(id: number, ruolo: Player["ruolo"]): Player {
  return { id, nome: `G${id}`, squadra: "Team", ruolo, quotazioneAttuale: 10, quotazioneIniziale: 10 };
}

describe("spesaPerRuolo", () => {
  it("somma la spesa per ruolo dalla rosa", () => {
    const rosa: RigaRosa[] = [
      { player: giocatore(1, "P"), price: 20 },
      { player: giocatore(2, "D"), price: 15 },
      { player: giocatore(3, "D"), price: 10 },
      { player: giocatore(4, "A"), price: 50 },
    ];
    expect(spesaPerRuolo(rosa)).toEqual({ P: 20, D: 25, C: 0, A: 50 });
  });

  it("ritorna tutti zero per una rosa vuota", () => {
    expect(spesaPerRuolo([])).toEqual({ P: 0, D: 0, C: 0, A: 0 });
  });
});

describe("scostamentoStrategia", () => {
  it("calcola lo scostamento positivo e negativo per reparto", () => {
    const pianificato = { P: 20, D: 100, C: 150, A: 230 };
    const effettivo = { P: 25, D: 80, C: 150, A: 245 };
    const risultato = scostamentoStrategia(pianificato, effettivo);
    expect(risultato).toEqual([
      { ruolo: "P", pianificato: 20, effettivo: 25, scostamento: 5 },
      { ruolo: "D", pianificato: 100, effettivo: 80, scostamento: -20 },
      { ruolo: "C", pianificato: 150, effettivo: 150, scostamento: 0 },
      { ruolo: "A", pianificato: 230, effettivo: 245, scostamento: 15 },
    ]);
  });
});
