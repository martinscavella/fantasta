"use server";

import { requireSession } from "@/lib/auth";
import { updateStrategy } from "@/lib/blob/repository";
import { StrategyDocSchema, type StrategyDoc } from "@/lib/blob/schemas";

export type SalvaStrategiaResult = { ok: true; savedAt: number } | { ok: false; error: string };

export async function salvaStrategia(astaId: string, strategyInput: StrategyDoc): Promise<SalvaStrategiaResult> {
  if (!(await requireSession())) return { ok: false, error: "Sessione scaduta, ricarica la pagina" };

  const parsed = StrategyDocSchema.safeParse({ ...strategyInput, updatedAt: Date.now() });
  if (!parsed.success) return { ok: false, error: "Dati non validi" };

  // Documento a singolo editor: l'ultima scrittura vince, niente merge come
  // per il board d'asta (event log) — qui non c'è nulla da unire.
  await updateStrategy(astaId, parsed.data, () => parsed.data);
  return { ok: true, savedAt: parsed.data.updatedAt };
}
