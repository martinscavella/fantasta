// Coefficienti tarabili del motore deterministico (§4.4 e §10 della spec:
// "documenta questi coefficienti come tarabili... andranno calibrati dopo la
// prima asta reale"). scripts/analisi-live/calibra.ts rilegge lo storico delle
// StatoAsta ricevute e propone nuovi valori per questo file.

export const FASCE_QUOTAZIONE = [
  { fascia: "top", quotMin: 25, quotMax: null as number | null },
  { fascia: "semi-top", quotMin: 15, quotMax: 24 },
  { fascia: "medi", quotMin: 8, quotMax: 14 },
  { fascia: "low-cost", quotMin: 0, quotMax: 7 },
] as const;

// Sotto questa soglia di campione, il moltiplicatore di fascia e' marcato
// inaffidabile (§4.2): il codice lo passa comunque, il prompt istruisce il
// modello a non basarci decisioni forti.
export const CAMPIONE_MINIMO_AFFIDABILE = 3;

// §4.4 — fattoreScarsita(p) = clamp(1 + K_RIVALI*(nRivali-1) - K_ALTERNATIVE*log2(1+alternative), MIN, MAX)
export const SCARSITA_COEFF_RIVALI = 0.12;
export const SCARSITA_COEFF_ALTERNATIVE = 0.1;
export const SCARSITA_MIN = 0.6;
export const SCARSITA_MAX = 2.0;

// "alternativeVicine(p)": finestra di quotazione entro cui un giocatore libero
// dello stesso ruolo conta come sostituto vicino.
export const FINESTRA_ALTERNATIVE_VICINE = 0.2;
