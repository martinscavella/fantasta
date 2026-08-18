import { z } from "zod";

// Solo Classic: P/D/C/A. Niente ruoli Mantra.
export const RuoloSchema = z.enum(["P", "D", "C", "A"]);
export type Ruolo = z.infer<typeof RuoloSchema>;

export const SlotPerRuoloSchema = z.object({
  P: z.number().int().positive(),
  D: z.number().int().positive(),
  C: z.number().int().positive(),
  A: z.number().int().positive(),
});
export type SlotPerRuolo = z.infer<typeof SlotPerRuoloSchema>;

export const BudgetPerRuoloSchema = z.object({
  P: z.number().int().nonnegative(),
  D: z.number().int().nonnegative(),
  C: z.number().int().nonnegative(),
  A: z.number().int().nonnegative(),
});
export type BudgetPerRuolo = z.infer<typeof BudgetPerRuoloSchema>;

// § Modalità sforo del piano.
export const RegoleSforoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("nessuno") }),
  z.object({ tipo: z.literal("a-pagamento"), euroPerCredito: z.number().positive() }),
]);
export type RegoleSforo = z.infer<typeof RegoleSforoSchema>;

// --- listone/{stagione}/{versionId}.json — immutabile ---------------------

export const PlayerSchema = z.object({
  // Id scoped alla versione di questo listone, non un identificativo stabile
  // tra piattaforme o stagioni diverse (vedi § Import listone multi-piattaforma).
  id: z.number().int(),
  nome: z.string().min(1),
  squadra: z.string().min(1),
  ruolo: RuoloSchema,
  quotazioneAttuale: z.number().nonnegative(),
  quotazioneIniziale: z.number().nonnegative(),
  differenza: z.number().optional(),
  fvm: z.number().optional(),
  fvmMantra: z.number().optional(),
});
export type Player = z.infer<typeof PlayerSchema>;

export const ListoneDocSchema = z.object({
  versionId: z.string().min(1),
  stagione: z.string().min(1),
  // Identificativo libero della fonte/profilo di mapping (es. "fantacalcio.it",
  // "fantaclub"), non un enum chiuso: il mapping guidato deve reggere anche
  // una terza piattaforma non ancora vista (vedi § Import listone).
  fonte: z.string().min(1),
  importedAt: z.number().int().nonnegative(),
  giocatori: z.array(PlayerSchema),
});
export type ListoneDoc = z.infer<typeof ListoneDocSchema>;

// --- listone/profili.json — mutabile ---------------------------------------
// Non nel layout originale del piano: la mappatura colonne "si salva come
// profilo riutilizzabile" (§ Import listone) implica persistenza, e Blob è
// l'unico storage dell'app — estensione naturale, non uno scostamento.

export const ColonnaTargetSchema = z.enum([
  "id",
  "nome",
  "squadra",
  "ruolo",
  "quotazioneAttuale",
  "quotazioneIniziale",
  "differenza",
  "fvm",
  "fvmMantra",
]);
export type ColonnaTarget = z.infer<typeof ColonnaTargetSchema>;

export const ProfiloMappingSchema = z.object({
  fonte: z.string().min(1),
  // Intestazione originale della colonna (come appare nel file) -> campo di
  // destinazione. Le colonne assenti dalla mappa vengono ignorate.
  mappa: z.record(z.string(), ColonnaTargetSchema),
  updatedAt: z.number().int().nonnegative(),
});
export type ProfiloMapping = z.infer<typeof ProfiloMappingSchema>;

export const ProfiliMappingDocSchema = z.object({
  profili: z.array(ProfiloMappingSchema),
});
export type ProfiliMappingDoc = z.infer<typeof ProfiliMappingDocSchema>;

// --- listone/{stagione}/index.json — mutabile ------------------------------

export const ListoneIndexEntrySchema = z.object({
  versionId: z.string().min(1),
  fonte: z.string().min(1),
  importedAt: z.number().int().nonnegative(),
  numeroGiocatori: z.number().int().nonnegative(),
});
export type ListoneIndexEntry = z.infer<typeof ListoneIndexEntrySchema>;

export const ListoneIndexSchema = z.object({
  stagione: z.string().min(1),
  current: z.string().nullable(),
  storico: z.array(ListoneIndexEntrySchema),
});
export type ListoneIndex = z.infer<typeof ListoneIndexSchema>;

