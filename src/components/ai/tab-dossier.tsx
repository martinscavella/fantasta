"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import { PonteIA, type EsitoApplicazione } from "@/components/ai/ponte-ia";
import { Badge } from "@/components/ui/badge";
import { costruisciBlocchi, buildPromptDossier } from "@/lib/ai/prompts/dossier";
import { DossierBloccoGeneratoSchema } from "@/lib/ai/schemas";
import { salvaBloccoDossier } from "@/lib/actions/dossier";
import { cn } from "@/lib/utils";
import type { DossierEntry, Player } from "@/lib/blob/schemas";

// I dossier sono per stagione e valgono per entrambe le leghe (§ Dossier nel
// PLAN.md): si generano una volta e li si ritrova da qualunque asta della
// stessa stagione. Un blocco alla volta, con l'avanzamento sempre visibile.

export function TabDossier({
  stagione,
  giocatori,
  dossierEsistente,
}: {
  stagione: string;
  giocatori: Player[];
  dossierEsistente: DossierEntry[];
}) {
  const router = useRouter();
  const blocchi = useMemo(() => costruisciBlocchi(giocatori), [giocatori]);
  const importati = useMemo(() => new Set(dossierEsistente.map((d) => d.playerId)), [dossierEsistente]);
  const [attivo, setAttivo] = useState(0);

  const blocco = blocchi[attivo];
  const totaleFatti = giocatori.filter((g) => importati.has(g.id)).length;

  if (!blocco) {
    return <p className="text-sm text-muted-foreground">Nessun giocatore nel listone di questa stagione.</p>;
  }

  const fattiNelBlocco = blocco.giocatori.filter((g) => importati.has(g.id)).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {totaleFatti}/{giocatori.length} giocatori con dossier
        </Badge>
        <span className="text-sm text-muted-foreground">
          {blocchi.length} blocchi da ~{blocchi[0]?.giocatori.length ?? 0} — falli quando vuoi, il progresso resta salvato.
        </span>
      </div>

      {/* Selettore dei blocchi: il pallino pieno dice quali sono già importati,
          così si riprende da dove si era rimasti senza aprirli uno per uno. */}
      <div className="flex flex-wrap gap-1.5">
        {blocchi.map((b, i) => {
          const completo = b.giocatori.every((g) => importati.has(g.id));
          return (
            <button
              key={b.blockId}
              type="button"
              onClick={() => setAttivo(i)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                i === attivo
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {completo && <Check className="size-3" />}
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted/30 p-3">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <ChevronRight className="size-3.5" />
          {blocco.blockId}
          <Badge variant={fattiNelBlocco === blocco.giocatori.length ? "secondary" : "outline"}>
            {fattiNelBlocco}/{blocco.giocatori.length} importati
          </Badge>
        </span>
        <span className="text-xs text-muted-foreground">{blocco.giocatori.map((g) => g.nome).join(", ")}</span>
      </div>

      {/* key: rimontando il ponte a ogni cambio blocco, prompt e risposta del
          blocco precedente non restano appesi in un blocco diverso. */}
      <PonteIA
        key={blocco.blockId}
        schema={DossierBloccoGeneratoSchema}
        generaPrompt={() => buildPromptDossier(blocco)}
        onApplica={async (data): Promise<EsitoApplicazione> => {
          const esito = await salvaBloccoDossier(stagione, blocco.blockId, data);
          if (!esito.ok) return { ok: false, error: esito.error };
          router.refresh();
          return { ok: true };
        }}
        etichettaApplica="Valida e salva blocco"
        messaggioSuccesso="Blocco salvato."
      />
    </div>
  );
}
