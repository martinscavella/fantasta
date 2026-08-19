"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Player } from "@/lib/blob/schemas";

export type VoceLog = {
  eventId: string;
  ts: number;
  player: Player;
  teamId: string;
  teamNome: string;
  price: number;
};

export function EventLog({
  voci,
  squadre,
  onUndo,
  onEdit,
}: {
  voci: VoceLog[];
  squadre: { teamId: string; nome: string }[];
  onUndo: (eventId: string) => void;
  onEdit: (eventId: string, cambio: { price?: number; teamId?: string }) => void;
}) {
  const [inModifica, setInModifica] = useState<string | null>(null);

  const ordinate = [...voci].sort((a, b) => b.ts - a.ts);

  if (ordinate.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
        Nessuna assegnazione ancora.
      </p>
    );
  }

  return (
    <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-sm">
      {ordinate.map((voce) => (
        <li
          key={voce.eventId}
          className={cn(
            "flex items-center gap-2 rounded-lg px-2 text-sm hover:bg-accent/40",
            inModifica === voce.eventId ? "flex-wrap gap-y-1.5 py-1.5" : "h-8",
          )}
        >
          <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">{voce.player.ruolo}</span>
          <span className="flex-1 truncate">{voce.player.nome}</span>
          <span className="text-xs text-muted-foreground">{voce.teamNome}</span>

          {inModifica === voce.eventId ? (
            <form
              className="flex flex-1 flex-wrap items-center gap-1.5 basis-full justify-end"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const nuovoPrezzo = Number(form.get("price"));
                const nuovaSquadra = String(form.get("teamId"));
                onEdit(voce.eventId, {
                  price: Number.isInteger(nuovoPrezzo) ? nuovoPrezzo : undefined,
                  teamId: nuovaSquadra || undefined,
                });
                setInModifica(null);
              }}
            >
              <Input name="price" type="number" min={0} defaultValue={voce.price} className="h-7 w-16" />
              <Select
                name="teamId"
                defaultValue={voce.teamId}
                items={Object.fromEntries(squadre.map((s) => [s.teamId, s.nome]))}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {squadre.map((s) => (
                    <SelectItem key={s.teamId} value={s.teamId}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" size="xs">
                Salva
              </Button>
              <Button type="button" size="xs" variant="ghost" onClick={() => setInModifica(null)}>
                Chiudi
              </Button>
            </form>
          ) : (
            <>
              <span className="w-14 text-right font-mono">{voce.price}</span>
              <Button size="xs" variant="ghost" onClick={() => setInModifica(voce.eventId)}>
                Modifica
              </Button>
              <Button size="xs" variant="ghost" title="Annulla questa assegnazione: il giocatore torna libero" onClick={() => onUndo(voce.eventId)}>
                Rimuovi
              </Button>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
