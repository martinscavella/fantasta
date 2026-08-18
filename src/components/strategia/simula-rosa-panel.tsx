"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { simulaRosa, type RisultatoSimulazione } from "@/lib/strategia/simula";
import type { Player, SetupDoc, StrategyDoc } from "@/lib/blob/schemas";

function stelle(valore: number): string {
  if (valore === 0) return "—";
  return "★".repeat(valore) + "☆".repeat(5 - valore);
}

export function SimulaRosaPanel({
  setup,
  giocatori,
  strategy,
}: {
  setup: SetupDoc;
  giocatori: Player[];
  strategy: StrategyDoc;
}) {
  const [risultato, setRisultato] = useState<RisultatoSimulazione | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setRisultato(simulaRosa(setup, giocatori, strategy))}>
        Simula rosa
      </Button>

      {risultato && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              Spesa totale: <span className="font-mono">{risultato.spesaTotale}</span> / {setup.creditiBase}
            </span>
            <Badge variant={risultato.entroBudget ? "secondary" : "outline"}>
              {risultato.entroBudget ? "entro budget" : "sopra budget"}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-6 text-sm">
            <span>
              Copertura slot: <span className="font-mono">{stelle(risultato.rating.coperturaSlot)}</span>
            </span>
            <span>
              Concentrazione spesa: <span className="font-mono">{stelle(risultato.rating.concentrazioneSpesa)}</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Il fattore rischio (titolarità/infortuni) richiede i dati di scraping e non è ancora disponibile.
          </p>

          <ul className="flex flex-col gap-1">
            {risultato.slot.map((s) => (
              <li key={`${s.ruolo}-${s.indiceSlot}`} className="flex items-center gap-2 text-sm">
                <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">{s.ruolo}</span>
                {s.giocatore ? (
                  <>
                    <span className="flex-1">{s.giocatore.nome}</span>
                    {s.fonteScelta === "alternativa" && (
                      <Badge variant="outline" className="text-[10px]">
                        alternativa
                      </Badge>
                    )}
                    <span className="font-mono">{s.prezzo}</span>
                  </>
                ) : (
                  <span className="flex-1 text-muted-foreground">nessun obiettivo impostato</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
