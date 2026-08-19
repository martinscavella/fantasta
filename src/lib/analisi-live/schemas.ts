import { z } from "zod";

// Contratti normativi del modulo (§3 della spec Analisi Asta Live):
// input.schema.json -> StatoAstaSchema, output.schema.json -> AnalisiAstaLiveSchema.
// Sono deliberatamente indipendenti dagli schemi Blob interni (src/lib/blob/schemas.ts)
// — questo modulo e' "autonomo": riceve/produce esattamente questi due contratti,
// che l'app di chiamata (o un futuro adapter) mappa da/verso lo stato Blob.
// Vedi DECISIONI.md per le scelte non specificate dai due JSON Schema forniti.

export const RuoloAstaSchema = z.enum(["P", "D", "C", "A"]);
export type RuoloAsta = z.infer<typeof RuoloAstaSchema>;

export const FaseAstaSchema = z.enum(["pre-asta", "dopo-P", "dopo-D", "dopo-C", "dopo-A", "in-corso"]);
export type FaseAsta = z.infer<typeof FaseAstaSchema>;

const SlotPerRuoloInputSchema = z
  .object({
    P: z.number().int().nonnegative(),
    D: z.number().int().nonnegative(),
    C: z.number().int().nonnegative(),
    A: z.number().int().nonnegative(),
  })
  .strict();
export type SlotPerRuoloAsta = z.infer<typeof SlotPerRuoloInputSchema>;

const RegolePunteggioSchema = z
  .object({
    modificatoreDifesa: z.boolean().optional(),
    portiereImbattuto: z.boolean().optional(),
    golVittoria: z.boolean().optional(),
    altro: z.string().optional(),
  })
  .strict();

// Come procede l'asta: "chiamata" (ogni squadra chiama a turno chi vuole) o
// "ordine" (scorrimento alfabetico del listone, si parte da una lettera
// sorteggiata). Determina come interpretare consigliChiamata — vedi
// ISTRUZIONI_ANALISTA in prompt.ts. Scelto dall'utente ad ogni generazione
// del prompt (come `fase`), non persistito in SetupDoc.
export const SvolgimentoAstaSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("chiamata") }),
  z.object({ tipo: z.literal("ordine"), letteraIniziale: z.string().length(1) }),
]);
export type SvolgimentoAsta = z.infer<typeof SvolgimentoAstaSchema>;

export const LegaSchema = z
  .object({
    nSquadre: z.number().int().min(2),
    budget: z.number().int().min(1),
    slot: SlotPerRuoloInputSchema,
    modalita: z.enum(["classic", "mantra"]),
    budgetChiuso: z.boolean().optional(),
    svolgimento: SvolgimentoAstaSchema.optional(),
    regolePunteggio: RegolePunteggioSchema,
  })
  .strict();
export type Lega = z.infer<typeof LegaSchema>;

const RigaRosaSchema = z
  .object({
    playerId: z.number().int(),
    prezzoPagato: z.number().int().nonnegative(),
  })
  .strict();
export type RigaRosa = z.infer<typeof RigaRosaSchema>;

const SquadraInputSchema = z
  .object({
    nome: z.string().min(1),
    creditiResiduiDichiarati: z.number().int().nullable().optional(),
    rosa: z.array(RigaRosaSchema),
    // Personalizzazioni facoltative dell'utente (§ Impostazioni asta nel
    // piano). `squadraDelCuore`/`note` sono segnali di bias comportamentale
    // che il prompt passa al modello per profilare l'avversario — vedi
    // "COME PROFILARE UN AVVERSARIO" in prompt.ts.
    allenatore: z.string().optional(),
    squadraDelCuore: z.string().optional(),
    note: z.string().optional(),
  })
  .strict();
export type SquadraInput = z.infer<typeof SquadraInputSchema>;

const GiocatoreDisponibileSchema = z
  .object({
    id: z.number().int(),
    ruolo: RuoloAstaSchema,
    nome: z.string().min(1),
    club: z.string().min(1),
    quotazione: z.number().nonnegative(),
  })
  .strict();
export type GiocatoreDisponibile = z.infer<typeof GiocatoreDisponibileSchema>;

const VincoliSchema = z
  .object({
    esclusi: z.array(z.number().int()).optional(),
    obbligatori: z.array(z.number().int()).optional(),
    stile: z.string().optional(),
    rischio: z.string().optional(),
  })
  .strict();
export type Vincoli = z.infer<typeof VincoliSchema>;

const AstaInCorsoSchema = z
  .object({
    playerId: z.number().int(),
    offertaCorrente: z.number().int().nonnegative(),
    offerente: z.string().optional(),
  })
  .strict();

