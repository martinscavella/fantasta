"use server";

import { updateAliases } from "@/lib/blob/repository";

export type SalvaAliasResult = { ok: true } | { ok: false; error: string };

export async function salvaAlias(fonte: string, nomeOriginale: string, playerId: number | null): Promise<SalvaAliasResult> {
  await updateAliases((current) => ({
    overrides: [
      ...current.overrides.filter((a) => !(a.fonte === fonte && a.nomeOriginale === nomeOriginale)),
      { fonte, nomeOriginale, playerId, decidedAt: Date.now() },
    ],
  }));

  return { ok: true };
}
