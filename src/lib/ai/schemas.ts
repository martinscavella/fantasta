import { z } from "zod";
import { BudgetPerRuoloSchema, LivelloRischioSchema, RuoloSchema } from "@/lib/blob/schemas";

// Schemi delle RISPOSTE dell'IA (§ Ponte IA nel piano), non dei documenti Blob:
// stessa fonte di verità per validare il testo incollato in chat E generare lo
// schema JSON incluso nel prompt (via z.toJSONSchema — zod 4 lo produce
// nativamente, non serve la dipendenza "zod-to-json-schema" citata nel piano,
// scritta pensando a zod 3).

// --- Generatore di strategia --------------------------------------------------

export const FasciaGeneratasSchema = z.object({
  nome: z.string().min(1),
  sogliaMin: z.number().nonnegative(),
  sogliaMax: z.number().nullable(),
});

export const ObiettivoSlotGeneratoSchema = z.object({
  ruolo: RuoloSchema,
  indiceSlot: z.number().int().nonnegative(),
  obiettivoPrincipale: z.number().int().nullable(),
  alternative: z.array(z.number().int()),
});

export const PrezzoMassimoGeneratoSchema = z.object({
  playerId: z.number().int(),
  valore: z.number().nonnegative(),
});

export const StrategiaGeneratasSchema = z.object({
  fasce: z.array(FasciaGeneratasSchema).min(1),
  budgetReparto: BudgetPerRuoloSchema,
  slotObiettivi: z.array(ObiettivoSlotGeneratoSchema),
  prezziMassimi: z.array(PrezzoMassimoGeneratoSchema),
  sintesi: z.string().min(1),
});
export type StrategiaGenerata = z.infer<typeof StrategiaGeneratasSchema>;

// --- Dossier giocatori (a blocchi) -------------------------------------------

export const DossierGiocatoreGeneratoSchema = z.object({
  playerId: z.number().int(),
  puntiForza: z.array(z.string()),
  puntiDebolezza: z.array(z.string()),
  rischioInfortuni: LivelloRischioSchema,
  rischioTitolarita: LivelloRischioSchema,
  noteRecenti: z.string(),
  prezzoConsigliato: z.number().nonnegative(),
  motivazionePrezzo: z.string(),
  alternative: z.array(z.number().int()),
});
export type DossierGiocatoreGenerato = z.infer<typeof DossierGiocatoreGeneratoSchema>;

// blockId incluso nella risposta: permette di rifiutare un blocco incollato
// nello slot sbagliato (§ Dossier giocatori nel piano) invece di fondere dati
// del giocatore N nel blocco M.
export const DossierBloccoGeneratoSchema = z.object({
  blockId: z.string().min(1),
  giocatori: z.array(DossierGiocatoreGeneratoSchema).min(1),
});
export type DossierBloccoGenerato = z.infer<typeof DossierBloccoGeneratoSchema>;

// Il debrief post-asta non ha uno schema: è prosa libera da leggere, il piano
// lo dice esplicitamente ("non serve nemmeno importarla").