// pianoIniziale ha additionalProperties:true nel JSON Schema normativo ("l'output
// dello schema strategia-asta gia' in uso, passato integralmente"): tipizziamo i
// campi che il motore deterministico legge (budgetReparto, slotObiettivi,
// prezziMassimi) restando permissivi sul resto con .passthrough().
const ObiettivoSlotPianoSchema = z
  .object({
    ruolo: RuoloAstaSchema,
    indiceSlot: z.number().int().nonnegative(),
    obiettivoPrincipale: z.number().int().nullable().optional(),
    alternative: z.array(z.number().int()).optional(),
  })
  .passthrough();

const PrezzoMassimoPianoSchema = z
  .object({
    playerId: z.number().int(),
    valore: z.number(),
  })
  .passthrough();

export const PianoInizialeSchema = z
  .object({
    budgetReparto: z
      .object({ P: z.number(), D: z.number(), C: z.number(), A: z.number() })
      .partial()
      .optional(),
    prezziMassimi: z.array(PrezzoMassimoPianoSchema).optional(),
    slotObiettivi: z.array(ObiettivoSlotPianoSchema).optional(),
    fasce: z.array(z.unknown()).optional(),
    sintesi: z.string().optional(),
  })
  .passthrough();
export type PianoIniziale = z.infer<typeof PianoInizialeSchema>;

export const StatoAstaSchema = z
  .object({
    lega: LegaSchema,
    fase: FaseAstaSchema,
    ordineReparti: z.array(RuoloAstaSchema).optional(),
    miaSquadra: SquadraInputSchema,
    avversari: z.array(SquadraInputSchema),
    listoneDisponibili: z.array(GiocatoreDisponibileSchema).optional(),
    pianoIniziale: PianoInizialeSchema,
    vincoli: VincoliSchema.optional(),
    asteInCorso: z.array(AstaInCorsoSchema).optional(),
  })
  .strict();
export type StatoAsta = z.infer<typeof StatoAstaSchema>;

// --- Output: AnalisiAstaLive (output.schema.json) ---------------------------

const AffidabilitaSchema = z.enum(["alta", "media", "bassa"]);

const FonteSchema = z
  .object({
    titolo: z.string().min(1),
    url: z.string().min(1),
  })
  .strict();
export type Fonte = z.infer<typeof FonteSchema>;

const MetaSchema = z
  .object({
    fase: FaseAstaSchema,
    affidabilita: AffidabilitaSchema,
    ricercaWebEseguita: z.boolean(),
    degradato: z.boolean(),
    noteDegrado: z.string().nullable(),
    fonti: z.array(FonteSchema),
  })
  .strict();
export type Meta = z.infer<typeof MetaSchema>;

const MoltiplicatorePerFasciaSchema = z
  .object({
    fascia: z.string().min(1),
    quotMin: z.number().nonnegative(),
    quotMax: z.number().nullable(),
    moltiplicatore: z.number().nonnegative(),
    campione: z.number().int().nonnegative(),
  })
  .strict();
export type MoltiplicatorePerFascia = z.infer<typeof MoltiplicatorePerFasciaSchema>;

const IndicePressioneSchema = z
  .object({
    ruolo: RuoloAstaSchema,
    creditiAttivi: z.number().int().nonnegative(),
    slotResidui: z.number().int().nonnegative(),
    creditiPerSlot: z.number().nonnegative(),
  })
  .strict();
export type IndicePressione = z.infer<typeof IndicePressioneSchema>;

const MercatoSchema = z
  .object({
    moltiplicatoreMedio: z.number().nonnegative(),
    moltiplicatorePerFascia: z.array(MoltiplicatorePerFasciaSchema),
    creditiResiduiLega: z.number().int().nonnegative(),
    slotResiduiLega: z.number().int().nonnegative(),
    prezzoMedioResiduo: z.number().nonnegative(),
    indicePressione: z.array(IndicePressioneSchema),
    scostamentoVsPiano: z.string().min(1),
  })
  .strict();
export type Mercato = z.infer<typeof MercatoSchema>;

const SlotPerRuoloOutputSchema = z
  .object({
    P: z.number().int().nonnegative(),
    D: z.number().int().nonnegative(),
    C: z.number().int().nonnegative(),
    A: z.number().int().nonnegative(),
  })
  .strict();
export type SlotPerRuoloOutput = z.infer<typeof SlotPerRuoloOutputSchema>;

const ProfiloAvversarioSchema = z.enum([
  "modificatore-difesa",
  "attacco-pesante",
  "centrocampo-pesante",
  "equilibrato",
  "risparmiatore",
  "bruciato",
  "indeterminato",
]);
export type ProfiloAvversario = z.infer<typeof ProfiloAvversarioSchema>;

const LivelloMinacciaSchema = z.enum(["critico", "alto", "medio", "basso", "nullo"]);
export type LivelloMinaccia = z.infer<typeof LivelloMinacciaSchema>;

const BloccoClubSchema = z
  .object({
    club: z.string().min(1),
    conteggio: z.number().int().min(1),
  })
  .strict();
export type BloccoClub = z.infer<typeof BloccoClubSchema>;

