// Fasce di default alla convenzione standard (§ Preparazione asta nel piano).
// Le soglie personalizzate per lega vivono in StrategyDoc.fasce (Fase 5);
// questa è la classificazione generica usata per la sfoglia del listone.

// Le quotazioni del listone (Qt.A/Qt.I) sono tarate sulla convenzione
// editoriale standard italiana: un budget di 500 crediti a squadra in
// modalità Classic. Una lega con un budget diverso (es. 1100, non raro nelle
// leghe "generose") ha prezzi reali proporzionalmente diversi — senza questo
// fattore, ogni soglia/prezzo derivato dalla quotazione grezza è sballato
// esattamente della stessa proporzione. Vedi anche src/lib/analisi-live/motore.ts.
export const BUDGET_STANDARD_LISTONE = 500;

export function fattoreScalaBudget(creditiBase: number): number {
  return creditiBase / BUDGET_STANDARD_LISTONE;
}

export type FasciaStandard = "Top" | "Semitop" | "Terza fascia" | "Scommesse";

const SOGLIE_STANDARD: { nome: FasciaStandard; min: number }[] = [
  { nome: "Top", min: 30 },
  { nome: "Semitop", min: 15 },
  { nome: "Terza fascia", min: 6 },
  { nome: "Scommesse", min: 1 },
];

// `creditiBase` di default = BUDGET_STANDARD_LISTONE: le pagine non legate a
// un'asta specifica (Data center /listone, generico) non hanno un budget di
// lega da cui scalare, e restano sulla classificazione editoriale standard.
// Le pagine scoped a un'asta (Strategia, Tracker) passano `setup.creditiBase`.
export function fasciaStandard(quotazione: number, creditiBase: number = BUDGET_STANDARD_LISTONE): FasciaStandard | null {
  const scala = fattoreScalaBudget(creditiBase);
  return SOGLIE_STANDARD.find((s) => quotazione >= s.min * scala)?.nome ?? null;
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
// Scalata sul budget reale della lega (vedi fattoreScalaBudget) così le
// soglie iniziali hanno senso anche per un budget molto diverso da 500.
export function fasceStandard(creditiBase: number): { nome: string; sogliaMin: number; sogliaMax: number | null }[] {
  const scala = fattoreScalaBudget(creditiBase);
  return [
    { nome: "Top", sogliaMin: Math.round(30 * scala), sogliaMax: null },
    { nome: "Semitop", sogliaMin: Math.round(15 * scala), sogliaMax: Math.round(29 * scala) },
    { nome: "Terza fascia", sogliaMin: Math.round(6 * scala), sogliaMax: Math.round(14 * scala) },
    { nome: "Scommesse", sogliaMin: 1, sogliaMax: Math.round(5 * scala) },
  ];
}

/**
 * Punto di partenza per il prezzo massimo personale, sovrascrivibile a mano
 * (§ Preparazione asta nel piano): la quotazione di listino (base 500)
 * riportata sul budget reale della lega. Il moltiplicatore di inflazione
 * (vedi sotto) lo aggiusta poi dinamicamente durante l'asta.
 */
export function prezzoMassimoDefault(quotazioneAttuale: number, creditiBase: number): number {
  return Math.round(quotazioneAttuale * fattoreScalaBudget(creditiBase));
}

// --- § Prezzo reattivo nel piano ---------------------------------------------

/**
 * Inflazione teorica (solo budget chiuso): crediti ancora in circolazione
 * nella lega diviso la somma delle quotazioni dei giocatori ancora liberi,
 * normalizzata per `fattoreScalaBudget` così il risultato è "quanto sta
 * pagando la lega oltre quello che il SUO budget implica", non oltre la
 * convenzione a 500 crediti del listino — le due cose coincidono solo se
 * `creditiBase` è 500. >1 = la lega sta pagando sopra quotazione in media,
 * <1 = sotto (una volta tolto l'effetto della sola scala di budget).
 *
 * A sforo questa formula "si rompe" (§ Modalità sforo nel piano): i crediti
 * residui non sono più una quantità fissa da spartirsi, quindi il chiamante
 * non deve usarla in quella modalità — vedi derivaInflazione in asta/derive.ts.
 *
 * null quando non c'è più nessun giocatore libero (fine asta): il
 * denominatore sarebbe 0, e la cifra non avrebbe comunque più senso.
 */
export function inflazioneTeorica(
  creditiResiduiLega: number,
  giocatoriLiberi: { quotazioneAttuale: number }[],
  creditiBase: number,
): number | null {
  const sommaQuotazioni = giocatoriLiberi.reduce((tot, g) => tot + g.quotazioneAttuale, 0);
  if (sommaQuotazioni === 0) return null;
  return creditiResiduiLega / sommaQuotazioni / fattoreScalaBudget(creditiBase);
}

export type AcquistoConcluso = { prezzoPagato: number; quotazione: number; ts: number };

/**
 * Inflazione osservata: media di prezzo_pagato/quotazione sugli acquisti
 * conclusi, pesata verso i più recenti (l'asta si scalda col passare del
 * tempo — § Modalità sforo nel piano), normalizzata per `fattoreScalaBudget`
 * come `inflazioneTeorica` — senza, un budget diverso da 500 farebbe leggere
 * come "inflazione" ciò che è solo scala di budget. Il peso cresce con
 * l'ordine cronologico (1, 2, 3, …) anziché col tempo reale trascorso: più
 * robusto a ritmi di assegnazione irregolari (un giocatore chiuso in 5s, un
 * altro in 2 minuti).
 *
 * Funziona in entrambe le modalità: a budget chiuso è una conferma incrociata
 * della formula teorica, a sforo è l'unica misura disponibile.
 *
 * null quando non ci sono ancora acquisti validi (quotazione > 0) da cui dedurla.
 */
export function inflazioneOsservata(acquisti: AcquistoConcluso[], creditiBase: number): number | null {
  const validi = acquisti.filter((a) => a.quotazione > 0);
  if (validi.length === 0) return null;

  const scala = fattoreScalaBudget(creditiBase);
  const ordinati = [...validi].sort((a, b) => a.ts - b.ts);
  let sommaPesata = 0;
  let sommaPesi = 0;
  ordinati.forEach((a, i) => {
    const peso = i + 1;
    sommaPesata += peso * (a.prezzoPagato / a.quotazione / scala);
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
