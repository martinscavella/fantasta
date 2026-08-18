"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ListoneDataTable, MAX_CONFRONTO, type RigaListone } from "@/components/listone/data-table";
import { SchedaGiocatore } from "@/components/listone/scheda-giocatore";
import { ConfrontoDialog } from "@/components/listone/confronto-dialog";
import type { GiocatoreConStat } from "@/lib/statistiche/analisi";

export function ListoneClient({ giocatori }: { giocatori: RigaListone[] }) {
  const [schedaId, setSchedaId] = useState<number | null>(null);
  const [confrontoIds, setConfrontoIds] = useState<number[]>([]);
  const [confrontoAperto, setConfrontoAperto] = useState(false);

  // RigaListone porta già tutti i campi di GiocatoreConStat (più `fascia`, qui
  // ignorato): nessuna mappatura necessaria, è pura compatibilità strutturale.
  const giocatoriConStat: GiocatoreConStat[] = giocatori;
  const perId = useMemo(() => new Map(giocatoriConStat.map((g) => [g.id, g])), [giocatoriConStat]);

  const schedaGiocatore = schedaId !== null ? (perId.get(schedaId) ?? null) : null;
  const confrontoSet = useMemo(() => new Set(confrontoIds), [confrontoIds]);
  const giocatoriConfronto = confrontoIds.map((id) => perId.get(id)).filter((g): g is GiocatoreConStat => g !== undefined);

  function toggleConfronto(id: number) {
    setConfrontoIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= MAX_CONFRONTO ? prev : [...prev, id],
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ListoneDataTable
        giocatori={giocatori}
        selezionati={confrontoSet}
        onToggleSeleziona={toggleConfronto}
        onApriScheda={setSchedaId}
      />

      {confrontoIds.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-border p-2 text-sm">
          <span className="text-muted-foreground">
            In confronto ({confrontoIds.length}/{MAX_CONFRONTO}):
          </span>
          <span className="flex-1 truncate">{giocatoriConfronto.map((g) => g.nome).join(", ")}</span>
          <Button type="button" variant="outline" size="xs" onClick={() => setConfrontoIds([])}>
            Svuota
          </Button>
          <Button type="button" size="xs" disabled={confrontoIds.length < 2} onClick={() => setConfrontoAperto(true)}>
            Confronta
          </Button>
        </div>
      )}

      {schedaGiocatore && (
        <SchedaGiocatore
          giocatore={schedaGiocatore}
          tuttiGiocatori={giocatoriConStat}
          aperto={schedaId !== null}
          onOpenChange={(aperto) => !aperto && setSchedaId(null)}
          inConfronto={confrontoSet.has(schedaGiocatore.id)}
          confrontoPieno={confrontoIds.length >= MAX_CONFRONTO}
          onToggleConfronto={toggleConfronto}
          onApriGiocatore={setSchedaId}
        />
      )}

      <ConfrontoDialog
        giocatori={giocatoriConfronto}
        aperto={confrontoAperto}
        onOpenChange={setConfrontoAperto}
        onRimuovi={(id) => setConfrontoIds((prev) => prev.filter((x) => x !== id))}
      />
    </div>
  );
}
