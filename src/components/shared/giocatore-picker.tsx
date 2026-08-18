"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { Player } from "@/lib/blob/schemas";

export function GiocatorePicker({
  giocatori,
  onSelect,
  label,
}: {
  giocatori: Player[];
  onSelect: (playerId: number) => void;
  label: string;
}) {
  const [aperto, setAperto] = useState(false);

  if (!aperto) {
    return (
      <Button type="button" variant="outline" size="xs" onClick={() => setAperto(true)}>
        {label}
      </Button>
    );
  }

  return (
    <div className="relative inline-block">
      <Command className="absolute top-0 left-0 z-50 h-auto w-64 rounded-lg border border-border bg-popover shadow-md">
        <CommandInput placeholder="Cerca giocatore…" autoFocus />
        <CommandList>
          <CommandEmpty>Nessun risultato.</CommandEmpty>
          <CommandGroup>
            {giocatori.slice(0, 100).map((g) => (
              <CommandItem
                key={g.id}
                value={`${g.nome} ${g.squadra} ${g.ruolo}`}
                onSelect={() => {
                  onSelect(g.id);
                  setAperto(false);
                }}
              >
                <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground">{g.ruolo}</span>
                <span className="flex-1 truncate">{g.nome}</span>
                <span className="text-xs text-muted-foreground">{g.squadra}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
        <div className="border-t border-border p-1">
          <Button type="button" variant="ghost" size="xs" className="w-full" onClick={() => setAperto(false)}>
            Chiudi
          </Button>
        </div>
      </Command>
    </div>
  );
}
