"use server";

import { updateStrategy } from "@/lib/blob/repository";
import { StrategyDocSchema, type StrategyDoc } from "@/lib/blob/schemas";
import type { StrategiaGenerata } from "@/lib/ai/schemas";

export type SalvaStrategiaResult = { ok: true; savedAt: number } | { ok: false; error: string };

export async function salvaStrategia(astaId: string, strategyInput: StrategyDoc): Promise<SalvaStrategiaResult> {
  const parsed = StrategyDocSchema.safeParse({ ...strategyInput, updatedAt: Date.now() });
  if (!parsed.success) return { ok: false, error: "Dati non validi" };

  // Documento a singolo editor: l'ultima scrittura vince, niente merge come
  // per il board d'asta (event log) — qui non c'è nulla da unire.
  await updateStrategy(astaId, parsed.data, () => parsed.data);
  return { ok: true, savedAt: parsed.data.updatedAt };
}

// Non esportato: un file "use server" può esportare solo funzioni async
// (Next.js tratta ogni export come una server action) — vedi FALLBACK_VUOTO
// duplicato in src/lib/actions/analisi-live.ts, che ne ha bisogno anche lui.
const FALLBACK_VUOTO: Omit<StrategyDoc, "astaId"> = {
  fasce: [],
  budgetReparto: { P: 0, D: 0, C: 0, A: 0 },
  slotObiettivi: [],
  prezziMassimi: [],
  tettoSpesaEuro: null,
  template: null,
  sintesiIA: null,
  updatedAt: 0,
};

/**
 * Applica la risposta del generatore di strategia via Ponte IA (§ Ponte IA
 * nel piano): sostituisce fasce/budget/slot/prezzi con quanto generato,
 * marca i prezzi come origine "ia" e salva la sintesi in prosa. Preserva
 * `tettoSpesaEuro`/`template`, che il generatore non tocca.
 */
export async function applicaStrategiaGenerata(
  astaId: string,
  generata: StrategiaGenerata,
): Promise<SalvaStrategiaResult> {
  const savedAt = Date.now();
  try {
    await updateStrategy(astaId, { astaId, ...FALLBACK_VUOTO }, (current) =>
      StrategyDocSchema.parse({
        ...current,
        fasce: generata.fasce,
        budgetReparto: generata.budgetReparto,
        slotObiettivi: generata.slotObiettivi,
        prezziMassimi: generata.prezziMassimi.map((p) => ({ ...p, origine: "ia" as const })),
        sintesiIA: generata.sintesi,
        updatedAt: savedAt,
      }),
    );
  } catch {
    return { ok: false, error: "Impossibile salvare la strategia generata" };
  }
  return { ok: true, savedAt };
}
