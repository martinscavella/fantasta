import { describe, expect, it } from "vitest";
import {
  alternativeSimili,
  costruisciTabellaConfronto,
  puntiChiave,
  trendQuotazione,
  type GiocatoreConStat,
} from "@/lib/statistiche/analisi";
import type { Player, PlayerStats, Ruolo } from "@/lib/blob/schemas";

function giocatore(id: number, overrides: Partial<Player> = {}): Player {
  return {
    id,
    nome: `Giocatore ${id}`,
    squadra: "Team",
    ruolo: "A" as Ruolo,
    quotazioneAttuale: 20,
    quotazioneIniziale: 20,
    ...overrides,
  };
}

function stats(overrides: Partial<PlayerStats> = {}): PlayerStats {
  return { playerId: null, nomeOriginale: "x", fonte: "fixture", presenze: 20, ...overrides };
}

function conStat(id: number, statsOverrides: Partial<PlayerStats> | null, playerOverrides: Partial<Player> = {}): GiocatoreConStat {
  return { ...giocatore(id, playerOverrides), stats: statsOverrides === null ? null : stats(statsOverrides) };
}

describe("puntiChiave", () => {
  it("non produce nulla senza statistiche", () => {
    const risultato = puntiChiave(conStat(1, null), []);
    expect(risultato).toEqual({ forza: [], debolezza: [] });
  });

  it("non produce nulla con presenze sotto la soglia minima", () => {
    const risultato = puntiChiave(conStat(1, { presenze: 2, fantamedia: 8 }), []);
    expect(risultato).toEqual({ forza: [], debolezza: [] });
  });

  it("segnala fantamedia tra le migliori del ruolo al top 20%", () => {
    const target = conStat(1, { fantamedia: 9 });
    const peers = [
      conStat(2, { fantamedia: 5 }),
      conStat(3, { fantamedia: 5.5 }),
      conStat(4, { fantamedia: 6 }),
    ];
    const risultato = puntiChiave(target, peers);
    expect(risultato.forza).toContain("Fantamedia tra le migliori del ruolo");
  });

  it("segnala fantamedia sotto la media al bottom 20%", () => {
    const target = conStat(1, { fantamedia: 4 });
    const peers = [
      conStat(2, { fantamedia: 7 }),
      conStat(3, { fantamedia: 7.5 }),
      conStat(4, { fantamedia: 8 }),
    ];
    const risultato = puntiChiave(target, peers);
    expect(risultato.debolezza).toContain("Fantamedia sotto la media del ruolo");
  });

  it("ignora peer di ruoli diversi o sotto la soglia presenze", () => {
    const target = conStat(1, { fantamedia: 9 });
    const peers = [
      conStat(2, { fantamedia: 1, presenze: 20 }, { ruolo: "D" }), // ruolo diverso, ignorato
      conStat(3, { fantamedia: 1, presenze: 1 }), // sotto soglia presenze, ignorato
    ];
    // popolazione confrontabile troppo piccola (< 3): nessun giudizio
    const risultato = puntiChiave(target, peers);
    expect(risultato.forza).not.toContain("Fantamedia tra le migliori del ruolo");
  });

  it("segnala overperformance su xG come rischio regressione", () => {
    const risultato = puntiChiave(conStat(1, { gol: 10, xg: 5 }), []);
    expect(risultato.debolezza).toContain("Rende sopra l'xG: possibile regressione nei prossimi turni");
  });

  it("segnala underperformance su xG come possibile rimbalzo", () => {
    const risultato = puntiChiave(conStat(1, { gol: 2, xg: 8 }), []);
    expect(risultato.forza).toContain("Segna meno di quanto suggerisce l'xG: possibile rimbalzo verso l'alto");
  });

  it("segnala rigorista quando ha rigori segnati", () => {
    const risultato = puntiChiave(conStat(1, { rigoriSegnati: 3 }), []);
    expect(risultato.forza).toContain("Rigorista della squadra");
  });

  it("segnala rischio squalifiche con molti cartellini rispetto alle presenze", () => {
    const risultato = puntiChiave(conStat(1, { presenze: 10, ammonizioni: 6 }), []);
    expect(risultato.debolezza).toContain("Alto rischio squalifiche per cartellini");
  });
});

describe("alternativeSimili", () => {
  it("esclude il giocatore stesso e i ruoli diversi", () => {
    const target = giocatore(1, { ruolo: "A", quotazioneAttuale: 20 });
    const pool = [
      giocatore(1, { ruolo: "A", quotazioneAttuale: 20 }),
      giocatore(2, { ruolo: "D", quotazioneAttuale: 20 }),
      giocatore(3, { ruolo: "A", quotazioneAttuale: 21 }),
    ];
    const risultato = alternativeSimili(target, pool);
    expect(risultato.map((g) => g.id)).toEqual([3]);
  });

  it("preferisce la stessa fascia prima della vicinanza di prezzo", () => {
    const target = giocatore(1, { ruolo: "A", quotazioneAttuale: 32 }); // fascia Top
    const pool = [
      giocatore(2, { ruolo: "A", quotazioneAttuale: 29 }), // Semitop, più vicino in valore assoluto
      giocatore(3, { ruolo: "A", quotazioneAttuale: 40 }), // Top, più lontano ma stessa fascia
    ];
    const risultato = alternativeSimili(target, pool);
    expect(risultato[0].id).toBe(3);
  });

  it("rispetta il limite n", () => {
    const target = giocatore(1, { ruolo: "A", quotazioneAttuale: 20 });
    const pool = Array.from({ length: 10 }, (_, i) => giocatore(i + 2, { ruolo: "A", quotazioneAttuale: 20 + i }));
    expect(alternativeSimili(target, pool, 3)).toHaveLength(3);
  });
});

describe("trendQuotazione", () => {
  it("calcola delta assoluto e percentuale", () => {
    const g = giocatore(1, { quotazioneIniziale: 20, quotazioneAttuale: 25 });
    expect(trendQuotazione(g)).toEqual({ iniziale: 20, attuale: 25, deltaAssoluto: 5, deltaPercentuale: 0.25 });
  });

  it("ritorna deltaPercentuale null quando la quotazione iniziale è 0", () => {
    const g = giocatore(1, { quotazioneIniziale: 0, quotazioneAttuale: 3 });
    expect(trendQuotazione(g).deltaPercentuale).toBeNull();
  });
});

describe("costruisciTabellaConfronto", () => {
  it("allinea i valori per colonna nell'ordine dei giocatori passati", () => {
    const giocatori = [conStat(1, { mediaVoto: 6.5 }), conStat(2, null)];
    const tabella = costruisciTabellaConfronto(giocatori);
    const riga = tabella.find((r) => r.label === "Media voto")!;
    expect(riga.valori).toEqual([6.5, "—"]);
  });
});
