"use client";

import { useState } from "react";
import { Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { simulaRosa, type RisultatoSimulazione } from "@/lib/strategia/simula";
import { RUOLO_CLASSI } from "@/lib/ruoli";
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
    <div className="flex flex-col gap-4">
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setRisultato(simulaRosa(setup, giocatori, strategy))}>
        <Wand2 />
        Simula rosa
      </Button>

      {risultato && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-0.5 rounded-lg border border-border/60 p-2.5">
              <span className="text-xs text-muted-foreground">Spesa totale</span>
              <span className="font-mono text-lg font-semibold">
                {risultato.spesaTotale}
                <span className="text-sm font-normal text-muted-foreground"> / {setup.creditiBase}</span>
              </span>
              <Badge variant={risultato.entroBudget ? "secondary" : "outline"} className="w-fit">
                {risultato.entroBudget ? "entro budget" : "sopra budget"}
              </Badge>
            </div>
            <div className="flex flex-col gap-0.5 rounded-lg border border-border/60 p-2.5">
              <span className="text-xs text-muted-foreground">Copertura slot</span>
              <span className="text-lg text-amber-500">{stelle(risultato.rating.coperturaSlot)}</span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-lg border border-border/60 p-2.5">
              <span className="text-xs text-muted-foreground">Concentrazione spesa</span>
              <span className="text-lg text-amber-500">{stelle(risultato.rating.concentrazioneSpesa)}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Il fattore rischio (titolarità/infortuni) richiede i dati di scraping e non è ancora disponibile.
          </p>

          <ul className="flex flex-col gap-1">
            {risultato.slot.map((s) => (
              <li key={`${s.ruolo}-${s.indiceSlot}`} className="flex items-center gap-2 text-sm">
                <span className={`size-2 shrink-0 rounded-full ${RUOLO_CLASSI[s.ruolo].dot}`} title={s.ruolo} />
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
