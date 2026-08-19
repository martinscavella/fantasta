import readXlsxFile from "read-excel-file/node";
import type { ColonnaTarget, Player, Ruolo } from "@/lib/blob/schemas";

export type Cell = string | number | null;
export type Rows = Cell[][];
// Intestazione originale della colonna -> campo di destinazione (stessa forma
// di ProfiloMapping.mappa in blob/schemas.ts, così un profilo salvato si usa
// senza conversioni). Le colonne assenti dalla mappa vengono ignorate.
export type MappaColonne = Partial<Record<string, ColonnaTarget>>;

const CAMPI_OBBLIGATORI: ColonnaTarget[] = ["nome", "squadra", "ruolo", "quotazioneAttuale"];

// --- normalizzazione celle --------------------------------------------------

function normalizeCell(raw: unknown): Cell {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return raw;
  if (raw instanceof Date) return raw.toISOString();
  return String(raw);
}

export function cellToText(cell: Cell): string {
  if (cell === null) return "";
  return String(cell).trim();
}

export function cellToNumber(cell: Cell): number | undefined {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : undefined;
  const text = cellToText(cell);
  if (text === "") return undefined;
  // Formati italiani ("1.234,5" o "12,5") e semplici ("12.5", "12"): tolgo i
  // punti come separatore delle migliaia solo se c'è anche una virgola decimale.
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}

const RUOLO_ALIASES: Record<string, Ruolo> = {
  p: "P",
  por: "P",
  portiere: "P",
  d: "D",
  dif: "D",
  difensore: "D",
  c: "C",
  cen: "C",
  centrocampista: "C",
  centrocampo: "C",
  a: "A",
  att: "A",
  attaccante: "A",
};

export function normalizeRuolo(raw: string): Ruolo | null {
  return RUOLO_ALIASES[raw.trim().toLowerCase()] ?? null;
}

// --- CSV ---------------------------------------------------------------------

function detectDelimiter(sampleLine: string): "," | ";" {
  const commaCount = (sampleLine.match(/,/g) ?? []).length;
  const semicolonCount = (sampleLine.match(/;/g) ?? []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

export function parseCsv(text: string): Rows {
  const source = text.replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);

  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < source.length) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === delimiter) {
      pushField();
      i++;
      continue;
    }
    if (char === "\r") {
      i++;
      continue;
    }
    if (char === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += char;
    i++;
  }
  if (field !== "" || row.length > 0) pushRow();

  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

// --- xlsx ----------------------------------------------------------------

export async function rowsFromXlsx(buffer: Buffer): Promise<Rows> {
  const fogli = await readXlsxFile(buffer);
  if (fogli.length === 0) throw new Error("Il file xlsx non contiene fogli");
  // "Ceduti" elenca giocatori non più tesserati: si esclude dal parsing (vedi
  // test "foglio Ceduti" nel piano). Se c'è un solo foglio si usa comunque quello.
  const principale = fogli.find((f) => f.sheet.trim().toLowerCase() !== "ceduti") ?? fogli[0];
  return principale.data.map((row) => row.map(normalizeCell));
}

// --- dispatch per estensione -----------------------------------------------

export async function rowsFromFile(filename: string, buffer: Buffer): Promise<Rows> {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "csv") return parseCsv(buffer.toString("utf-8"));
  if (ext === "xlsx") return rowsFromXlsx(buffer);
  throw new Error(`Formato file non supportato: ".${ext}". Usa .xlsx o .csv`);
}

// --- rilevamento intestazione + mapping automatico --------------------------

const NAME_TOKENS = ["nome", "calciatore", "giocatore"];
const TEAM_TOKENS = ["squadra", "team", "sq"];

export function detectHeaderRow(rows: Rows, maxScan = 20): number | null {
  for (let i = 0; i < Math.min(rows.length, maxScan); i++) {
    const cells = rows[i].map((c) => cellToText(c).toLowerCase());
    const hasName = cells.some((c) => NAME_TOKENS.some((t) => c.includes(t)));
    const hasTeam = cells.some((c) => TEAM_TOKENS.some((t) => c.includes(t)));
    if (hasName && hasTeam) return i;
  }
  return null;
}

// Alias esatti (dopo trim + lowercase) per i formati visti finora:
// - ufficiale Fantacalcio.it: Id, R, RM, Nome, Squadra, Qt.A, Qt.I, Diff., FVM, FVM M.
//   RM (ruolo Mantra) si ignora volutamente — solo FVM M si tiene come segnale (vedi piano).
// - export alternativo (es. tool di lega): #, Nome, Sq., R., FVM/1000, Quot.
//   Fuori lista/Under/R.MANTRA/PGv/MV/FM/FantaSquadra/Costo non hanno un campo
//   di destinazione (sono stato di lega o statistiche, non dati del listone) e
//   restano fuori dalla mappa: ignorati automaticamente, come da progetto.
const ALIAS_ESATTI: Record<ColonnaTarget, string[]> = {
  id: ["id", "#"],
  ruolo: ["r", "r."],
  nome: ["nome"],
  squadra: ["squadra", "sq.", "sq"],
  quotazioneAttuale: ["qt.a", "qta", "quot.", "quot"],
  quotazioneIniziale: ["qt.i", "qti"],
  differenza: ["diff.", "diff"],
  fvm: ["fvm", "fvm/1000"],
  fvmMantra: ["fvm m", "fvmm", "fvm.m"],
};

