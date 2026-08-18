import { fasciaStandard } from "@/lib/pricing";
import type { Player, PlayerStats } from "@/lib/blob/schemas";

// § Data center nel piano — "scheda giocatore: trend per giornata, xG/xA,
// punti di forza/debolezza, alternative simili, confronto". Il modello dati
// attuale (vedi PlayerStatsSchema) porta solo aggregati di stagione: nessun
// adapter di scraping produce un breakdown per giornata, e StatsIndex non
// conserva versioni storiche per ricostruirlo indirettamente. Il "trend" qui
// è quindi limitato a quotazione iniziale -> attuale (unico dato longitudinale
// disponibile); un vero trend per giornata richiede prima di estendere
// StatsSource con dati match-by-match, che oggi nessuna fonte fornisce.

export type GiocatoreConStat = Player & { stats: PlayerStats | null };

// Sotto questa soglia il campione di presenze è troppo piccolo per un
// confronto affidabile: si esclude sia il giocatore analizzato sia i peer
// usati come popolazione di riferimento.
const PRESENZE_MINIME_ANALISI = 5;

function percentile(valore: number, popolazione: number[]): number {
  if (popolazione.length === 0) return 0.5;
  const sotto = popolazione.filter((v) => v <= valore).length;
  return sotto / popolazione.length;
}

export type PuntiChiave = { forza: string[]; debolezza: string[] };

/**
 * Deriva punti di forza/debolezza confrontando le statistiche del giocatore
 * con i peer dello stesso ruolo (vedi § Data center nel piano). Soglie
 * euristiche, non un modello statistico: bastano a dare un primo segnale in
 * asta, non sostituiscono il giudizio.
 */
export function puntiChiave(giocatore: GiocatoreConStat, peers: GiocatoreConStat[]): PuntiChiave {
  const forza: string[] = [];
  const debolezza: string[] = [];
  const stats = giocatore.stats;
  if (!stats || (stats.presenze ?? 0) < PRESENZE_MINIME_ANALISI) {
    return { forza, debolezza };
  }

  const confrontabili = peers.filter(
    (p) => p.id !== giocatore.id && p.ruolo === giocatore.ruolo && (p.stats?.presenze ?? 0) >= PRESENZE_MINIME_ANALISI,
  );

  if (stats.fantamedia !== undefined) {
    const popolazione = confrontabili.map((p) => p.stats!.fantamedia).filter((v): v is number => v !== undefined);
    if (popolazione.length >= 3) {
      const pct = percentile(stats.fantamedia, popolazione);
      if (pct >= 0.8) forza.push("Fantamedia tra le migliori del ruolo");
      else if (pct <= 0.2) debolezza.push("Fantamedia sotto la media del ruolo");
    }
  }

  if (stats.presenze !== undefined) {
    const popolazione = confrontabili.map((p) => p.stats!.presenze).filter((v): v is number => v !== undefined);
    if (popolazione.length >= 3 && percentile(stats.presenze, popolazione) <= 0.2) {
      debolezza.push("Presenze limitate: rischio rotazione o infortuni");
    }
  }

  if (stats.gol !== undefined && stats.xg !== undefined) {
    const scarto = stats.gol - stats.xg;
    if (scarto <= -2) forza.push("Segna meno di quanto suggerisce l'xG: possibile rimbalzo verso l'alto");
    else if (scarto >= 3) debolezza.push("Rende sopra l'xG: possibile regressione nei prossimi turni");
  }

  if (stats.assist !== undefined && stats.xa !== undefined) {
    const scarto = stats.assist - stats.xa;
    if (scarto <= -2) forza.push("Assist sotto l'xA: possibile rimbalzo verso l'alto");
    else if (scarto >= 3) debolezza.push("Assist sopra l'xA: possibile regressione nei prossimi turni");
  }

  if ((stats.rigoriSegnati ?? 0) > 0) forza.push("Rigorista della squadra");

  const cartelliniPesati = (stats.ammonizioni ?? 0) + (stats.espulsioni ?? 0) * 2;
  const presenze = stats.presenze ?? 0;
  if (presenze > 0 && cartelliniPesati / presenze >= 0.5) {
    debolezza.push("Alto rischio squalifiche per cartellini");
  }

  return { forza, debolezza };
}

