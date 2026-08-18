import { fixtureSource } from "@/lib/scraping/sources/fixture";
import type { StatsSource } from "@/lib/scraping/types";

// Fonti attive, condivise da CLI (scripts/scrape/index.ts) e cron
// (api/cron/stats/route.ts) — un solo registro perché i due entry point
// devono sempre girare sulle stesse fonti (§ Scraping statistiche nel piano).
// Un adapter reale va aggiunto qui, in src/lib/scraping/sources/.
export const FONTI_ATTIVE: StatsSource[] = [fixtureSource];
