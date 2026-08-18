"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GiocatorePicker } from "@/components/shared/giocatore-picker";
import { salvaAlias } from "@/lib/actions/statistiche";
import type { Player } from "@/lib/blob/schemas";

export type RigaDaRivedere = { fonte: string; nomeOriginale: string; presenze?: number; mediaVoto?: number };

function chiave(r: RigaDaRivedere) {
  return `${r.fonte}::${r.nomeOriginale}`;
}

export function CodaRevisione({ righe, giocatori }: { righe: RigaDaRivedere[]; giocatori: Player[] }) {
  const [decise, setDecise] = useState<Set<string>>(new Set());
  const [inCorso, setInCorso] = useState<Set<string>>(new Set());

  // Niente useTransition: avviarla da un handler di cmdk il cui componente si
  // smonta subito dopo (il picker torna al bottone) ha lasciato la transition
  // bloccata in pending per sempre in test reali — async/await con setState
  // normali (React 18+ le mette comunque in batch) è più prevedibile qui.
  async function decidi(r: RigaDaRivedere, playerId: number | null) {
    const k = chiave(r);
    setInCorso((prev) => new Set(prev).add(k));
    const risultato = await salvaAlias(r.fonte, r.nomeOriginale, playerId);
    if (risultato.ok) setDecise((prev) => new Set(prev).add(k));
    setInCorso((prev) => {
      const next = new Set(prev);
      next.delete(k);
      return next;
    });
  }

  const daMostrare = righe.filter((r) => !decise.has(chiave(r)));

  if (daMostrare.length === 0) {
    return <p className="text-sm text-muted-foreground">Nessuna riga da rivedere.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {daMostrare.map((r) => (
        <li key={chiave(r)} className="flex items-center gap-3 rounded-lg border border-border p-2 text-sm">
          <div className="flex flex-1 flex-col">
            <span className="font-medium">{r.nomeOriginale}</span>
            <span className="text-xs text-muted-foreground">
              fonte: {r.fonte}
              {r.presenze !== undefined && ` · ${r.presenze} presenze`}
              {r.mediaVoto !== undefined && ` · mv ${r.mediaVoto}`}
            </span>
          </div>
          <Badge variant="outline">da rivedere</Badge>
          <GiocatorePicker giocatori={giocatori} label="Assegna a…" onSelect={(id) => void decidi(r, id)} />
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={inCorso.has(chiave(r))}
            onClick={() => void decidi(r, null)}
          >
            Non è un giocatore
          </Button>
        </li>
      ))}
    </ul>
  );
}
