import type { Fascia, Player } from "@/lib/blob/schemas";

// Le fasce sono una partizione dell'asse dei prezzi, non quattro intervalli
// indipendenti: il tetto di una è sempre il pavimento della successiva meno
// uno. L'editor lo dava per scontato senza garantirlo — si digitavano due
// volte lo stesso confine, e bastava sbagliare un numero per aprire un buco
// (Top da 30, Semitop fino a 28: la quotazione 29 non finiva in nessuna
// fascia) o una sovrapposizione, senza che niente lo segnalasse.
//
// Qui la contiguità è un invariante: si modifica solo la soglia minima e i
// tetti si ricalcolano di conseguenza.

/**
 * Riordina per soglia decrescente e ricalcola i tetti perché le fasce siano
 * contigue e senza buchi. La prima (la più alta) non ha tetto.
 */
export function normalizzaFasce(fasce: Fascia[]): Fascia[] {
  const ordinate = [...fasce].sort((a, b) => b.sogliaMin - a.sogliaMin);
  return ordinate.map((fascia, i) => ({
    ...fascia,
    sogliaMin: Math.max(0, Math.round(fascia.sogliaMin)),
    sogliaMax: i === 0 ? null : Math.max(0, Math.round(ordinate[i - 1].sogliaMin) - 1),
  }));
}

/**
 * Cambia la soglia minima di una fascia mantenendo l'ordine: il valore viene
 * limitato allo spazio disponibile tra la fascia sopra e quella sotto, così
 * trascinare un confine non può mai scavalcarne un altro.
 */
export function impostaSoglia(fasce: Fascia[], indice: number, valore: number): Fascia[] {
  const normalizzate = normalizzaFasce(fasce);
  const sopra = normalizzate[indice - 1];
  const sotto = normalizzate[indice + 1];

  // Serve almeno un credito di respiro da entrambi i lati, altrimenti due
  // fasce collasserebbero sullo stesso confine.
  const minimo = sotto ? sotto.sogliaMin + 1 : 0;
  const massimo = sopra ? sopra.sogliaMin - 1 : Number.MAX_SAFE_INTEGER;
  const limitato = Math.min(massimo, Math.max(minimo, Math.round(valore)));

  return normalizzaFasce(normalizzate.map((f, i) => (i === indice ? { ...f, sogliaMin: limitato } : f)));
}

export function rinominaFascia(fasce: Fascia[], indice: number, nome: string): Fascia[] {
  return fasce.map((f, i) => (i === indice ? { ...f, nome } : f));
}

export function rimuoviFascia(fasce: Fascia[], indice: number): Fascia[] {
  return normalizzaFasce(fasce.filter((_, i) => i !== indice));
}

/**
 * Inserisce una fascia a metà strada tra quella indicata e la successiva, così
 * la nuova nasce già in un intervallo valido invece che a zero in fondo.
 */
export function aggiungiFascia(fasce: Fascia[], nome = "Nuova fascia"): Fascia[] {
  const normalizzate = normalizzaFasce(fasce);
  if (normalizzate.length === 0) return [{ nome, sogliaMin: 1, sogliaMax: null }];

  const ultima = normalizzate[normalizzate.length - 1];
  const penultima = normalizzate[normalizzate.length - 2];
  const soglia = penultima
    ? Math.floor((ultima.sogliaMin + penultima.sogliaMin) / 2)
    : Math.max(0, ultima.sogliaMin - 1);

  // Se non c'è spazio sotto l'ultima fascia si aggiunge comunque, ma sopra:
  // meglio una fascia in più da correggere che un click che non fa niente.
  if (soglia <= ultima.sogliaMin) {
    return normalizzaFasce([...normalizzate, { nome, sogliaMin: ultima.sogliaMin + 1, sogliaMax: null }]);
  }
  return normalizzaFasce([...normalizzate, { nome, sogliaMin: soglia, sogliaMax: null }]);
}

/** Indice della fascia in cui cade una quotazione, o -1 se sotto tutte. */
export function indiceFascia(fasce: Fascia[], quotazione: number): number {
  return normalizzaFasce(fasce).findIndex(
    (f) => quotazione >= f.sogliaMin && (f.sogliaMax === null || quotazione <= f.sogliaMax),
  );
}

export type ConteggioFascia = {
  fascia: Fascia;
  giocatori: number;
  // Somma delle quotazioni della fascia: dice quanto "pesa" davvero, non solo
  // quanti giocatori contiene.
  valoreTotale: number;
};

/**
 * Quanti giocatori del listone cadono in ogni fascia. È il riscontro che
 * mancava del tutto: senza, si spostano soglie alla cieca senza sapere se la
 * fascia "Top" contiene tre giocatori o sessanta.
 */
export function conteggioPerFascia(fasce: Fascia[], giocatori: Player[]): ConteggioFascia[] {
  const normalizzate = normalizzaFasce(fasce);
  const conteggi = normalizzate.map((fascia) => ({ fascia, giocatori: 0, valoreTotale: 0 }));

  for (const g of giocatori) {
    const i = normalizzate.findIndex(
      (f) => g.quotazioneAttuale >= f.sogliaMin && (f.sogliaMax === null || g.quotazioneAttuale <= f.sogliaMax),
    );
    if (i === -1) continue;
    conteggi[i].giocatori++;
    conteggi[i].valoreTotale += g.quotazioneAttuale;
  }

  return conteggi;
}

/** Giocatori sotto la soglia più bassa: restano fuori da ogni fascia. */
export function giocatoriFuoriFascia(fasce: Fascia[], giocatori: Player[]): number {
  const normalizzate = normalizzaFasce(fasce);
  if (normalizzate.length === 0) return giocatori.length;
  const minima = normalizzate[normalizzate.length - 1].sogliaMin;
  return giocatori.filter((g) => g.quotazioneAttuale < minima).length;
}
