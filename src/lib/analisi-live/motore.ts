import {
  CAMPIONE_MINIMO_AFFIDABILE,
  FASCE_QUOTAZIONE,
  FINESTRA_ALTERNATIVE_VICINE,
  SCARSITA_COEFF_ALTERNATIVE,
  SCARSITA_COEFF_RIVALI,
  SCARSITA_MAX,
  SCARSITA_MIN,
} from "@/lib/analisi-live/config";
import type { Lega, RuoloAsta, SquadraInput, StatoAsta } from "@/lib/analisi-live/schemas";

// [A] Motore deterministico (§4 della spec Analisi Asta Live): "L'aritmetica la
// fa il codice. Il giudizio lo fa il modello." Modulo puro, senza I/O — ogni
// funzione qui e' testabile senza rete e senza mock del modello. E' la parte
// che deve essere corretta al 100% (§10 della spec).

export const RUOLI: RuoloAsta[] = ["P", "D", "C", "A"];

function zeroPerRuolo(): Record<RuoloAsta, number> {
  return { P: 0, D: 0, C: 0, A: 0 };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// --- Registro giocatori -------------------------------------------------------
// Il contratto d'ingresso (StatoAsta) porta ruolo/club/quotazione SOLO per i
// giocatori ancora disponibili (listoneDisponibili, gia' potato — §3.1 della
// spec). Per calcolare slotOccupati e blocchiClub sulle rose (mia + avversari)
// servono anche i giocatori GIA' assegnati, che il contratto non porta (sarebbe
// un doppione del listone completo dentro ogni richiesta). Il chiamante (che ha
// il listone completo su Blob) risolve un registro con TUTTI i playerId citati
// in StatoAsta e lo passa separatamente al motore — vedi DECISIONI.md.
export type GiocatoreInfo = { id: number; ruolo: RuoloAsta; nome: string; club: string; quotazione: number };
export type RegistroGiocatori = ReadonlyMap<number, GiocatoreInfo>;

export function costruisciRegistro(giocatori: GiocatoreInfo[]): RegistroGiocatori {
  return new Map(giocatori.map((g) => [g.id, g]));
}

/** playerId citati in rosa (mia + avversari) assenti dal registro — usato da valida.ts. */
export function playerIdMancantiDalRegistro(stato: StatoAsta, registro: RegistroGiocatori): number[] {
  const mancanti = new Set<number>();
  for (const riga of stato.miaSquadra.rosa) if (!registro.has(riga.playerId)) mancanti.add(riga.playerId);
  for (const squadra of stato.avversari) for (const riga of squadra.rosa) if (!registro.has(riga.playerId)) mancanti.add(riga.playerId);
  return [...mancanti];
}

// --- §4.1 — per ogni squadra ---------------------------------------------------

export type SquadraDerivata = {
  nome: string;
  creditiSpesi: number;
  creditiResidui: number;
  slotOccupati: Record<RuoloAsta, number>;
  slotResidui: Record<RuoloAsta, number>;
  slotResiduiTotali: number;
  potereAcquistoMax: number;
  creditiPerSlotResiduo: number;
  repartiChiusi: RuoloAsta[];
  blocchiClub: { club: string; conteggio: number }[];
};

export function derivaSquadra(squadra: SquadraInput, lega: Lega, registro: RegistroGiocatori): SquadraDerivata {
  const creditiSpesi = squadra.rosa.reduce((tot, r) => tot + r.prezzoPagato, 0);
  const creditiResidui = lega.budget - creditiSpesi;

  const slotOccupati = zeroPerRuolo();
  const clubCount = new Map<string, number>();
  for (const riga of squadra.rosa) {
    const info = registro.get(riga.playerId);
    if (!info) {
      throw new Error(`Giocatore ${riga.playerId} nella rosa di "${squadra.nome}" non è presente nel registro giocatori`);
    }
    slotOccupati[info.ruolo]++;
    clubCount.set(info.club, (clubCount.get(info.club) ?? 0) + 1);
  }

  const slotResidui = zeroPerRuolo();
  const repartiChiusi: RuoloAsta[] = [];
  let slotResiduiTotali = 0;
  for (const ruolo of RUOLI) {
    const residui = Math.max(0, lega.slot[ruolo] - slotOccupati[ruolo]);
    slotResidui[ruolo] = residui;
    slotResiduiTotali += residui;
    if (residui === 0) repartiChiusi.push(ruolo);
  }

  // Caso limite: con un solo slot residuo l'offerta massima e' l'intero
  // credito residuo (crediti - 0); a rosa completa nessun ulteriore acquisto
  // e' ammesso (0), non la formula "a vuoto" che darebbe crediti+1.
  const potereAcquistoMax = slotResiduiTotali === 0 ? 0 : Math.max(0, creditiResidui - (slotResiduiTotali - 1));
  const creditiPerSlotResiduo = slotResiduiTotali > 0 ? creditiResidui / slotResiduiTotali : 0;

  const blocchiClub = [...clubCount.entries()]
    .filter(([, conteggio]) => conteggio >= 2)
    .map(([club, conteggio]) => ({ club, conteggio }))
    .sort((a, b) => b.conteggio - a.conteggio);

  return {
    nome: squadra.nome,
    creditiSpesi,
    creditiResidui,
    slotOccupati,
    slotResidui,
    slotResiduiTotali,
    potereAcquistoMax,
    creditiPerSlotResiduo,
    repartiChiusi,
    blocchiClub,
  };
}

export type DiscrepanzaCreditiDichiarati = { nome: string; dichiarati: number; calcolati: number };

/** §3.1 — confronto col valore dichiarato dall'utente, se presente. */
export function trovaDiscrepanzeCreditiDichiarati(
  stato: StatoAsta,
  mia: SquadraDerivata,
  avversari: { nome: string; derivata: SquadraDerivata }[],
): DiscrepanzaCreditiDichiarati[] {
  const risultato: DiscrepanzaCreditiDichiarati[] = [];
  const dichiaratiMia = stato.miaSquadra.creditiResiduiDichiarati;
  if (dichiaratiMia != null && dichiaratiMia !== mia.creditiResidui) {
    risultato.push({ nome: stato.miaSquadra.nome, dichiarati: dichiaratiMia, calcolati: mia.creditiResidui });
  }
  stato.avversari.forEach((squadra, i) => {
    const dichiarati = squadra.creditiResiduiDichiarati;
    if (dichiarati != null && dichiarati !== avversari[i].derivata.creditiResidui) {
      risultato.push({ nome: squadra.nome, dichiarati, calcolati: avversari[i].derivata.creditiResidui });
    }
  });
  return risultato;
}

// --- §4.2 — inflazione osservata + §4.3 pressione di mercato -------------------

export type FasciaMoltiplicatore = {
  fascia: string;
  quotMin: number;
  quotMax: number | null;
  moltiplicatore: number;
  campione: number;
  affidabile: boolean;
};

export type MercatoDerivato = {
  // null quando nessun acquisto e' ancora concluso in lega (§4.2): il
  // denominatore del rapporto-delle-somme sarebbe 0. La riconciliazione [D]
  // lo sostituisce con 0 in uscita, dove lo schema non ammette null.
  moltiplicatoreMedio: number | null;
  moltiplicatorePerFascia: FasciaMoltiplicatore[];
  creditiResiduiLega: number;
  slotResiduiLega: number;
  prezzoMedioResiduo: number;
  indicePressione: { ruolo: RuoloAsta; creditiAttivi: number; slotResidui: number; creditiPerSlot: number }[];
};

type SquadraConDerivata = { squadra: SquadraInput; derivata: SquadraDerivata };

export function calcolaMercato(registro: RegistroGiocatori, squadre: SquadraConDerivata[]): MercatoDerivato {
  type Acquisto = { prezzoPagato: number; quotazione: number };
  const acquisti: Acquisto[] = [];
  for (const { squadra } of squadre) {
    for (const riga of squadra.rosa) {
      const info = registro.get(riga.playerId);
      // Già validato a monte da valida.ts — qui si ignora silenziosamente
      // solo per robustezza difensiva, non e' il percorso atteso.
      if (!info) continue;
      acquisti.push({ prezzoPagato: riga.prezzoPagato, quotazione: info.quotazione });
    }
  }

  // Rapporto delle somme, non media dei rapporti (§4.2: "i giocatori da 1-2
  // crediti la fanno esplodere").
  const sommaPrezzi = acquisti.reduce((t, a) => t + a.prezzoPagato, 0);
  const sommaQuot = acquisti.reduce((t, a) => t + a.quotazione, 0);
  const moltiplicatoreMedio = sommaQuot > 0 ? sommaPrezzi / sommaQuot : null;

  const moltiplicatorePerFascia: FasciaMoltiplicatore[] = FASCE_QUOTAZIONE.map(({ fascia, quotMin, quotMax }) => {
    const bucket = acquisti.filter((a) => a.quotazione >= quotMin && (quotMax === null || a.quotazione <= quotMax));
    const sp = bucket.reduce((t, a) => t + a.prezzoPagato, 0);
    const sq = bucket.reduce((t, a) => t + a.quotazione, 0);
    return {
      fascia,
      quotMin,
      quotMax,
      moltiplicatore: sq > 0 ? sp / sq : 0,
      campione: bucket.length,
      affidabile: bucket.length >= CAMPIONE_MINIMO_AFFIDABILE,
    };
  });

  const creditiResiduiLega = squadre.reduce((t, s) => t + s.derivata.creditiResidui, 0);
  const slotResiduiLega = squadre.reduce((t, s) => t + s.derivata.slotResiduiTotali, 0);
  const prezzoMedioResiduo = slotResiduiLega > 0 ? creditiResiduiLega / slotResiduiLega : 0;

  const indicePressione = RUOLI.map((ruolo) => {
    const attive = squadre.filter((s) => s.derivata.slotResidui[ruolo] > 0);
    const creditiAttivi = attive.reduce((t, s) => t + s.derivata.creditiResidui, 0);
    const slotResidui = attive.reduce((t, s) => t + s.derivata.slotResidui[ruolo], 0);
    return { ruolo, creditiAttivi, slotResidui, creditiPerSlot: slotResidui > 0 ? creditiAttivi / slotResidui : 0 };
  });

  return { moltiplicatoreMedio, moltiplicatorePerFascia, creditiResiduiLega, slotResiduiLega, prezzoMedioResiduo, indicePressione };
}

// --- §4.4 — stima del prezzo di mercato di un giocatore disponibile -----------

function bucketDi(quotazione: number) {
  return FASCE_QUOTAZIONE.find((f) => quotazione >= f.quotMin && (f.quotMax === null || quotazione <= f.quotMax));
}

/**
 * Fallback finale della catena di moltiplicatori quando non c'e' ancora
 * nessun acquisto concluso ne' in lega ne' per fascia (§4.4:
 * "moltiplicatoreDiPiano // fallback: budget/Σquot dei target del piano").
 *
 * Se anche il piano non ha target risolvibili nel registro (asta appena
 * iniziata, strategia non ancora compilata), il fallback finale NON e' il
 * moltiplicatore neutro 1: le quotazioni del listone sono tarate su un budget
 * di riferimento convenzionale (in genere 500 crediti a squadra), e la lega
 * corrente puo' averne uno molto diverso (es. 1100 — vedi la segnalazione che
 * ha fatto emergere questo bug: le prime stime restituite erano quotazioni
 * grezze, non scalate). Si usa quindi la stessa idea di inflazioneTeorica in
 * pricing.ts: il rapporto tra crediti ancora in circolo nella lega e il
 * valore-listino ancora libero, che si auto-corregge per qualunque scala di
 * budget senza bisogno di conoscere la convenzione esatta del listino.
 */
export function calcolaMoltiplicatoreDiPiano(stato: StatoAsta, registro: RegistroGiocatori, creditiResiduiLega: number): number {
  const piano = stato.pianoIniziale;
  const budgetTotale = RUOLI.reduce((t, r) => t + (piano.budgetReparto?.[r] ?? 0), 0);

  const targetIds = new Set<number>();
  for (const so of piano.slotObiettivi ?? []) {
    if (so.obiettivoPrincipale != null) targetIds.add(so.obiettivoPrincipale);
    for (const alt of so.alternative ?? []) targetIds.add(alt);
  }
  for (const pm of piano.prezziMassimi ?? []) targetIds.add(pm.playerId);

  let sommaQuot = 0;
  for (const id of targetIds) {
    const info = registro.get(id);
    if (info) sommaQuot += info.quotazione;
  }

  if (budgetTotale > 0 && sommaQuot > 0) return budgetTotale / sommaQuot;

  const sommaQuotDisponibili = (stato.listoneDisponibili ?? []).reduce((t, g) => t + g.quotazione, 0);
  return sommaQuotDisponibili > 0 ? creditiResiduiLega / sommaQuotDisponibili : 1;
}

export type StimaGiocatore = { playerId: number; prezzoStimato: number; nRivaliAttivi: number };

export function stimaPrezzoGiocatori(
  stato: StatoAsta,
  mercato: MercatoDerivato,
  moltiplicatoreDiPiano: number,
  avversariDerivati: SquadraDerivata[],
): StimaGiocatore[] {
  const disponibili = stato.listoneDisponibili ?? [];

  return disponibili.map((p) => {
    const bucket = bucketDi(p.quotazione);
    const fasciaInfo = bucket ? mercato.moltiplicatorePerFascia.find((f) => f.fascia === bucket.fascia) : undefined;
    const moltiplicatore =
      fasciaInfo && fasciaInfo.campione > 0 ? fasciaInfo.moltiplicatore : (mercato.moltiplicatoreMedio ?? moltiplicatoreDiPiano);

    const prezzoBase = p.quotazione * moltiplicatore;

    const nRivaliAttivi = avversariDerivati.filter((s) => s.slotResidui[p.ruolo] > 0 && s.potereAcquistoMax >= prezzoBase).length;

    const soglia = p.quotazione * FINESTRA_ALTERNATIVE_VICINE;
    const alternativeVicine = disponibili.filter(
      (altro) => altro.id !== p.id && altro.ruolo === p.ruolo && Math.abs(altro.quotazione - p.quotazione) <= soglia,
    ).length;

    const fattoreScarsita = clamp(
      1 + SCARSITA_COEFF_RIVALI * (nRivaliAttivi - 1) - SCARSITA_COEFF_ALTERNATIVE * Math.log2(1 + alternativeVicine),
      SCARSITA_MIN,
      SCARSITA_MAX,
    );

    return { playerId: p.id, prezzoStimato: Math.round(prezzoBase * fattoreScarsita), nRivaliAttivi };
  });
}

// --- §4.5 — il mio piano ricalibrato -------------------------------------------

/**
 * Ripartizione proporzionale con arrotondamento a resto piu' grande (largest
 * remainder): garantisce Σ risultato = totale esattamente, qualunque sia il
 * segno di `totale` — floor(quota) <= quota sempre, quindi il resto da
 * distribuire e' sempre un intero non negativo compreso tra 0 e n_ruoli-1.
 */
export function ripartizioneLargestRemainder(totale: number, pesi: Record<RuoloAsta, number>): Record<RuoloAsta, number> {
  const sommaPesi = RUOLI.reduce((t, r) => t + pesi[r], 0);
  if (totale === 0 || sommaPesi === 0) return zeroPerRuolo();

  const quote = RUOLI.map((ruolo) => ({ ruolo, esatta: (totale * pesi[ruolo]) / sommaPesi }));
  const risultato = zeroPerRuolo();
  let assegnato = 0;
  for (const { ruolo, esatta } of quote) {
    risultato[ruolo] = Math.floor(esatta);
    assegnato += risultato[ruolo];
  }

  const resto = totale - assegnato;
  const perFrazioneDesc = quote
    .map(({ ruolo, esatta }) => ({ ruolo, frazione: esatta - Math.floor(esatta) }))
    .sort((a, b) => b.frazione - a.frazione);
  for (let i = 0; i < resto; i++) {
    risultato[perFrazioneDesc[i % perFrazioneDesc.length].ruolo]++;
  }

  return risultato;
}

export type PianoRicalibratoDerivato = {
  creditiResiduiMiei: number;
  budgetResiduoReparto: Record<RuoloAsta, number>;
  slotResidui: Record<RuoloAsta, number>;
  riservaMinima: number;
  // true quando e' scattato il fallback "ho sforato ovunque" (§4.5): il
  // chiamante deve alzare un alert critico.
  fallbackSforatoOvunque: boolean;
};

export function calcolaPianoRicalibrato(stato: StatoAsta, mia: SquadraDerivata, registro: RegistroGiocatori): PianoRicalibratoDerivato {
  const creditiResiduiMiei = mia.creditiResidui;
  const pesoIniziale = stato.pianoIniziale.budgetReparto ?? {};

  const spesoDaMe = zeroPerRuolo();
  for (const riga of stato.miaSquadra.rosa) {
    const info = registro.get(riga.playerId);
    if (info) spesoDaMe[info.ruolo] += riga.prezzoPagato;
  }

  const residuoTeorico = zeroPerRuolo();
  for (const ruolo of RUOLI) {
    // Solo sui reparti ancora aperti (§4.5, prosa introduttiva): un reparto
    // chiuso non ha piu' senso come destinazione di budget, anche se il piano
    // iniziale prevedeva una cifra non ancora spesa li'.
    if (mia.slotResidui[ruolo] === 0) continue;
    residuoTeorico[ruolo] = Math.max(0, (pesoIniziale[ruolo] ?? 0) - spesoDaMe[ruolo]);
  }

  const sommaResiduoTeorico = RUOLI.reduce((t, r) => t + residuoTeorico[r], 0);

  let budgetResiduoReparto: Record<RuoloAsta, number>;
  let fallbackSforatoOvunque = false;
  if (sommaResiduoTeorico > 0) {
    budgetResiduoReparto = ripartizioneLargestRemainder(creditiResiduiMiei, residuoTeorico);
  } else {
    fallbackSforatoOvunque = true;
    const sommaSlot = RUOLI.reduce((t, r) => t + mia.slotResidui[r], 0);
    budgetResiduoReparto = ripartizioneLargestRemainder(creditiResiduiMiei, sommaSlot > 0 ? mia.slotResidui : { P: 1, D: 1, C: 1, A: 1 });
  }

  const riservaMinima = RUOLI.reduce((t, r) => t + mia.slotResidui[r], 0);

  return { creditiResiduiMiei, budgetResiduoReparto, slotResidui: mia.slotResidui, riservaMinima, fallbackSforatoOvunque };
}

// --- Aggregazione -------------------------------------------------------------

export type MetricheCalcolate = {
  mia: SquadraDerivata;
  avversari: { nome: string; derivata: SquadraDerivata }[];
  mercato: MercatoDerivato;
  moltiplicatoreDiPiano: number;
  stimeGiocatori: StimaGiocatore[];
  pianoRicalibrato: PianoRicalibratoDerivato;
  discrepanzeCreditiDichiarati: DiscrepanzaCreditiDichiarati[];
};

export function calcolaMetriche(stato: StatoAsta, registro: RegistroGiocatori): MetricheCalcolate {
  const mia = derivaSquadra(stato.miaSquadra, stato.lega, registro);
  const avversari = stato.avversari.map((s) => ({ nome: s.nome, derivata: derivaSquadra(s, stato.lega, registro) }));

  const tutte: SquadraConDerivata[] = [
    { squadra: stato.miaSquadra, derivata: mia },
    ...stato.avversari.map((s, i) => ({ squadra: s, derivata: avversari[i].derivata })),
  ];
  const mercato = calcolaMercato(registro, tutte);
  const moltiplicatoreDiPiano = calcolaMoltiplicatoreDiPiano(stato, registro, mercato.creditiResiduiLega);
  const stimeGiocatori = stimaPrezzoGiocatori(
    stato,
    mercato,
    moltiplicatoreDiPiano,
    avversari.map((a) => a.derivata),
  );
  const pianoRicalibrato = calcolaPianoRicalibrato(stato, mia, registro);
  const discrepanzeCreditiDichiarati = trovaDiscrepanzeCreditiDichiarati(stato, mia, avversari);

  return { mia, avversari, mercato, moltiplicatoreDiPiano, stimeGiocatori, pianoRicalibrato, discrepanzeCreditiDichiarati };
}
