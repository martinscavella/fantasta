"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getListoneIndex, putSetup, updateAsteIndex } from "@/lib/blob/repository";
import { SetupDocSchema } from "@/lib/blob/schemas";

export type CreaAstaState = { error?: string } | undefined;

export async function creaAsta(_prevState: CreaAstaState, formData: FormData): Promise<CreaAstaState> {
  const nome = String(formData.get("nome") ?? "").trim();
  const stagione = String(formData.get("stagione") ?? "").trim();
  const creditiBase = Number(formData.get("creditiBase"));
  const slotP = Number(formData.get("slotP"));
  const slotD = Number(formData.get("slotD"));
  const slotC = Number(formData.get("slotC"));
  const slotA = Number(formData.get("slotA"));
  const sforoTipo = formData.get("sforoTipo");
  const euroPerCredito = Number(formData.get("euroPerCredito") ?? 0);
  const squadreRaw = String(formData.get("squadre") ?? "");
  const miaSquadraIndex = Number(formData.get("miaSquadraIndex") ?? 0);

  if (!nome || !stagione) return { error: "Nome e stagione sono obbligatori" };

  const index = await getListoneIndex(stagione);
  if (!index?.data.current) {
    return { error: `Nessun listone importato per la stagione "${stagione}" — importalo prima da /impostazioni/listone` };
  }

  const nomiSquadre = squadreRaw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (nomiSquadre.length < 2) return { error: "Servono almeno due squadre, una per riga" };
  if (!Number.isInteger(miaSquadraIndex) || miaSquadraIndex < 0 || miaSquadraIndex >= nomiSquadre.length) {
    return { error: "Indica quale squadra è la tua" };
  }

  const squadre = nomiSquadre.map((n) => ({ id: randomUUID(), nome: n }));

  let setup;
  try {
    setup = SetupDocSchema.parse({
      id: randomUUID(),
      nome,
      stagione,
      listoneVersionId: index.data.current,
      modalita: "classic",
      creditiBase,
      slot: { P: slotP, D: slotD, C: slotC, A: slotA },
      squadre,
      miaSquadraId: squadre[miaSquadraIndex].id,
      sforo: sforoTipo === "a-pagamento" ? { tipo: "a-pagamento", euroPerCredito } : { tipo: "nessuno" },
      createdAt: Date.now(),
    });
  } catch {
    return { error: "Dati non validi: controlla crediti e slot (numeri interi positivi)" };
  }

  await putSetup(setup);
  await updateAsteIndex((current) => ({
    aste: [...current.aste, { id: setup.id, nome: setup.nome, stagione: setup.stagione, createdAt: setup.createdAt }],
  }));

  redirect(`/asta/${setup.id}`);
}
