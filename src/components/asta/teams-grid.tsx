"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { RigaRosa, StatoSquadraDerivato } from "@/lib/asta/derive";
import type { Ruolo } from "@/lib/blob/schemas";

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];

export function TeamsGrid({
  squadre,
  rose,
}: {
  squadre: StatoSquadraDerivato[];
  rose: Record<string, RigaRosa[]>;
}) {
  const [espansa, setEspansa] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {squadre.map((team) => {
        const obblighi = RUOLI.filter((r) => team.obbligoPerRuolo[r]);
        return (
          <div key={team.teamId} className="flex flex-col gap-2 rounded-xl border border-border p-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="text-left font-medium hover:underline"
                onClick={() => setEspansa(espansa === team.teamId ? null : team.teamId)}
              >
                {team.nome}
              </button>
              {team.rosaCompleta && <Badge variant="secondary">Rosa completa</Badge>}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span>
                <span className="text-muted-foreground">Crediti </span>
                <span className={team.creditiResidui < 0 ? "font-mono text-destructive" : "font-mono"}>
                  {team.creditiResidui}
                </span>
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {RUOLI.map((r) => `${r} ${team.slotOccupati[r]}/${team.slotOccupati[r] + team.slotResidui[r]}`).join(" · ")}
              </span>
            </div>

            {team.massimaOfferta !== null ? (
              <p className="text-sm">
                <span className="text-muted-foreground">Massima offerta possibile: </span>
                <span className="font-mono font-medium">{team.massimaOfferta}</span>
              </p>
            ) : (
              <p className="text-sm">
                <span className="text-muted-foreground">Sforo: </span>
                <span className="font-mono font-medium">{team.sforoCrediti} crediti</span>
                {team.sforoEuro !== null && (
                  <span className="text-muted-foreground"> ({team.sforoEuro.toFixed(2)} €)</span>
                )}
              </p>
            )}

            {obblighi.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Obbligata a comprare: {obblighi.join(", ")}
              </p>
            )}

            {espansa === team.teamId && (
              <ul className="mt-1 flex flex-col gap-1 border-t border-border pt-2 text-sm">
                {(rose[team.teamId] ?? []).length === 0 ? (
                  <li className="text-muted-foreground">Nessun giocatore ancora acquistato.</li>
                ) : (
                  (rose[team.teamId] ?? []).map((riga) => (
                    <li key={riga.eventId} className="flex justify-between gap-2">
                      <span>
                        <span className="mr-1 font-mono text-xs text-muted-foreground">{riga.player.ruolo}</span>
                        {riga.player.nome}
                      </span>
                      <span className="font-mono">{riga.price}</span>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
