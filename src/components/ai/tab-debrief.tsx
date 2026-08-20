"use client";

import { useState } from "react";
import { PonteIATesto, type EsitoApplicazione } from "@/components/ai/ponte-ia";
import { AiCallout } from "@/components/shared/ai-callout";
import { buildPromptDebrief } from "@/lib/ai/prompts/debrief";
import { salvaDebrief } from "@/lib/actions/debrief";
import type { RigaRosa } from "@/lib/asta/derive";
import type { SetupDoc, StrategyDoc } from "@/lib/blob/schemas";

// Il debrief è prosa da leggere, non JSON da importare (§ Debrief post-asta
// nel PLAN.md): niente schema, la risposta si salva così com'è.

export function TabDebrief({
  setup,
  rosaMia,
  strategy,
  debriefIniziale,
}: {
  setup: SetupDoc;
  rosaMia: RigaRosa[];
  strategy: StrategyDoc | null;
  debriefIniziale: string;
}) {
  const [debrief, setDebrief] = useState(debriefIniziale);

  return (
    <PonteIATesto
      generaPrompt={() => buildPromptDebrief(setup.nome, rosaMia, strategy)}
      onApplica={async (testo): Promise<EsitoApplicazione> => {
        const esito = await salvaDebrief(setup.id, testo);
        if (!esito.ok) return { ok: false, error: esito.error };
        setDebrief(testo);
        return { ok: true };
      }}
      etichettaApplica="Salva debrief"
      messaggioSuccesso="Debrief salvato."
    >
      {debrief && <AiCallout label="Debrief salvato" testo={debrief} />}
    </PonteIATesto>
  );
}
