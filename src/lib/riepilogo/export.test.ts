import { describe, expect, it } from "vitest";
import { esportaAstaJson, esportaRosaCsv } from "@/lib/riepilogo/export";
import type { RigaRosa } from "@/lib/riepilogo/scostamento";
import type { Player } from "@/lib/blob/schemas";

function giocatore(id: number, nome: string, squadra: string): Player {
  return { id, nome, squadra, ruolo: "A", quotazioneAttuale: 10, quotazioneIniziale: 10 };
}

describe("esportaRosaCsv", () => {
  it("produce intestazione e righe nell'ordine della rosa", () => {
    const rosa: RigaRosa[] = [{ player: giocatore(1, "Lautaro", "Inter"), price: 35 }];
    expect(esportaRosaCsv(rosa)).toBe("ruolo,nome,squadra,prezzo\nA,Lautaro,Inter,35");
  });

  it("mette tra virgolette i campi con virgole", () => {
    const rosa: RigaRosa[] = [{ player: giocatore(1, "Cognome, Nome", "Team"), price: 10 }];
    expect(esportaRosaCsv(rosa)).toContain('"Cognome, Nome"');
  });

  it("produce solo l'intestazione per una rosa vuota", () => {
    expect(esportaRosaCsv([])).toBe("ruolo,nome,squadra,prezzo");
  });
});

describe("esportaAstaJson", () => {
  it("include nome asta e rosa mappata", () => {
    const rosa: RigaRosa[] = [{ player: giocatore(1, "Lautaro", "Inter"), price: 35 }];
    const parsed = JSON.parse(esportaAstaJson("Lega Test", rosa));
    expect(parsed.nomeAsta).toBe("Lega Test");
    expect(parsed.rosa).toEqual([{ ruolo: "A", nome: "Lautaro", squadra: "Inter", prezzo: 35 }]);
  });
});
