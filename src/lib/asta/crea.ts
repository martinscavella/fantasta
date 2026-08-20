import { randomUUID } from "node:crypto";
import { putSetup, updateAsteIndex } from "@/lib/blob/repository";
import { SetupDocSchema, type RegoleSforo, type SetupDoc, type SlotPerRuolo } from "@/lib/blob/schemas";

// Creazione di un'asta, condivisa dai due percorsi che la producono: il form
// "Nuova asta" (src/lib/actions/aste.ts) e l'import di un'asta già conclusa
// (src/app/api/rose/import/route.ts). Vive qui e non in actions/aste.ts perché
// quello è un modulo "use server", dove ogni export dev'essere async: un
// costruttore sincrono non può starci.

export type NuovaAstaInput = {
  nome: string;
  stagione: string;
  listoneVersionId: string;
  creditiBase: number;
  slot: SlotPerRuolo;
  nomiSquadre: string[];
  miaSquadraIndex: number;
  sforo: RegoleSforo;
};

/** Costruisce e valida il SetupDoc. Lancia se i valori non passano lo schema. */
export function costruisciSetup(input: NuovaAstaInput): SetupDoc {
  const squadre = input.nomiSquadre.map((nome) => ({ id: randomUUID(), nome }));
  return SetupDocSchema.parse({
    id: randomUUID(),
    nome: input.nome,
    stagione: input.stagione,
    listoneVersionId: input.listoneVersionId,
    modalita: "classic",
    creditiBase: input.creditiBase,
    slot: input.slot,
    squadre,
    miaSquadraId: squadre[input.miaSquadraIndex]?.id,
    sforo: input.sforo,
    createdAt: Date.now(),
  });
}

/** Scrive il setup e registra l'asta nell'indice. */
export async function salvaNuovaAsta(setup: SetupDoc): Promise<void> {
  await putSetup(setup);
  await updateAsteIndex((current) => ({
    aste: [
      ...current.aste,
      { id: setup.id, nome: setup.nome, stagione: setup.stagione, createdAt: setup.createdAt },
    ],
  }));
}
