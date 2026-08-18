import { abbinaGiocatore, type CandidatoMatch } from "@/lib/matching";
import type { AliasOverride, Player, PlayerStats } from "@/lib/blob/schemas";

/**
 * Risolve playerId per ogni riga grezza confrontando nomeOriginale col
 * listone, rispettando prima gli alias già decisi a mano (stats/aliases.json).
 * Le righe non risolte restano con playerId null: finiranno nella coda di
 * revisione in UI (§ Scraping statistiche nel piano).
 */
export function risolviPlayerId(
  statsGrezze: Omit<PlayerStats, "playerId">[],
  giocatori: Player[],
  aliasEsistenti: AliasOverride[],
): PlayerStats[] {
  const candidati: CandidatoMatch[] = giocatori.map((g) => ({ id: g.id, nome: g.nome }));
  const aliasPerChiave = new Map(aliasEsistenti.map((a) => [`${a.fonte}::${a.nomeOriginale}`, a.playerId]));

  return statsGrezze.map((s) => {
    const aliasDeciso = aliasPerChiave.get(`${s.fonte}::${s.nomeOriginale}`);
    const risultato = abbinaGiocatore(s.nomeOriginale, candidati, aliasDeciso);
    const playerId = risultato.metodo === "esatto" || risultato.metodo === "alias" || risultato.metodo === "fuzzy"
      ? risultato.playerId
      : null;
    return { ...s, playerId };
  });
}

/**
 * Unisce i risultati di più fonti (o di run successivi) in un unico set di
 * PlayerStats: le righe abbinate a uno stesso giocatore si fondono (i campi
 * della fonte più recente vincono sui precedenti), le righe non abbinate
 * restano separate — sono materiale per la coda di revisione, non vanno
 * scartate né confuse tra loro.
 */
export function unisciStats(esistenti: PlayerStats[], nuovi: PlayerStats[]): PlayerStats[] {
  const perPlayerId = new Map<number, PlayerStats>();
  const senzaPlayerId: PlayerStats[] = [];

  for (const s of esistenti) {
    if (s.playerId !== null) perPlayerId.set(s.playerId, s);
    else senzaPlayerId.push(s);
  }
  for (const s of nuovi) {
    if (s.playerId === null) {
      senzaPlayerId.push(s);
      continue;
    }
    const attuale = perPlayerId.get(s.playerId);
    perPlayerId.set(s.playerId, attuale ? { ...attuale, ...s, playerId: s.playerId } : s);
  }

  return [...perPlayerId.values(), ...senzaPlayerId];
}
