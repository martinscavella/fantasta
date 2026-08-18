"use server";

import { requireSession } from "@/lib/auth";
import { updateDossier } from "@/lib/blob/repository";
import type { DossierBloccoGenerato } from "@/lib/ai/schemas";

export type SalvaBloccoDossierResult = { ok: true; giocatoriSalvati: number } | { ok: false; error: string };

/**
 * Fonde un blocco generato via Ponte IA in dossier/{stagione}.json (§ Dossier
 * giocatori nel piano). Rifiuta un blocco incollato nello slot sbagliato
 * confrontando `blockId` — senza questo controllo, incollare la risposta del
 * blocco 3 nello slot del blocco 8 mescolerebbe silenziosamente i dati.
 */
export async function salvaBloccoDossier(
  stagione: string,
  blockIdAtteso: string,
  generato: DossierBloccoGenerato,
): Promise<SalvaBloccoDossierResult> {
  if (!(await requireSession())) return { ok: false, error: "Sessione scaduta, ricarica la pagina" };

  if (generato.blockId !== blockIdAtteso) {
    return {
      ok: false,
      error: `Blocco incollato nello slot sbagliato: atteso "${blockIdAtteso}", ricevuto "${generato.blockId}"`,
    };
  }

  const generatoAt = Date.now();
  await updateDossier(stagione, (current) => {
    const idNuovi = new Set(generato.giocatori.map((g) => g.playerId));
    return {
      stagione,
      giocatori: [
        ...current.giocatori.filter((g) => !idNuovi.has(g.playerId)),
        ...generato.giocatori.map((g) => ({ ...g, generatoAt })),
      ],
    };
  });

  return { ok: true, giocatoriSalvati: generato.giocatori.length };
}
