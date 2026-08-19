import { abbinaGiocatore, type CandidatoMatch } from "@/lib/matching";

// §10 della spec — "L'app deve poter funzionare incrementalmente: l'utente
// incolla solo gli acquisti nuovi... prevedi un parser tollerante per
// l'incollato dell'utente (formato libero 'Squadra | Giocatore | Prezzo'),
// con matching fuzzy sui nomi contro il listone e richiesta di conferma solo
// sulle righe ambigue." Riusa la stessa pipeline di matching dello scraping
// (src/lib/matching.ts) invece di duplicarla — stessa soglia, stesso
// comportamento su omonimi.

export type RigaIncollata =
  | { ok: true; riga: string; squadra: string; playerId: number; prezzo: number }
  | { ok: false; ambiguo: true; riga: string; squadra: string; nomeGrezzo: string; prezzo: number; candidati: number[] }
  | { ok: false; ambiguo: false; riga: string; errore: string };

function parsaRiga(riga: string, candidati: CandidatoMatch[]): RigaIncollata {
  const parti = riga.split("|").map((p) => p.trim());
  if (parti.length < 3) {
    return { ok: false, ambiguo: false, riga, errore: 'Formato atteso "Squadra | Giocatore | Prezzo"' };
  }
  const [squadra, nomeGrezzo, prezzoGrezzo] = parti;
  if (!squadra || !nomeGrezzo) {
    return { ok: false, ambiguo: false, riga, errore: "Squadra o nome giocatore mancante" };
  }

  const prezzo = Number(prezzoGrezzo.replace(",", "."));
  if (!Number.isFinite(prezzo) || prezzo < 0) {
    return { ok: false, ambiguo: false, riga, errore: `Prezzo non valido: "${prezzoGrezzo}"` };
  }

  const match = abbinaGiocatore(nomeGrezzo, candidati);
  switch (match.metodo) {
    case "alias":
    case "esatto":
    case "fuzzy":
      return { ok: true, riga, squadra, playerId: match.playerId, prezzo };
    case "ambiguo":
      return { ok: false, ambiguo: true, riga, squadra, nomeGrezzo, prezzo, candidati: match.candidati };
    case "nessuno":
      return { ok: false, ambiguo: false, riga, errore: `Nessun giocatore trovato per "${nomeGrezzo}"` };
  }
}

/** Righe vuote ignorate — l'utente incolla spesso con righe bianche tra i blocchi. */
export function parsaRigheIncollate(testo: string, candidati: CandidatoMatch[]): RigaIncollata[] {
  return testo
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((riga) => parsaRiga(riga, candidati));
}
