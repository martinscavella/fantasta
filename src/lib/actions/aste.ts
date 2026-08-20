"use server";

import { redirect } from "next/navigation";
import { costruisciSetup, salvaNuovaAsta } from "@/lib/asta/crea";
import { ConflictError, deleteAstaBlobs, getListoneIndex, getSetup, updateAsteIndex, updateSetup } from "@/lib/blob/repository";
import type { Squadra } from "@/lib/blob/schemas";

/**
 * Le scritture su setup.json e aste/index.json usano concorrenza ottimistica
 * (ifMatch + retry automatico dentro updateDoc — vedi blob/repository.ts). Un
 * ConflictError arriva qui solo quando anche i retry sono stati esauriti: una
 * vera collisione (due schede aperte, o due azioni partite quasi insieme),
 * non un bug da mostrare come messaggio tecnico — si traduce in un invito a
 * ricaricare e riprovare, coerente con "si rilegge, si fa merge e si riprova"
 * del piano.
 */
function messaggioErrore(err: unknown): string {
  if (err instanceof ConflictError) {
    return "Un'altra modifica è in corso su questa asta: ricarica la pagina e riprova.";
  }
  return err instanceof Error ? err.message : "Errore imprevisto.";
}

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

  let setup;
  try {
    setup = costruisciSetup({
      nome,
      stagione,
      listoneVersionId: index.data.current,
      creditiBase,
      slot: { P: slotP, D: slotD, C: slotC, A: slotA },
      nomiSquadre,
      miaSquadraIndex,
      sforo: sforoTipo === "a-pagamento" ? { tipo: "a-pagamento", euroPerCredito } : { tipo: "nessuno" },
    });
  } catch {
    return { error: "Dati non validi: controlla crediti e slot (numeri interi positivi)" };
  }

  await salvaNuovaAsta(setup);

  redirect(`/asta/${setup.id}`);
}

export type AggiornaSquadreResult = { ok: true } | { ok: false; error: string };

/**
 * Aggiorna solo i campi di personalizzazione delle squadre (allenatore,
 * squadra del cuore, note — § Impostazioni asta nel piano), mai id/nome: la
 * pagina impostazioni non permette di rinominare/aggiungere/rimuovere
 * squadre, solo di arricchirle. `modifiche` è indicizzato per id squadra,
 * niente merge speciale — ultima scrittura vince, come per la Strategia.
 */
export async function aggiornaSquadre(
  astaId: string,
  modifiche: Record<string, Pick<Squadra, "allenatore" | "squadraDelCuore" | "note">>,
): Promise<AggiornaSquadreResult> {
  try {
    const risultato = await updateSetup(astaId, (current) => ({
      ...current,
      squadre: current.squadre.map((s) => (modifiche[s.id] ? { ...s, ...modifiche[s.id] } : s)),
    }));
    if (!risultato) return { ok: false, error: "Asta non trovata." };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: messaggioErrore(err) };
  }
}

export type ImpostaMiaSquadraResult = { ok: true } | { ok: false; error: string };

/**
 * Cambia quale squadra tra quelle esistenti è "la mia" (SetupDoc.miaSquadraId
 * — vedi § Preparazione/Post-asta nel piano: è la squadra di cui Strategia e
 * Riepilogo calcolano scostamento e prezzi massimi). Non tocca l'elenco
 * squadre: quello resta fisso dalla creazione, solo il puntatore cambia.
 */
export async function impostaMiaSquadra(astaId: string, teamId: string): Promise<ImpostaMiaSquadraResult> {
  try {
    const risultato = await updateSetup(astaId, (current) => {
      if (!current.squadre.some((s) => s.id === teamId)) {
        throw new Error("Squadra non valida.");
      }
      return { ...current, miaSquadraId: teamId };
    });
    if (!risultato) return { ok: false, error: "Asta non trovata." };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: messaggioErrore(err) };
  }
}

export type EliminaAstaResult = { ok: true } | { ok: false; error: string };

/**
 * Cancella un'asta: tutti i suoi documenti su Blob (setup, strategy, board,
 * debrief, analisi-live — vedi deleteAstaBlobs) e la entry in aste/index.json.
 * Azione distruttiva e irreversibile: il chiamante deve aver già ottenuto
 * conferma dall'utente prima di invocarla (vedi EliminaAstaButton).
 */
export async function eliminaAsta(astaId: string): Promise<EliminaAstaResult> {
  const setup = await getSetup(astaId);
  if (!setup) return { ok: false, error: "Asta non trovata." };

  try {
    await deleteAstaBlobs(astaId);
    await updateAsteIndex((current) => ({
      aste: current.aste.filter((a) => a.id !== astaId),
    }));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: messaggioErrore(err) };
  }
}
