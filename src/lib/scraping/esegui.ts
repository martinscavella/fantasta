import { randomUUID } from "node:crypto";
import { getAliases, getListone, getListoneIndex, putStats, updateStatsIndex } from "@/lib/blob/repository";
import { risolviPlayerId, unisciStats } from "@/lib/scraping/pipeline";
import type { StatsSource } from "@/lib/scraping/types";
import type { PlayerStats } from "@/lib/blob/schemas";

export type EsitoScraping =
  | { ok: true; versionId: string; righe: number; daRivedere: number; fontiFallite: string[] }
  | { ok: false; errore: string };

/**
 * Orchestrazione condivisa da CLI (scripts/scrape/index.ts) e cron
 * (api/cron/stats/route.ts): mai a runtime durante l'asta (§ Scraping
 * statistiche nel piano). Se una fonte fallisce le altre proseguono — gli
 * adapter sono isolati apposta perché una fonte caduta non deve bloccare le
 * altre né rendere l'app inutilizzabile.
 */
export async function eseguiScraping(stagione: string, fonti: StatsSource[]): Promise<EsitoScraping> {
  const indexListone = await getListoneIndex(stagione);
  if (!indexListone?.data.current) {
    return { ok: false, errore: `Nessun listone importato per la stagione "${stagione}"` };
  }
  const listone = await getListone(stagione, indexListone.data.current);
  const giocatori = listone?.data.giocatori ?? [];
  const alias = (await getAliases())?.data.overrides ?? [];

  await updateStatsIndex(stagione, (current) => ({ ...current, lastAttempt: Date.now() }));

  let raccolta: PlayerStats[] = [];
  const fontiFallite: string[] = [];

  for (const fonte of fonti) {
    try {
      const rows = await fonte.fetch();
      const grezze = fonte.normalize(rows);
      const risolte = risolviPlayerId(grezze, giocatori, alias);
      raccolta = unisciStats(raccolta, risolte);
    } catch {
      fontiFallite.push(fonte.id);
    }
  }

  if (fontiFallite.length === fonti.length) {
    return { ok: false, errore: "Tutte le fonti sono fallite, nessuna scrittura effettuata" };
  }

  const versionId = randomUUID();
  await putStats({ versionId, stagione, scrapedAt: Date.now(), giocatori: raccolta });
  await updateStatsIndex(stagione, (current) => ({ ...current, current: versionId, lastSuccess: Date.now() }));

  return {
    ok: true,
    versionId,
    righe: raccolta.length,
    daRivedere: raccolta.filter((r) => r.playerId === null).length,
    fontiFallite,
  };
}
