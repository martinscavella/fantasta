"use client";

import { useState } from "react";
import { PonteIA } from "@/components/ai/ponte-ia";
import { AiCallout } from "@/components/shared/ai-callout";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildPromptStrategia } from "@/lib/ai/prompts/strategia";
import { StrategiaGeneratasSchema } from "@/lib/ai/schemas";
import { applicaStrategiaGenerata } from "@/lib/actions/strategia";
import type { Player, SetupDoc } from "@/lib/blob/schemas";

const CAMPI = [
  {
    id: "stile",
    label: "Stile di squadra desiderato",
    placeholder: "es. corazzata difensiva, pochi bomber costosi e tanti difensori solidi",
  },
  {
    id: "rischio",
    label: "Propensione al rischio",
    placeholder: "es. accetto 3-4 scommesse ad alto potenziale, il resto certezze",
  },
  {
    id: "vincoli",
    label: "Vincoli personali (giocatori/squadre da evitare o prendere, tetto massimo)",
    placeholder: "es. mai giocatori del Genoa, Lautaro a ogni costo, mai oltre 200 su un singolo",
  },
  {
    id: "regolePunteggio",
    label: "Regole di punteggio particolari della lega",
    placeholder: "es. modificatore di difesa, portiere imbattuto, assist che valgono doppio",
  },
] as const;

type CampoId = (typeof CAMPI)[number]["id"];

export function TabStrategia({
  setup,
  giocatori,
  sintesiEsistente,
}: {
  setup: SetupDoc;
  giocatori: Player[];
  sintesiEsistente: string | null;
}) {
  const [valori, setValori] = useState<Record<CampoId, string>>({
    stile: "",
    rischio: "",
    vincoli: "",
    regolePunteggio: "",
  });

  return (
    <PonteIA
      schema={StrategiaGeneratasSchema}
      generaPrompt={() => buildPromptStrategia(setup, giocatori, valori)}
      onApplica={(data) => applicaStrategiaGenerata(setup.id, data)}
      messaggioSuccesso="Strategia applicata: fasce, budget e prezzi massimi sono aggiornati."
      parametri={
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {CAMPI.map((campo) => (
            <div key={campo.id} className="flex flex-col gap-1.5">
              <Label htmlFor={campo.id}>{campo.label}</Label>
              <Textarea
                id={campo.id}
                rows={2}
                placeholder={campo.placeholder}
                value={valori[campo.id]}
                onChange={(e) => setValori((prev) => ({ ...prev, [campo.id]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      }
    >
      {sintesiEsistente && <AiCallout label="Sintesi della strategia attuale" testo={sintesiEsistente} />}
    </PonteIA>
  );
}
