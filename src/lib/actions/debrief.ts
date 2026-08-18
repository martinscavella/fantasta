"use server";

import { requireSession } from "@/lib/auth";
import { putDebrief } from "@/lib/blob/repository";

export type SalvaDebriefResult = { ok: true; savedAt: number } | { ok: false; error: string };

// Prosa libera (§ Debrief post-asta nel piano): nessuna validazione zod sul
// contenuto, si salva così com'è incollato dalla chat.
export async function salvaDebrief(astaId: string, testo: string): Promise<SalvaDebriefResult> {
  if (!(await requireSession())) return { ok: false, error: "Sessione scaduta, ricarica la pagina" };

  const updatedAt = Date.now();
  await putDebrief({ astaId, testo, updatedAt });
  return { ok: true, savedAt: updatedAt };
}
