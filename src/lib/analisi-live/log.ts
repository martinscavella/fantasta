import { promises as fs } from "node:fs";
import path from "node:path";
import type { GiocatoreInfo } from "@/lib/analisi-live/motore";
import type { StatoAsta } from "@/lib/analisi-live/schemas";

// §10 della spec — "Persisti ogni StatoAsta ricevuto con timestamp: dopo
// l'asta servono per calibrare i coefficienti di §4.4 sui prezzi reali
// osservati" + "Log strutturato... durante un'asta non c'è tempo di
// debuggare: serve il post-mortem." Si persiste anche il registro giocatori
// passato dal chiamante: il contratto StatoAsta da solo non basta a
// ricostruire ruolo/quotazione dei giocatori già assegnati (vedi motore.ts).

const DIR_STORICO = path.join(process.cwd(), ".data", "analisi-live", "storico");

export type VoceStorico = { ricevutoAt: number; stato: StatoAsta; registro: GiocatoreInfo[] };

/** Fire-and-forget di proposito: il logging non deve mai aggiungere latenza a un'analisi in corso. */
export async function registraStatoAsta(stato: StatoAsta, registro: GiocatoreInfo[]): Promise<void> {
  try {
    await fs.mkdir(DIR_STORICO, { recursive: true });
    const nomeFile = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
    const voce: VoceStorico = { ricevutoAt: Date.now(), stato, registro };
    await fs.writeFile(path.join(DIR_STORICO, nomeFile), JSON.stringify(voce), "utf-8");
  } catch {
    // Vedi §5.4 nello stesso spirito: il post-mortem non deve mai rompere il percorso live.
  }
}

export async function leggiStorico(): Promise<VoceStorico[]> {
  try {
    const file = await fs.readdir(DIR_STORICO);
    const contenuti = await Promise.all(
      file.filter((f) => f.endsWith(".json")).map((f) => fs.readFile(path.join(DIR_STORICO, f), "utf-8")),
    );
    return contenuti.map((c) => JSON.parse(c) as VoceStorico);
  } catch {
    return [];
  }
}
