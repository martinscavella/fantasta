import type { PlayerStats } from "@/lib/blob/schemas";
import type { RawRow, StatsSource } from "@/lib/scraping/types";

/**
 * Adapter fittizio, nessuna rete: dimostra l'architettura (fetch -> normalize
 * -> risolviPlayerId) end-to-end senza toccare fonti reali. I nomi imitano
 * apposta lo stile "alla FBref" (accenti, ordine cognome-nome) per esercitare
 * il matching. Un adapter reale (FBref, Understat, un portale
 * fantacalcistico) rimpiazza fetch()/normalize() mantenendo lo stesso
 * contratto StatsSource — vedi la nota sul rate limit in types.ts.
 */
export const fixtureSource: StatsSource = {
  id: "fixture",

  async fetch(): Promise<RawRow[]> {
    return [
      { nome: "Lautaro Martínez", mv: 6.5, fm: 7.8, presenze: 30, gol: 20, assist: 5, xg: 18.4, xa: 4.1 },
      { nome: "Rossi Mario", mv: 6.0, fm: 6.2, presenze: 25, gol: 2, assist: 3 },
      { nome: "Giocatore Sconosciuto Alla Fonte", mv: 6.0, fm: 6.0, presenze: 10 },
    ];
  },

  normalize(rows: RawRow[]): Omit<PlayerStats, "playerId">[] {
    return rows.map((r) => ({
      nomeOriginale: String(r.nome),
      fonte: "fixture",
      mediaVoto: typeof r.mv === "number" ? r.mv : undefined,
      fantamedia: typeof r.fm === "number" ? r.fm : undefined,
      presenze: typeof r.presenze === "number" ? r.presenze : undefined,
      gol: typeof r.gol === "number" ? r.gol : undefined,
      assist: typeof r.assist === "number" ? r.assist : undefined,
      xg: typeof r.xg === "number" ? r.xg : undefined,
      xa: typeof r.xa === "number" ? r.xa : undefined,
    }));
  },
};
