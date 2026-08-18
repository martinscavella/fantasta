import { describe, expect, it } from "vitest";
import { risolviPlayerId, unisciStats } from "@/lib/scraping/pipeline";
import type { AliasOverride, Player, PlayerStats } from "@/lib/blob/schemas";

function giocatore(id: number, nome: string): Player {
  return { id, nome, squadra: "Team", ruolo: "C", quotazioneAttuale: 10, quotazioneIniziale: 10 };
}

function statsGrezze(nomeOriginale: string, fonte = "fixture"): Omit<PlayerStats, "playerId"> {
  return { nomeOriginale, fonte, mediaVoto: 6 };
}

describe("risolviPlayerId", () => {
  it("abbina per nome esatto (a meno di accenti/ordine)", () => {
    const giocatori = [giocatore(1, "Lautaro Martinez")];
    const risultato = risolviPlayerId([statsGrezze("Martínez Lautaro")], giocatori, []);
    expect(risultato[0].playerId).toBe(1);
  });

  it("lascia playerId null per un nome senza corrispondenza", () => {
    const giocatori = [giocatore(1, "Lautaro Martinez")];
    const risultato = risolviPlayerId([statsGrezze("Nome Sconosciuto")], giocatori, []);
    expect(risultato[0].playerId).toBeNull();
  });

  it("rispetta un alias salvato in precedenza, anche in conflitto col match automatico", () => {
    const giocatori = [giocatore(1, "Lautaro Martinez"), giocatore(2, "Altro Giocatore")];
    const alias: AliasOverride[] = [{ nomeOriginale: "Martínez Lautaro", fonte: "fixture", playerId: 2, decidedAt: 0 }];
    const risultato = risolviPlayerId([statsGrezze("Martínez Lautaro")], giocatori, alias);
    expect(risultato[0].playerId).toBe(2); // non 1, che sarebbe il match automatico
  });

  it("un alias 'non rilevante' (playerId null) tiene la riga fuori dall'abbinamento", () => {
    const giocatori = [giocatore(1, "Lautaro Martinez")];
    const alias: AliasOverride[] = [{ nomeOriginale: "Lautaro Martinez", fonte: "fixture", playerId: null, decidedAt: 0 }];
    const risultato = risolviPlayerId([statsGrezze("Lautaro Martinez")], giocatori, alias);
    expect(risultato[0].playerId).toBeNull();
  });

  it("un alias di un'altra fonte con lo stesso nome non si applica", () => {
    const giocatori = [giocatore(1, "Lautaro Martinez")];
    const alias: AliasOverride[] = [{ nomeOriginale: "Lautaro Martinez", fonte: "altra-fonte", playerId: null, decidedAt: 0 }];
    const risultato = risolviPlayerId([statsGrezze("Lautaro Martinez", "fixture")], giocatori, alias);
    expect(risultato[0].playerId).toBe(1); // il match esatto normale si applica comunque
  });
});

describe("unisciStats", () => {
  it("fonde i campi di righe abbinate allo stesso giocatore", () => {
    const esistenti: PlayerStats[] = [{ playerId: 1, nomeOriginale: "Rossi", fonte: "base", mediaVoto: 6, presenze: 20 }];
    const nuovi: PlayerStats[] = [{ playerId: 1, nomeOriginale: "Rossi", fonte: "avanzate", xg: 5.2 }];
    const risultato = unisciStats(esistenti, nuovi);
    expect(risultato).toHaveLength(1);
    expect(risultato[0]).toMatchObject({ mediaVoto: 6, presenze: 20, xg: 5.2 });
  });

  it("le righe senza playerId restano separate, non vengono confuse tra loro", () => {
    const esistenti: PlayerStats[] = [{ playerId: null, nomeOriginale: "Sconosciuto Uno", fonte: "base" }];
    const nuovi: PlayerStats[] = [{ playerId: null, nomeOriginale: "Sconosciuto Due", fonte: "base" }];
    const risultato = unisciStats(esistenti, nuovi);
    expect(risultato).toHaveLength(2);
  });

  it("un campo della fonte più recente sovrascrive quello della fonte precedente", () => {
    const esistenti: PlayerStats[] = [{ playerId: 1, nomeOriginale: "Rossi", fonte: "base", mediaVoto: 5 }];
    const nuovi: PlayerStats[] = [{ playerId: 1, nomeOriginale: "Rossi", fonte: "base", mediaVoto: 6.5 }];
    const risultato = unisciStats(esistenti, nuovi);
    expect(risultato[0].mediaVoto).toBe(6.5);
  });
});
