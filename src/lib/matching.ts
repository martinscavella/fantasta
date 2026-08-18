// § Scraping statistiche nel piano: "il problema vero è il name matching, non
// il fetch". Pipeline: normalizzazione -> match esatto -> match fuzzy
// (Jaro-Winkler) con soglia -> i residui vanno in coda di revisione manuale.

/**
 * lowercase, rimozione diacritici, ordinamento token: "Lautaro Martínez" e
 * "MARTINEZ LAUTARO" normalizzano entrambi a "lautaro martinez".
 */
export function normalizzaNome(nome: string): string {
  const senzaDiacritici = nome.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const token = senzaDiacritici
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort();
  return token.join(" ");
}

function jaro(a: string, b: string): number {
  if (a === b) return 1;
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0 || lenB === 0) return 0;

  const matchDistance = Math.max(0, Math.floor(Math.max(lenA, lenB) / 2) - 1);
  const matchesA = new Array<boolean>(lenA).fill(false);
  const matchesB = new Array<boolean>(lenB).fill(false);

  let matches = 0;
  for (let i = 0; i < lenA; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, lenB);
    for (let j = start; j < end; j++) {
      if (matchesB[j] || a[i] !== b[j]) continue;
      matchesA[i] = true;
      matchesB[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < lenA; i++) {
    if (!matchesA[i]) continue;
    while (!matchesB[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions /= 2;

  return (matches / lenA + matches / lenB + (matches - transpositions) / matches) / 3;
}

/** Jaro-Winkler: premia i prefissi comuni sopra la similarità Jaro di base. */
export function jaroWinkler(a: string, b: string): number {
  const jaroSim = jaro(a, b);
  const maxPrefix = 4;
  let prefixLength = 0;
  for (let i = 0; i < Math.min(maxPrefix, a.length, b.length); i++) {
    if (a[i] !== b[i]) break;
    prefixLength++;
  }
  return jaroSim + prefixLength * 0.1 * (1 - jaroSim);
}

const SOGLIA_FUZZY = 0.92;
// Se il migliore e il secondo migliore candidato sono più vicini di questo,
// l'abbinamento è ambiguo (omonimi) invece che affidabile.
const MARGINE_AMBIGUITA = 0.01;

export type CandidatoMatch = { id: number; nome: string };

export type RisultatoMatch =
  | { metodo: "alias"; playerId: number }
  | { metodo: "esatto"; playerId: number }
  | { metodo: "fuzzy"; playerId: number; punteggio: number }
  | { metodo: "ambiguo"; candidati: number[] }
  | { metodo: "nessuno" };

/**
 * Abbina un nome grezzo (da una fonte esterna) a un giocatore del listone.
 *
 * @param aliasDeciso - decisione salvata in precedenza per questo nome esatto
 *   (stats/aliases.json): `undefined` = nessuna decisione salvata, `null` =
 *   deciso a mano che non è un giocatore rilevante, altrimenti il playerId.
 */
export function abbinaGiocatore(
  nomeOriginale: string,
  candidati: CandidatoMatch[],
  aliasDeciso?: number | null,
): RisultatoMatch {
  if (aliasDeciso !== undefined) {
    return aliasDeciso === null ? { metodo: "nessuno" } : { metodo: "alias", playerId: aliasDeciso };
  }

  const nomeNormalizzato = normalizzaNome(nomeOriginale);

  const esatti = candidati.filter((c) => normalizzaNome(c.nome) === nomeNormalizzato);
  if (esatti.length === 1) return { metodo: "esatto", playerId: esatti[0].id };
  if (esatti.length > 1) return { metodo: "ambiguo", candidati: esatti.map((c) => c.id) };

  let migliore: { id: number; punteggio: number } | null = null;
  let secondoMigliore = 0;
  for (const c of candidati) {
    const punteggio = jaroWinkler(nomeNormalizzato, normalizzaNome(c.nome));
    if (!migliore || punteggio > migliore.punteggio) {
      secondoMigliore = migliore?.punteggio ?? 0;
      migliore = { id: c.id, punteggio };
    } else if (punteggio > secondoMigliore) {
      secondoMigliore = punteggio;
    }
  }

  if (!migliore || migliore.punteggio < SOGLIA_FUZZY) return { metodo: "nessuno" };

  if (migliore.punteggio - secondoMigliore < MARGINE_AMBIGUITA) {
    const paritari = candidati
      .filter((c) => Math.abs(jaroWinkler(nomeNormalizzato, normalizzaNome(c.nome)) - migliore!.punteggio) < 1e-9)
      .map((c) => c.id);
    return { metodo: "ambiguo", candidati: paritari };
  }

  return { metodo: "fuzzy", playerId: migliore.id, punteggio: migliore.punteggio };
}