export function autoMapColumns(headers: string[]): MappaColonne {
  const mapping: MappaColonne = {};
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const [target, aliases] of Object.entries(ALIAS_ESATTI) as [ColonnaTarget, string[]][]) {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx !== -1) mapping[headers[idx]] = target;
  }
  return mapping;
}

function campiPresenti(mappa: MappaColonne): Set<ColonnaTarget> {
  return new Set(Object.values(mappa) as ColonnaTarget[]);
}

export function campiMancanti(mappa: MappaColonne): ColonnaTarget[] {
  const presenti = campiPresenti(mappa);
  return CAMPI_OBBLIGATORI.filter((c) => !presenti.has(c));
}

// Per persistere in ProfiloMapping (schema zod, niente valori undefined).
export function mappaSenzaVuoti(mappa: MappaColonne): Record<string, ColonnaTarget> {
  return Object.fromEntries(Object.entries(mappa).filter(([, v]) => v !== undefined)) as Record<
    string,
    ColonnaTarget
  >;
}

export function mappaCompleta(mappa: MappaColonne): boolean {
  return campiMancanti(mappa).length === 0;
}

// --- parsing righe -> Player[] ----------------------------------------------

export type ParseResult = {
  giocatori: Player[];
  righeSaltate: number;
};

export function parseGiocatori(rows: Rows, headerRowIndex: number, mappa: MappaColonne): ParseResult {
  const mancanti = campiMancanti(mappa);
  if (mancanti.length > 0) {
    throw new Error(`Mappatura incompleta: mancano ${mancanti.join(", ")}`);
  }

  const headers = rows[headerRowIndex]?.map(cellToText) ?? [];
  const headerPerTarget = new Map<ColonnaTarget, string>();
  for (const [header, target] of Object.entries(mappa)) {
    if (target) headerPerTarget.set(target, header);
  }
  const colIndex = (target: ColonnaTarget): number | null => {
    const header = headerPerTarget.get(target);
    if (!header) return null;
    const idx = headers.indexOf(header);
    return idx === -1 ? null : idx;
  };

  const idx = {
    id: colIndex("id"),
    nome: colIndex("nome"),
    squadra: colIndex("squadra"),
    ruolo: colIndex("ruolo"),
    quotazioneAttuale: colIndex("quotazioneAttuale"),
    quotazioneIniziale: colIndex("quotazioneIniziale"),
    differenza: colIndex("differenza"),
    fvm: colIndex("fvm"),
    fvmMantra: colIndex("fvmMantra"),
  };

  const giocatori: Player[] = [];
  let righeSaltate = 0;
  let autoId = 1;

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => cellToText(c) === "")) continue;

    const nome = idx.nome !== null ? cellToText(row[idx.nome]) : "";
    const squadra = idx.squadra !== null ? cellToText(row[idx.squadra]) : "";
    const ruolo = idx.ruolo !== null ? normalizeRuolo(cellToText(row[idx.ruolo])) : null;
    const quotazioneAttuale = idx.quotazioneAttuale !== null ? cellToNumber(row[idx.quotazioneAttuale]) : undefined;

    if (!nome || !squadra || !ruolo || quotazioneAttuale === undefined) {
      righeSaltate++;
      continue;
    }

    const idDaColonna = idx.id !== null ? cellToNumber(row[idx.id]) : undefined;
    const quotazioneIniziale = idx.quotazioneIniziale !== null ? cellToNumber(row[idx.quotazioneIniziale]) : undefined;

    giocatori.push({
      id: idDaColonna ?? autoId++,
      nome,
      squadra,
      ruolo,
      quotazioneAttuale,
      quotazioneIniziale: quotazioneIniziale ?? quotazioneAttuale,
      differenza: idx.differenza !== null ? cellToNumber(row[idx.differenza]) : undefined,
      fvm: idx.fvm !== null ? cellToNumber(row[idx.fvm]) : undefined,
      fvmMantra: idx.fvmMantra !== null ? cellToNumber(row[idx.fvmMantra]) : undefined,
    });
  }

  return { giocatori, righeSaltate };
}

// --- diff rispetto alla versione precedente ---------------------------------

export type ListoneDiff = {
  nuovi: Player[];
  ceduti: Player[];
  quotazioniVariate: { nome: string; squadra: string; prima: number; dopo: number }[];
};

function chiave(p: Pick<Player, "nome" | "squadra">): string {
  return `${p.nome.trim().toLowerCase()}__${p.squadra.trim().toLowerCase()}`;
}

export function diffListoni(precedenti: Player[], attuali: Player[]): ListoneDiff {
  const mappaPrecedenti = new Map(precedenti.map((p) => [chiave(p), p]));
  const mappaAttuali = new Map(attuali.map((p) => [chiave(p), p]));

  const nuovi = attuali.filter((p) => !mappaPrecedenti.has(chiave(p)));
  const ceduti = precedenti.filter((p) => !mappaAttuali.has(chiave(p)));
  const quotazioniVariate: ListoneDiff["quotazioniVariate"] = [];

  for (const attuale of attuali) {
    const precedente = mappaPrecedenti.get(chiave(attuale));
    if (precedente && precedente.quotazioneAttuale !== attuale.quotazioneAttuale) {
      quotazioniVariate.push({
        nome: attuale.nome,
        squadra: attuale.squadra,
        prima: precedente.quotazioneAttuale,
        dopo: attuale.quotazioneAttuale,
      });
    }
  }

  return { nuovi, ceduti, quotazioniVariate };
}
