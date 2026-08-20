"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ClubBadge } from "@/components/shared/club-badge";
import { RUOLO_CLASSI } from "@/lib/ruoli";
import { cn } from "@/lib/utils";
import type { Player } from "@/lib/blob/schemas";

// Prima il pannello di ricerca era posizionato a mano
// (`absolute top-0 left-0` dentro un `relative inline-block` di dimensione
// zero): copriva il contenuto della riga da cui veniva aperto, veniva tagliato
// dal primo antenato con overflow, e non si chiudeva cliccando fuori. Ora si
// appoggia al Popover di Base UI, che lo mette in un portale e gestisce
// posizionamento, chiusura e fuoco.

export function GiocatorePicker({
  giocatori,
  onSelect,
  label,
  variant = "outline",
}: {
  giocatori: Player[];
  onSelect: (playerId: number) => void;
  label: string;
  variant?: "outline" | "ghost" | "secondary";
}) {
  const [aperto, setAperto] = useState(false);

  return (
    <Popover open={aperto} onOpenChange={setAperto}>
      <PopoverTrigger
        render={
          <Button type="button" variant={variant} size="xs">
            {label}
          </Button>
        }
      />
      {/* overflow-hidden sul popup e h-auto sul Command: la lista ha gia una
          sua area scrollabile (max-h-72), e lasciare lo scroll anche al
          contenitore ne creerebbe due annidate. */}
      <PopoverContent className="w-72 overflow-hidden p-0">
        <Command className="h-auto">
          <CommandInput placeholder="Cerca giocatore…" autoFocus />
          <CommandList>
            <CommandEmpty>Nessun giocatore disponibile.</CommandEmpty>
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
                  <span
                    className={cn(
                      "w-5 shrink-0 rounded px-1 text-center font-mono text-[10px] font-semibold",
                      RUOLO_CLASSI[g.ruolo].badge,
                    )}
                  >
                    {g.ruolo}
                  </span>
                  <ClubBadge squadra={g.squadra} size="xs" />
                  <span className="flex-1 truncate">{g.nome}</span>
                  {/* La quotazione è il dato che serve per scegliere: senza,
                      si sceglieva un obiettivo senza sapere quanto costa. */}
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{g.quotazioneAttuale}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
