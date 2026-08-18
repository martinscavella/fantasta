import { randomUUID } from "node:crypto";
import {
  getListoneIndex,
  getListone,
  getProfiliMapping,
  putListone,
  updateListoneIndex,
  updateProfiliMapping,
} from "@/lib/blob/repository";
import type { ListoneDoc, Player } from "@/lib/blob/schemas";
import {
  autoMapColumns,
  campiMancanti,
  cellToText,
  detectHeaderRow,
  diffListoni,
  mappaCompleta,
  mappaSenzaVuoti,
  parseGiocatori,
  rowsFromFile,
  type MappaColonne,
  type Rows,
} from "@/lib/listone/parser";

type ParsedRequest = {
  mode: "preview" | "commit";
  fonte: string;
  stagione: string;
  headerRowIndex: number | null;
  mappaOverride: MappaColonne;
  buffer: Buffer;
  filename: string;
};

async function parseRequest(request: Request): Promise<ParsedRequest | { error: string }> {
  const form = await request.formData();
  const file = form.get("file");
  const fonte = form.get("fonte");
  const stagione = form.get("stagione");
  const mode = form.get("mode");

  if (!(file instanceof File)) return { error: "File mancante" };
  if (typeof fonte !== "string" || fonte.trim() === "") return { error: "Fonte mancante" };
  if (typeof stagione !== "string" || stagione.trim() === "") return { error: "Stagione mancante" };
  if (mode !== "preview" && mode !== "commit") return { error: "mode deve essere 'preview' o 'commit'" };

  const headerRowIndexRaw = form.get("headerRowIndex");
  const headerRowIndex =
    typeof headerRowIndexRaw === "string" && headerRowIndexRaw !== "" ? Number(headerRowIndexRaw) : null;

  const mappaRaw = form.get("mappa");
  let mappaOverride: MappaColonne = {};
  if (typeof mappaRaw === "string" && mappaRaw !== "") {
    try {
      mappaOverride = JSON.parse(mappaRaw);
    } catch {
      return { error: "mappa non è un JSON valido" };
    }
  }

  return {
    mode,
    fonte,
    stagione,
    headerRowIndex,
    mappaOverride,
    buffer: Buffer.from(await file.arrayBuffer()),
    filename: file.name,
  };
}

async function proposedMapping(fonte: string, headers: string[], override: MappaColonne): Promise<MappaColonne> {
  const profilo = (await getProfiliMapping())?.data.profili.find((p) => p.fonte === fonte);
  // Priorità: override esplicito dal client > profilo salvato per la fonte > mapping automatico generico.
  return { ...autoMapColumns(headers), ...(profilo?.mappa ?? {}), ...override };
}

async function diffVsVersioneCorrente(stagione: string, giocatori: Player[]) {
  const index = await getListoneIndex(stagione);
  if (!index?.data.current) return null;
  const precedente = await getListone(stagione, index.data.current);
  if (!precedente) return null;
  return diffListoni(precedente.data.giocatori, giocatori);
}

export async function POST(request: Request) {
  const parsed = await parseRequest(request);
  if ("error" in parsed) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const { mode, fonte, stagione, headerRowIndex: headerRowIndexInput, mappaOverride, buffer, filename } = parsed;

  let rows: Rows;
  try {
    rows = await rowsFromFile(filename, buffer);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }

  const headerRowIndex = headerRowIndexInput ?? detectHeaderRow(rows);
  if (headerRowIndex === null) {
    if (mode === "commit") {
      return Response.json({ error: "Riga di intestazione non determinata: impossibile importare" }, { status: 400 });
    }
    return Response.json({
      headerRowIndex: null,
      headers: [],
      mappa: {},
      mappaCompleta: false,
      campiMancanti: campiMancanti({}),
      giocatori: [],
      righeSaltate: 0,
      diff: null,
    });
  }

  const headers = (rows[headerRowIndex] ?? []).map(cellToText);
  const mappa = await proposedMapping(fonte, headers, mappaOverride);
  const completa = mappaCompleta(mappa);

  if (!completa) {
    if (mode === "commit") {
      return Response.json(
        { error: `Mappatura incompleta: mancano ${campiMancanti(mappa).join(", ")}` },
        { status: 400 },
      );
    }
    return Response.json({
      headerRowIndex,
      headers,
      mappa,
      mappaCompleta: false,
      campiMancanti: campiMancanti(mappa),
      giocatori: [],
      righeSaltate: 0,
      diff: null,
    });
  }

  const { giocatori, righeSaltate } = parseGiocatori(rows, headerRowIndex, mappa);
  const diff = await diffVsVersioneCorrente(stagione, giocatori);

  if (mode === "preview") {
    return Response.json({
      headerRowIndex,
      headers,
      mappa,
      mappaCompleta: true,
      campiMancanti: [],
      giocatori,
      righeSaltate,
      diff,
    });
  }

  // mode === "commit": scrive la versione, aggiorna l'indice e salva il profilo di mapping.
  const versionId = randomUUID();
  const doc: ListoneDoc = { versionId, stagione, fonte, importedAt: Date.now(), giocatori };
  await putListone(doc);
  await updateListoneIndex(stagione, (current) => ({
    stagione,
    current: versionId,
    storico: [
      ...current.storico,
      { versionId, fonte, importedAt: doc.importedAt, numeroGiocatori: giocatori.length },
    ],
  }));
  await updateProfiliMapping((current) => ({
    profili: [
      ...current.profili.filter((p) => p.fonte !== fonte),
      { fonte, mappa: mappaSenzaVuoti(mappa), updatedAt: Date.now() },
    ],
  }));

  return Response.json({ versionId, numeroGiocatori: giocatori.length, righeSaltate, diff });
}