/**
 * Alternative per lo stesso ruolo: priorità alla stessa fascia di prezzo
 * (§ Preparazione asta), poi ordinate per vicinanza di quotazione. È un
 * criterio deliberatamente semplice — non usa le statistiche, che possono
 * mancare per molti giocatori — pensato per rispondere a "chi altro posso
 * prendere se questo mi scappa".
 */
export function alternativeSimili(giocatore: Player, tuttiGiocatori: Player[], n = 5): Player[] {
  const fasciaTarget = fasciaStandard(giocatore.quotazioneAttuale);
  const stessoRuolo = tuttiGiocatori.filter((g) => g.id !== giocatore.id && g.ruolo === giocatore.ruolo);

  return [...stessoRuolo]
    .sort((a, b) => {
      const stessaFasciaA = fasciaStandard(a.quotazioneAttuale) === fasciaTarget ? 0 : 1;
      const stessaFasciaB = fasciaStandard(b.quotazioneAttuale) === fasciaTarget ? 0 : 1;
      if (stessaFasciaA !== stessaFasciaB) return stessaFasciaA - stessaFasciaB;
      return (
        Math.abs(a.quotazioneAttuale - giocatore.quotazioneAttuale) -
        Math.abs(b.quotazioneAttuale - giocatore.quotazioneAttuale)
      );
    })
    .slice(0, n);
}

export type TrendQuotazione = {
  iniziale: number;
  attuale: number;
  deltaAssoluto: number;
  // null quando la quotazione iniziale è 0: la variazione percentuale non è definita.
  deltaPercentuale: number | null;
};

export function trendQuotazione(giocatore: Player): TrendQuotazione {
  const deltaAssoluto = giocatore.quotazioneAttuale - giocatore.quotazioneIniziale;
  return {
    iniziale: giocatore.quotazioneIniziale,
    attuale: giocatore.quotazioneAttuale,
    deltaAssoluto,
    deltaPercentuale: giocatore.quotazioneIniziale === 0 ? null : deltaAssoluto / giocatore.quotazioneIniziale,
  };
}

export type RigaConfronto = { label: string; valori: (string | number)[] };

/**
 * Tabella confronto fino a 4 giocatori affiancati (§ Data center nel piano).
 * Nessun limite imposto qui sul numero di giocatori: è la UI a fermarsi a 4.
 */
export function costruisciTabellaConfronto(giocatori: GiocatoreConStat[]): RigaConfronto[] {
  const fmt = (v: number | undefined) => v ?? "—";
  return [
    { label: "Ruolo", valori: giocatori.map((g) => g.ruolo) },
    { label: "Squadra", valori: giocatori.map((g) => g.squadra) },
    { label: "Quotazione", valori: giocatori.map((g) => g.quotazioneAttuale) },
    { label: "Media voto", valori: giocatori.map((g) => fmt(g.stats?.mediaVoto)) },
    { label: "Fantamedia", valori: giocatori.map((g) => fmt(g.stats?.fantamedia)) },
    { label: "Presenze", valori: giocatori.map((g) => fmt(g.stats?.presenze)) },
    { label: "Gol", valori: giocatori.map((g) => fmt(g.stats?.gol)) },
    { label: "Assist", valori: giocatori.map((g) => fmt(g.stats?.assist)) },
    { label: "xG", valori: giocatori.map((g) => fmt(g.stats?.xg)) },
    { label: "xA", valori: giocatori.map((g) => fmt(g.stats?.xa)) },
    { label: "Ammonizioni", valori: giocatori.map((g) => fmt(g.stats?.ammonizioni)) },
    { label: "Espulsioni", valori: giocatori.map((g) => fmt(g.stats?.espulsioni)) },
  ];
}