// --- stats/{stagione}/{versionId}.json — immutabile ------------------------

export const PlayerStatsSchema = z.object({
  // null finché la coda di revisione manuale non decide il match (vedi
  // § Scraping statistiche — name matching); a quel punto l'override finisce
  // in aliases.json e il prossimo scraping produce playerId valorizzato.
  playerId: z.number().int().nullable(),
  nomeOriginale: z.string().min(1),
  fonte: z.string().min(1),
  mediaVoto: z.number().optional(),
  fantamedia: z.number().optional(),
  presenze: z.number().int().nonnegative().optional(),
  gol: z.number().int().nonnegative().optional(),
  assist: z.number().int().nonnegative().optional(),
  ammonizioni: z.number().int().nonnegative().optional(),
  espulsioni: z.number().int().nonnegative().optional(),
  rigoriSegnati: z.number().int().nonnegative().optional(),
  rigoriSbagliati: z.number().int().nonnegative().optional(),
  xg: z.number().nonnegative().optional(),
  xa: z.number().nonnegative().optional(),
});
export type PlayerStats = z.infer<typeof PlayerStatsSchema>;

export const StatsDocSchema = z.object({
  versionId: z.string().min(1),
  stagione: z.string().min(1),
  scrapedAt: z.number().int().nonnegative(),
  giocatori: z.array(PlayerStatsSchema),
});
export type StatsDoc = z.infer<typeof StatsDocSchema>;

// --- stats/{stagione}/index.json — mutabile --------------------------------

export const StatsIndexSchema = z.object({
  stagione: z.string().min(1),
  current: z.string().nullable(),
  lastAttempt: z.number().int().nonnegative().nullable(),
  lastSuccess: z.number().int().nonnegative().nullable(),
});
export type StatsIndex = z.infer<typeof StatsIndexSchema>;

// --- stats/aliases.json — mutabile -----------------------------------------

export const AliasOverrideSchema = z.object({
  nomeOriginale: z.string().min(1),
  fonte: z.string().min(1),
  // null = deciso manualmente che questa riga non è un giocatore rilevante.
  playerId: z.number().int().nullable(),
  decidedAt: z.number().int().nonnegative(),
});
export type AliasOverride = z.infer<typeof AliasOverrideSchema>;

export const AliasesDocSchema = z.object({
  overrides: z.array(AliasOverrideSchema),
});
export type AliasesDoc = z.infer<typeof AliasesDocSchema>;

// --- aste/index.json — mutabile ---------------------------------------------

export const AstaIndexEntrySchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  stagione: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
});
export type AstaIndexEntry = z.infer<typeof AstaIndexEntrySchema>;

export const AsteIndexSchema = z.object({
  aste: z.array(AstaIndexEntrySchema),
});
export type AsteIndex = z.infer<typeof AsteIndexSchema>;

// --- aste/{astaId}/setup.json — mutabile ------------------------------------

export const SquadraSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
});
export type Squadra = z.infer<typeof SquadraSchema>;

export const SetupDocSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  stagione: z.string().min(1),
  listoneVersionId: z.string().min(1),
  modalita: z.literal("classic"),
  creditiBase: z.number().int().positive(),
  slot: SlotPerRuoloSchema,
  squadre: z.array(SquadraSchema),
  // Quale squadra tra `squadre` è la mia — serve al Riepilogo (§ Post-asta nel
  // piano) per sapere di chi calcolare lo scostamento dalla strategia. Le
  // squadre avversarie non hanno una StrategyDoc propria: solo la mia ce l'ha.
  miaSquadraId: z.string().min(1),
  sforo: RegoleSforoSchema,
  createdAt: z.number().int().nonnegative(),
});
export type SetupDoc = z.infer<typeof SetupDocSchema>;

// --- aste/{astaId}/strategy.json — mutabile ---------------------------------

export const FasciaSchema = z.object({
  nome: z.string().min(1),
  sogliaMin: z.number().nonnegative(),
  // null = nessun limite superiore (es. fascia "Top").
  sogliaMax: z.number().nullable(),
});
export type Fascia = z.infer<typeof FasciaSchema>;