const ObiettivoProbabileSchema = z
  .object({
    playerId: z.number().int(),
    probabilita: z.number().min(0).max(1),
    prezzoStimato: z.number().nonnegative(),
    motivo: z.string().min(1),
  })
  .strict();
export type ObiettivoProbabile = z.infer<typeof ObiettivoProbabileSchema>;

const AvversarioAnalizzatoSchema = z
  .object({
    squadra: z.string().min(1),
    creditiResidui: z.number().int(),
    slotResidui: SlotPerRuoloOutputSchema,
    potereAcquistoMax: z.number().int().nonnegative(),
    creditiPerSlotResiduo: z.number().nonnegative(),
    profilo: ProfiloAvversarioSchema,
    descrizioneProfilo: z.string().min(1),
    livelloMinaccia: LivelloMinacciaSchema,
    repartiChiusi: z.array(RuoloAstaSchema),
    blocchiClub: z.array(BloccoClubSchema),
    obiettiviProbabili: z.array(ObiettivoProbabileSchema),
  })
  .strict();
export type AvversarioAnalizzato = z.infer<typeof AvversarioAnalizzatoSchema>;

const VerdettoSchema = z.enum(["rilancia-deciso", "rilancia-con-cautela", "lascia", "attendi-fine-asta", "gia-perso"]);
export type Verdetto = z.infer<typeof VerdettoSchema>;

const MinacciaPerSlotSchema = z
  .object({
    ruolo: RuoloAstaSchema,
    indiceSlot: z.number().int().nonnegative(),
    playerId: z.number().int().nullable(),
    disponibile: z.boolean(),
    nRivaliAttivi: z.number().int().nonnegative(),
    rivaliPrincipali: z.array(z.string()),
    prezzoStimatoMercato: z.number().nonnegative(),
    mioTettoAggiornato: z.number().nonnegative(),
    verdetto: VerdettoSchema,
    note: z.string().min(1),
  })
  .strict();
export type MinacciaPerSlot = z.infer<typeof MinacciaPerSlotSchema>;

const PrezzoMassimoAggiornatoSchema = z
  .object({
    playerId: z.number().int(),
    valore: z.number().nonnegative(),
    valorePrecedente: z.number().nullable(),
    delta: z.number(),
    motivo: z.string().min(1),
  })
  .strict();
export type PrezzoMassimoAggiornato = z.infer<typeof PrezzoMassimoAggiornatoSchema>;

const SlotObiettivoAggiornatoSchema = z
  .object({
    ruolo: RuoloAstaSchema,
    indiceSlot: z.number().int().nonnegative(),
    obiettivoPrincipale: z.number().int().nullable(),
    alternative: z.array(z.number().int()),
  })
  .strict();
export type SlotObiettivoAggiornato = z.infer<typeof SlotObiettivoAggiornatoSchema>;

const PianoAggiornatoSchema = z
  .object({
    creditiResiduiMiei: z.number().int().nonnegative(),
    budgetResiduoReparto: SlotPerRuoloOutputSchema,
    slotResidui: SlotPerRuoloOutputSchema,
    riservaMinima: z.number().int().nonnegative(),
    prezziMassimiAggiornati: z.array(PrezzoMassimoAggiornatoSchema),
    slotObiettiviAggiornati: z.array(SlotObiettivoAggiornatoSchema),
  })
  .strict();
export type PianoAggiornato = z.infer<typeof PianoAggiornatoSchema>;

const TipoConsiglioSchema = z.enum(["chiama-ora", "brucia-crediti", "non-chiamare", "aspetta-fine"]);
export type TipoConsiglio = z.infer<typeof TipoConsiglioSchema>;

const ConsiglioChiamataSchema = z
  .object({
    playerId: z.number().int(),
    tipo: TipoConsiglioSchema,
    prezzoAtteso: z.number().nonnegative(),
    motivo: z.string().min(1),
  })
  .strict();
export type ConsiglioChiamata = z.infer<typeof ConsiglioChiamataSchema>;

const GravitaAlertSchema = z.enum(["critico", "attenzione", "info"]);
export type GravitaAlert = z.infer<typeof GravitaAlertSchema>;

const AlertSchema = z
  .object({
    gravita: GravitaAlertSchema,
    messaggio: z.string().min(1),
    azione: z.string().min(1),
  })
  .strict();
export type Alert = z.infer<typeof AlertSchema>;

export const AnalisiAstaLiveSchema = z
  .object({
    meta: MetaSchema,
    mercato: MercatoSchema,
    avversari: z.array(AvversarioAnalizzatoSchema),
    minaccePerSlot: z.array(MinacciaPerSlotSchema),
    pianoAggiornato: PianoAggiornatoSchema,
    consigliChiamata: z.array(ConsiglioChiamataSchema),
    alert: z.array(AlertSchema),
    sintesi: z.string().min(1),
  })
  .strict();
export type AnalisiAstaLive = z.infer<typeof AnalisiAstaLiveSchema>;
