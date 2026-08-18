// Fasce di default alla convenzione standard (§ Preparazione asta nel piano).
// Le soglie personalizzate per lega vivono in StrategyDoc.fasce (Fase 5);
// questa è la classificazione generica usata per la sfoglia del listone.

export type FasciaStandard = "Top" | "Semitop" | "Terza fascia" | "Scommesse";

const SOGLIE_STANDARD: { nome: FasciaStandard; min: number }[] = [
  { nome: "Top", min: 30 },
  { nome: "Semitop", min: 15 },
  { nome: "Terza fascia", min: 6 },
  { nome: "Scommesse", min: 1 },
];

// null = fuori quotazione (0 crediti), nessuna fascia applicabile.
export function fasciaStandard(quotazione: number): FasciaStandard | null {
  return SOGLIE_STANDARD.find((s) => quotazione >= s.min)?.nome ?? null;
}

// Variante Badge per fascia, condivisa tra listone e scheda giocatore (§ Data
// center nel piano) — un'unica fonte per non far divergere i colori tra le due UI.
export const FASCIA_BADGE_VARIANT: Record<FasciaStandard, "default" | "secondary" | "outline"> = {
  Top: "default",
  Semitop: "secondary",
  "Terza fascia": "outline",
  Scommesse: "outline",
};

// Seed per StrategyDoc.fasce: stessa convenzione, nella forma dello schema
// Fascia (sogliaMin/sogliaMax), pronta per essere modificata dall'utente.
export const FASCE_STANDARD: { nome: string; sogliaMin: number; sogliaMax: number | null }[] = [
  { nome: "Top", sogliaMin: 30, sogliaMax: null },
  { nome: "Semitop", sogliaMin: 15, sogliaMax: 29 },
  { nome: "Terza fascia", sogliaMin: 6, sogliaMax: 14 },
  { nome: "Scommesse", sogliaMin: 1, sogliaMax: 5 },
];

// Punto di partenza per il prezzo massimo personale, sovrascrivibile a mano
// (§ Preparazione asta nel piano). Il moltiplicatore di inflazione (vedi sotto)
// lo aggiusta dinamicamente durante l'asta.
export function prezzoMassimoDefault(quotazioneAttuale: number): number {
  return quotazioneAttuale;
}

// --- § Prezzo reattivo nel piano ---------------------------------------------

/**
 * Inflazione teorica (solo budget chiuso): crediti ancora in circolazione
 * nella lega diviso la somma delle quotazioni dei giocatori ancora liberi.
 * >1 = la lega sta pagando sopra quotazione in media, <1 = sotto.
 *
 * A sforo questa formula "si rompe" (§ Modalità sforo nel piano): i crediti
 * residui non sono più una quantità fissa da spartirsi, quindi il chiamante
 * non deve usarla in quella modalità — vedi derivaInflazione in asta/derive.ts.
 *
 * null quando non c'è più nessun giocatore libero (fine asta): il
 * denominatore sarebbe 0, e la cifra non avrebbe comunque più senso.
 */
export function inflazioneTeorica(creditiResiduiLega: number, giocatoriLiberi: { quotazioneAttuale: number }[]): number | null {
  const sommaQuotazioni = giocatoriLiberi.reduce((tot, g) => tot + g.quotazioneAttuale, 0);
  if (sommaQuotazioni === 0) return null;
  return creditiResiduiLega / sommaQuotazioni;
}

export type AcquistoConcluso = { prezzoPagato: number; quotazione: number; ts: number };

/**
 * Inflazione osservata: media di prezzo_pagato/quotazione sugli acquisti
 * conclusi, pesata verso i più recenti (l'asta si scalda col passare del
 * tempo — § Modalità sforo nel piano). Il peso cresce con l'ordine cronologico
 * (1, 2, 3, …) anziché col tempo reale trascorso: più robusto a ritmi di
 * assegnazione irregolari (un giocatore chiuso in 5s, un altro in 2 minuti).
 *
 * Funziona in entrambe le modalità: a budget chiuso è una conferma incrociata
 * della formula teorica, a sforo è l'unica misura disponibile.
 *
 * null quando non ci sono ancora acquisti validi (quotazione > 0) da cui dedurla.
 */
export function inflazioneOsservata(acquisti: AcquistoConcluso[]): number | null {
  const validi = acquisti.filter((a) => a.quotazione > 0);
  if (validi.length === 0) return null;

  const ordinati = [...validi].sort((a, b) => a.ts - b.ts);
  let sommaPesata = 0;
  let sommaPesi = 0;
  ordinati.forEach((a, i) => {
    const peso = i + 1;
    sommaPesata += peso * (a.prezzoPagato / a.quotazione);
    sommaPesi += peso;
  });
  return sommaPesata / sommaPesi;
}

/**
 * Prezzo massimo personale corretto per l'inflazione corrente. Senza
 * un'inflazione calcolabile (asta appena iniziata, o finita) resta invariato.
 */
export function prezzoReattivo(prezzoBase: number, inflazione: number | null): number {
  if (inflazione === null) return prezzoBase;
  return Math.round(prezzoBase * inflazione);
}
