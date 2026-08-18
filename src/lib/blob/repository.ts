import { get, put, BlobPreconditionFailedError } from "@vercel/blob";
import type { z, ZodType } from "zod";
import {
  AliasesDocSchema,
  AsteIndexSchema,
  BoardDocSchema,
  DebriefDocSchema,
  DossierDocSchema,
  ListoneDocSchema,
  ListoneIndexSchema,
  ProfiliMappingDocSchema,
  SetupDocSchema,
  StatsDocSchema,
  StatsIndexSchema,
  StrategyDocSchema,
  type AliasesDoc,
  type AsteIndex,
  type BoardDoc,
  type DebriefDoc,
  type DossierDoc,
  type ListoneDoc,
  type ListoneIndex,
  type ProfiliMappingDoc,
  type SetupDoc,
  type StatsDoc,
  type StatsIndex,
  type StrategyDoc,
} from "@/lib/blob/schemas";

// Store privato: ogni lettura/scrittura passa da qui, mai da un fetch diretto
// all'URL del blob (vedi § Store privato + letture consistenti nel piano).
const ACCESS = "private" as const;

export class ConflictError extends Error {
  constructor(readonly pathname: string) {
    super(
      `Conflitto di scrittura su "${pathname}": un'altra sessione ha modificato il documento nel frattempo`,
    );
    this.name = "ConflictError";
  }
}

type Doc<T> = { data: T; etag: string };

/**
 * Legge e valida un documento mutabile. `useCache: false` bypassa la CDN:
 * senza, un overwrite può impiegare fino a 60s a propagarsi (vedi piano).
 */
export async function readDoc<S extends ZodType>(
  pathname: string,
  schema: S,
): Promise<Doc<z.infer<S>> | null> {
  const result = await get(pathname, { access: ACCESS, useCache: false });
  if (!result) return null;
  const text = await new Response(result.stream).text();
  return { data: schema.parse(JSON.parse(text)), etag: result.blob.etag };
}

/**
 * Scrive un documento mutabile. `ifMatch` abilita la concorrenza ottimistica:
 * se un'altra scheda ha scritto nel frattempo, lancia ConflictError invece di
 * perdere silenziosamente i dati dell'altra scrittura.
 */
export async function writeDoc<S extends ZodType>(
  pathname: string,
  schema: S,
  data: z.infer<S>,
  options: { ifMatch?: string } = {},
): Promise<{ etag: string }> {
  schema.parse(data);
  try {
    const result = await put(pathname, JSON.stringify(data), {
      access: ACCESS,
      allowOverwrite: true,
      contentType: "application/json",
      ifMatch: options.ifMatch,
    });
    return { etag: result.etag };
  } catch (err) {
    if (err instanceof BlobPreconditionFailedError) throw new ConflictError(pathname);
    throw err;
  }
}

/**
 * Scrive un documento immutabile a un pathname versionato: nessun overwrite
 * consentito, cache CDN lunga (letture veloci e quasi gratuite — vedi piano).
 */
export async function writeImmutableDoc<S extends ZodType>(
  pathname: string,
  schema: S,
  data: z.infer<S>,
): Promise<{ etag: string; url: string }> {
  schema.parse(data);
  const result = await put(pathname, JSON.stringify(data), {
    access: ACCESS,
    allowOverwrite: false,
    contentType: "application/json",
    cacheControlMaxAge: 60 * 60 * 24 * 365,
  });
  return { etag: result.etag, url: result.url };
}

/**
 * Leggi → muta → scrivi con retry su conflitto (vedi § Scritture condizionali
 * nel piano). `mutate` riceve sempre lo stato più fresco: al retry rilegge il
 * documento appena scritto da chi ci ha preceduto, quindi per un event log
 * (append-only) il risultato converge all'unione dei due log.
 */
export async function updateDoc<S extends ZodType>(
  pathname: string,
  schema: S,
  fallback: z.infer<S>,
  mutate: (current: z.infer<S>) => z.infer<S>,
  { maxRetries = 3 }: { maxRetries?: number } = {},
): Promise<z.infer<S>> {
  for (let attempt = 0; ; attempt++) {
    const existing = await readDoc(pathname, schema);
    const next = mutate(existing?.data ?? fallback);
    try {
      await writeDoc(pathname, schema, next, { ifMatch: existing?.etag });
      return next;
    } catch (err) {
      if (err instanceof ConflictError && attempt < maxRetries) continue;
      throw err;
    }
  }
}

// --- Accesso tipizzato per documento (layout dei blob, vedi piano) ---------

