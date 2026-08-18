import type { PlayerStats } from "@/lib/blob/schemas";

export type RawRow = Record<string, unknown>;

/**
 * Contratto di un adapter per fonte di statistiche (§ Scraping statistiche
 * nel piano). `normalize` ritorna sempre `playerId: null`: l'abbinamento al
 * listone è un passo successivo e separato (vedi risolviPlayerId in
 * pipeline.ts), non responsabilità dell'adapter.
 *
 * Un adapter reale (FBref, Understat, un portale fantacalcistico) deve
 * rispettare da sé il rate limit della propria fonte — vedi le note oneste
 * nel piano: 1 richiesta ogni ~3s per FBref/Sports Reference, User-Agent
 * identificabile, cache locale in `.cache/`.
 */
export interface StatsSource {
  id: string;
  fetch(): Promise<RawRow[]>;
  normalize(rows: RawRow[]): Omit<PlayerStats, "playerId">[];
}
