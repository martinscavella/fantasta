import { cellToNumber, cellToText, parseCsv } from "@/lib/listone/parser";

// Formato "file per fantaleghe" di Fantacalcio.it: nessuna intestazione, tre
// colonne posizionali, blocchi separati da una riga di soli "$".
//
//   $,$,$                     <- separatore, uno per squadra + uno finale
//   Giovanni&Schizzo,133,18   <- nomeFantasquadra , idGiocatore , prezzoPagato
//
// Niente detectHeaderRow/autoMapColumns come per il listone: qui le colonne
// sono fisse e posizionali, il mapping guidato non ha nulla da mappare.

export type RigaRosa = {
  squadra: string;
  playerId: number;
  prezzo: number;
};

export type RoseImportate = {
  // In ordine di prima apparizione: è l'ordine in cui la UI le presenta.
  squadre: string[];
  righe: RigaRosa[];
  righeSaltate: number;
};

// Il separatore si riconosce dalla forma (ogni cella è "$"), non dal match
// letterale su "$,$,$": così regge anche l'export col punto e virgola, dove
// parseCsv autorileva il delimitatore e produce comunque ["$", "$", "$"].
function isSeparatore(celle: string[]): boolean {
  return celle.length > 0 && celle.every((c) => c === "$");
}

function interoNonNegativo(valore: number | undefined): valore is number {
  return valore !== undefined && Number.isInteger(valore) && valore >= 0;
}

export function parseRoseFantaleghe(text: string): RoseImportate {
  const rows = parseCsv(text);

  const squadre: string[] = [];
  const viste = new Set<string>();
  const righe: RigaRosa[] = [];
  let righeSaltate = 0;

  for (const row of rows) {
    const celle = row.map(cellToText);
    if (celle.every((c) => c === "")) continue;
    if (isSeparatore(celle)) continue;

    const squadra = celle[0] ?? "";
    const playerId = cellToNumber(row[1] ?? null);
    const prezzo = cellToNumber(row[2] ?? null);

    if (squadra === "" || !interoNonNegativo(playerId) || !interoNonNegativo(prezzo)) {
      righeSaltate++;
      continue;
    }

    if (!viste.has(squadra)) {
      viste.add(squadra);
      squadre.push(squadra);
    }
    righe.push({ squadra, playerId, prezzo });
  }

  return { squadre, righe, righeSaltate };
}