const paths = {
  listone: (stagione: string, versionId: string) => `listone/${stagione}/${versionId}.json`,
  listoneIndex: (stagione: string) => `listone/${stagione}/index.json`,
  stats: (stagione: string, versionId: string) => `stats/${stagione}/${versionId}.json`,
  statsIndex: (stagione: string) => `stats/${stagione}/index.json`,
  aliases: () => `stats/aliases.json`,
  profiliMapping: () => `listone/profili.json`,
  asteIndex: () => `aste/index.json`,
  setup: (astaId: string) => `aste/${astaId}/setup.json`,
  strategy: (astaId: string) => `aste/${astaId}/strategy.json`,
  board: (astaId: string) => `aste/${astaId}/board.json`,
  dossier: (stagione: string) => `dossier/${stagione}.json`,
  debrief: (astaId: string) => `aste/${astaId}/debrief.json`,
} as const;

export function getListone(stagione: string, versionId: string) {
  return readDoc(paths.listone(stagione, versionId), ListoneDocSchema);
}

export function putListone(doc: ListoneDoc) {
  return writeImmutableDoc(paths.listone(doc.stagione, doc.versionId), ListoneDocSchema, doc);
}

export function getListoneIndex(stagione: string) {
  return readDoc(paths.listoneIndex(stagione), ListoneIndexSchema);
}

export function updateListoneIndex(stagione: string, mutate: (current: ListoneIndex) => ListoneIndex) {
  return updateDoc(
    paths.listoneIndex(stagione),
    ListoneIndexSchema,
    { stagione, current: null, storico: [] },
    mutate,
  );
}

export function getStats(stagione: string, versionId: string) {
  return readDoc(paths.stats(stagione, versionId), StatsDocSchema);
}

export function putStats(doc: StatsDoc) {
  return writeImmutableDoc(paths.stats(doc.stagione, doc.versionId), StatsDocSchema, doc);
}

export function getStatsIndex(stagione: string) {
  return readDoc(paths.statsIndex(stagione), StatsIndexSchema);
}

export function updateStatsIndex(stagione: string, mutate: (current: StatsIndex) => StatsIndex) {
  return updateDoc(
    paths.statsIndex(stagione),
    StatsIndexSchema,
    { stagione, current: null, lastAttempt: null, lastSuccess: null },
    mutate,
  );
}

export function getAliases() {
  return readDoc(paths.aliases(), AliasesDocSchema);
}

export function updateAliases(mutate: (current: AliasesDoc) => AliasesDoc) {
  return updateDoc(paths.aliases(), AliasesDocSchema, { overrides: [] }, mutate);
}

export function getProfiliMapping() {
  return readDoc(paths.profiliMapping(), ProfiliMappingDocSchema);
}

export function updateProfiliMapping(mutate: (current: ProfiliMappingDoc) => ProfiliMappingDoc) {
  return updateDoc(paths.profiliMapping(), ProfiliMappingDocSchema, { profili: [] }, mutate);
}

export function getAsteIndex() {
  return readDoc(paths.asteIndex(), AsteIndexSchema);
}

export function updateAsteIndex(mutate: (current: AsteIndex) => AsteIndex) {
  return updateDoc(paths.asteIndex(), AsteIndexSchema, { aste: [] }, mutate);
}

export function getSetup(astaId: string) {
  return readDoc(paths.setup(astaId), SetupDocSchema);
}

export function putSetup(doc: SetupDoc) {
  return writeDoc(paths.setup(doc.id), SetupDocSchema, doc);
}

export function getStrategy(astaId: string) {
  return readDoc(paths.strategy(astaId), StrategyDocSchema);
}

export function updateStrategy(astaId: string, fallback: StrategyDoc, mutate: (current: StrategyDoc) => StrategyDoc) {
  return updateDoc(paths.strategy(astaId), StrategyDocSchema, fallback, mutate);
}

export function getBoard(astaId: string) {
  return readDoc(paths.board(astaId), BoardDocSchema);
}

export function updateBoard(astaId: string, mutate: (current: BoardDoc) => BoardDoc) {
  return updateDoc(paths.board(astaId), BoardDocSchema, { astaId, events: [] }, mutate);
}

export function getDossier(stagione: string) {
  return readDoc(paths.dossier(stagione), DossierDocSchema);
}

export function updateDossier(stagione: string, mutate: (current: DossierDoc) => DossierDoc) {
  return updateDoc(paths.dossier(stagione), DossierDocSchema, { stagione, giocatori: [] }, mutate);
}

export function getDebrief(astaId: string) {
  return readDoc(paths.debrief(astaId), DebriefDocSchema);
}

export function putDebrief(doc: DebriefDoc) {
  return writeDoc(paths.debrief(doc.astaId), DebriefDocSchema, doc);
}