export const ObiettivoSlotSchema = z.object({
  ruolo: RuoloSchema,
  indiceSlot: z.number().int().nonnegative(),
  obiettivoPrincipale: z.number().int().nullable(),
  alternative: z.array(z.number().int()),
});
export type ObiettivoSlot = z.infer<typeof ObiettivoSlotSchema>;

export const OrigineValoreSchema = z.enum(["calcolato", "manuale", "ia"]);
export type OrigineValore = z.infer<typeof OrigineValoreSchema>;

export const PrezzoMassimoSchema = z.object({
  playerId: z.number().int(),
  valore: z.number().nonnegative(),
  origine: OrigineValoreSchema,
});
export type PrezzoMassimo = z.infer<typeof PrezzoMassimoSchema>;

export const StrategyDocSchema = z.object({
  astaId: z.string().min(1),
  fasce: z.array(FasciaSchema),
  budgetReparto: BudgetPerRuoloSchema,
  slotObiettivi: z.array(ObiettivoSlotSchema),
  prezziMassimi: z.array(PrezzoMassimoSchema),
  // Tetto di spesa reale in €, solo se l'asta è a sforo (vedi RegoleSforo).
  tettoSpesaEuro: z.number().positive().nullable(),
  template: z.string().nullable(),
  // Sintesi in prosa dell'ultima generazione del Ponte IA (§ Generatore di
  // strategia nel piano) — null se la strategia non è mai stata generata.
  // La provenienza per-prezzo è già coperta da PrezzoMassimo.origine.
  sintesiIA: z.string().nullable(),
  updatedAt: z.number().int().nonnegative(),
});
export type StrategyDoc = z.infer<typeof StrategyDocSchema>;

// --- aste/{astaId}/board.json — mutabile, event log -------------------------

export const BoardEventSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    ts: z.number().int().nonnegative(),
    type: z.literal("ASSIGN"),
    playerId: z.number().int(),
    teamId: z.string().min(1),
    price: z.number().int().nonnegative(),
  }),
  z.object({
    id: z.string().min(1),
    ts: z.number().int().nonnegative(),
    type: z.literal("UNDO"),
    targetEventId: z.string().min(1),
  }),
  z.object({
    id: z.string().min(1),
    ts: z.number().int().nonnegative(),
    type: z.literal("EDIT"),
    targetEventId: z.string().min(1),
    price: z.number().int().nonnegative().optional(),
    teamId: z.string().min(1).optional(),
  }),
]);
export type BoardEvent = z.infer<typeof BoardEventSchema>;

export const BoardDocSchema = z.object({
  astaId: z.string().min(1),
  events: z.array(BoardEventSchema),
});
export type BoardDoc = z.infer<typeof BoardDocSchema>;

// --- dossier/{stagione}.json — mutabile --------------------------------------
// Un solo documento per stagione, condiviso tra le due leghe (§ Dossier
// giocatori nel piano: "si generano una volta e servono entrambe le leghe").

export const LivelloRischioSchema = z.enum(["basso", "medio", "alto"]);
export type LivelloRischio = z.infer<typeof LivelloRischioSchema>;

export const DossierEntrySchema = z.object({
  playerId: z.number().int(),
  puntiForza: z.array(z.string()),
  puntiDebolezza: z.array(z.string()),
  rischioInfortuni: LivelloRischioSchema,
  rischioTitolarita: LivelloRischioSchema,
  noteRecenti: z.string(),
  prezzoConsigliato: z.number().nonnegative(),
  motivazionePrezzo: z.string(),
  alternative: z.array(z.number().int()),
  generatoAt: z.number().int().nonnegative(),
});
export type DossierEntry = z.infer<typeof DossierEntrySchema>;

export const DossierDocSchema = z.object({
  stagione: z.string().min(1),
  giocatori: z.array(DossierEntrySchema),
});
export type DossierDoc = z.infer<typeof DossierDocSchema>;

// --- aste/{astaId}/debrief.json — mutabile -----------------------------------
// Prosa libera (§ Debrief post-asta nel piano: "la risposta è prosa da
// leggere, non serve nemmeno importarla") — nessuno schema sul contenuto.

export const DebriefDocSchema = z.object({
  astaId: z.string().min(1),
  testo: z.string(),
  updatedAt: z.number().int().nonnegative(),
});
export type DebriefDoc = z.infer<typeof DebriefDocSchema>;
