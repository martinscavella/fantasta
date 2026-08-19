"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GiocatorePicker } from "@/components/shared/giocatore-picker";
import { RUOLI, RUOLO_CLASSI, RUOLO_LABEL } from "@/lib/ruoli";
import type { ObiettivoSlot, Player, Ruolo, SlotPerRuolo } from "@/lib/blob/schemas";

function chiave(ruolo: Ruolo, indice: number): string {
  return `${ruolo}-${indice}`;
}

export function SlotObiettiviEditor({
  slot,
  giocatori,
  slotObiettivi,
  onChange,
}: {
  slot: SlotPerRuolo;
  giocatori: Player[];
  slotObiettivi: ObiettivoSlot[];
  onChange: (slotObiettivi: ObiettivoSlot[]) => void;
}) {
  const giocatoriPerId = useMemo(() => new Map(giocatori.map((g) => [g.id, g])), [giocatori]);
  const perChiave = useMemo(() => new Map(slotObiettivi.map((o) => [chiave(o.ruolo, o.indiceSlot), o])), [slotObiettivi]);

  function upsert(ruolo: Ruolo, indice: number, cambio: Partial<ObiettivoSlot>) {
    const esistente = perChiave.get(chiave(ruolo, indice)) ?? {
      ruolo,
      indiceSlot: indice,
      obiettivoPrincipale: null,
      alternative: [],
    };
    const aggiornato = { ...esistente, ...cambio };
    const senzaQuesto = slotObiettivi.filter((o) => !(o.ruolo === ruolo && o.indiceSlot === indice));
    onChange([...senzaQuesto, aggiornato]);
  }

  function nomeGiocatore(id: number): string {
    return giocatoriPerId.get(id)?.nome ?? `#${id}`;
  }

  return (
    <div className="flex flex-col gap-4">
      {RUOLI.filter((r) => slot[r] > 0).map((ruolo) => (
        <div key={ruolo} className="flex flex-col gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <span className={`size-2 rounded-full ${RUOLO_CLASSI[ruolo].dot}`} />
            {RUOLO_LABEL[ruolo]}
          </h3>
          {Array.from({ length: slot[ruolo] }, (_, indice) => {
            const obiettivo = perChiave.get(chiave(ruolo, indice));
            const usati = new Set(
              [obiettivo?.obiettivoPrincipale, ...(obiettivo?.alternative ?? [])].filter(
                (id): id is number => id !== null && id !== undefined,
              ),
            );
            const candidati = giocatori.filter((g) => g.ruolo === ruolo && !usati.has(g.id));

            return (
              <div key={indice} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 p-2">
                <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">#{indice + 1}</span>

                {obiettivo?.obiettivoPrincipale ? (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => upsert(ruolo, indice, { obiettivoPrincipale: null })}
                  >
                    {nomeGiocatore(obiettivo.obiettivoPrincipale)} ×
                  </Badge>
                ) : (
                  <GiocatorePicker
                    giocatori={candidati}
                    label="Obiettivo principale"
                    onSelect={(id) => upsert(ruolo, indice, { obiettivoPrincipale: id })}
                  />
                )}

                <span className="text-xs text-muted-foreground">alternative:</span>
                {(obiettivo?.alternative ?? []).map((id) => (
                  <Badge
                    key={id}
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() =>
                      upsert(ruolo, indice, {
                        alternative: (obiettivo?.alternative ?? []).filter((a) => a !== id),
                      })
                    }
                  >
                    {nomeGiocatore(id)} ×
                  </Badge>
                ))}
                <GiocatorePicker
                  giocatori={candidati}
                  label="+ alternativa"
                  onSelect={(id) =>
                    upsert(ruolo, indice, { alternative: [...(obiettivo?.alternative ?? []), id] })
                  }
                />

                {(obiettivo?.obiettivoPrincipale || (obiettivo?.alternative.length ?? 0) > 0) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="ml-auto"
                    onClick={() => upsert(ruolo, indice, { obiettivoPrincipale: null, alternative: [] })}
                  >
                    Svuota
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
