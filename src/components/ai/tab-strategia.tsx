"use client";

import { useState } from "react";
import { PonteIA } from "@/components/ai/ponte-ia";
import { GruppoScelte } from "@/components/ai/gruppo-scelte";
import { AiCallout } from "@/components/shared/ai-callout";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildPromptStrategia,
  PREFERENZE,
  REGOLE_PUNTEGGIO,
  RISCHI,
  STILI,
  type InputGeneratoreStrategia,
} from "@/lib/ai/prompts/strategia";
import { StrategiaGeneratasSchema } from "@/lib/ai/schemas";
import { applicaStrategiaGenerata } from "@/lib/actions/strategia";
import type { Player, SetupDoc } from "@/lib/blob/schemas";

const INIZIALE: InputGeneratoreStrategia = {
  stili: [],
  rischio: "equilibrato",
  regolePunteggio: [],
  preferenze: [],
  note: "",
};

export function TabStrategia({
  setup,
  giocatori,
  sintesiEsistente,
}: {
  setup: SetupDoc;
  giocatori: Player[];
  sintesiEsistente: string | null;
}) {
  const [input, setInput] = useState<InputGeneratoreStrategia>(INIZIALE);

  function aggiorna(cambio: Partial<InputGeneratoreStrategia>) {
    setInput((prev) => ({ ...prev, ...cambio }));
  }

  return (
    <PonteIA
      schema={StrategiaGeneratasSchema}
      generaPrompt={() => buildPromptStrategia(setup, giocatori, input)}
      onApplica={(data) => applicaStrategiaGenerata(setup.id, data)}
      messaggioSuccesso="Strategia applicata: fasce, budget e prezzi massimi sono aggiornati."
      parametri={
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <GruppoScelte
            titolo="Regole di punteggio della lega"
            descrizione="cambiano quanto vale un reparto — è la personalizzazione che le guide generiche non fanno"
            opzioni={REGOLE_PUNTEGGIO}
            selezionati={input.regolePunteggio}
            onChange={(regolePunteggio) => aggiorna({ regolePunteggio })}
          />

          <GruppoScelte
            titolo="Stile di rosa"
            descrizione="anche più di uno; lascia vuoto per farlo decidere all'IA"
            opzioni={STILI}
            selezionati={input.stili}
            onChange={(stili) => aggiorna({ stili })}
          />

          <GruppoScelte
            titolo="Propensione al rischio"
            opzioni={RISCHI}
            selezionati={[input.rischio]}
            onChange={([rischio]) => aggiorna({ rischio })}
            singola
          />

          <GruppoScelte
            titolo="Preferenze sui giocatori"
            opzioni={PREFERENZE}
            selezionati={input.preferenze}
            onChange={(preferenze) => aggiorna({ preferenze })}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note-strategia">
              Note libere
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                nomi specifici da prendere o evitare, tetto su un singolo giocatore, tutto ciò che le caselle non
                coprono
              </span>
            </Label>
            <Textarea
              id="note-strategia"
              rows={3}
              placeholder="es. Lautaro a ogni costo, mai giocatori del Genoa, mai oltre 200 crediti su un singolo"
              value={input.note}
              onChange={(e) => aggiorna({ note: e.target.value })}
            />
          </div>
        </div>
      }
    >
      {sintesiEsistente && <AiCallout label="Sintesi della strategia attuale" testo={sintesiEsistente} />}
    </PonteIA>
  );
}
