"use client";

import { useEffect, useRef, useState } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import type { Player } from "@/lib/blob/schemas";
import type { StatoSquadraDerivato } from "@/lib/asta/derive";

type Fase =
  | { tipo: "cerca" }
  | { tipo: "prezzo"; giocatore: Player }
  | { tipo: "squadra"; giocatore: Player; prezzo: number };

export function CommandBar({
  giocatoriLiberi,
  squadre,
  onAssegna,
}: {
  giocatoriLiberi: Player[];
  squadre: StatoSquadraDerivato[];
  onAssegna: (playerId: number, teamId: string, price: number) => void;
}) {
  const [fase, setFase] = useState<Fase>({ tipo: "cerca" });
  const [query, setQuery] = useState("");
  const prezzoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (fase.tipo === "prezzo") prezzoInputRef.current?.focus();
  }, [fase]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && fase.tipo !== "cerca") {
        setFase({ tipo: "cerca" });
        setQuery("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fase.tipo]);

  if (fase.tipo === "cerca") {
    return (
      <Command className="rounded-xl border border-border" shouldFilter>
        <CommandInput
          placeholder="Cerca giocatore… (nome o squadra)"
          value={query}
          onValueChange={setQuery}
          autoFocus
        />
        <CommandList>
          <CommandEmpty>Nessun giocatore libero trovato.</CommandEmpty>
          <CommandGroup>
            {giocatoriLiberi.slice(0, 200).map((g) => (
              <CommandItem
                key={g.id}
                value={`${g.nome} ${g.squadra} ${g.ruolo}`}
                onSelect={() => {
                  setFase({ tipo: "prezzo", giocatore: g });
                  setQuery("");
                }}
              >
                <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">{g.ruolo}</span>
                <span className="flex-1">{g.nome}</span>
                <span className="text-xs text-muted-foreground">{g.squadra}</span>
                <span className="font-mono text-xs">{g.quotazioneAttuale}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    );
  }

  if (fase.tipo === "prezzo") {
    return (
      <form
        className="flex items-center gap-3 rounded-xl border border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const prezzo = Number(formData.get("prezzo"));
          if (!Number.isInteger(prezzo) || prezzo < 0) return;
          setFase({ tipo: "squadra", giocatore: fase.giocatore, prezzo });
        }}
      >
        <span className="font-mono text-xs text-muted-foreground">{fase.giocatore.ruolo}</span>
        <span className="flex-1 font-medium">{fase.giocatore.nome}</span>
        <span className="text-xs text-muted-foreground">Qt. {fase.giocatore.quotazioneAttuale}</span>
        <Input ref={prezzoInputRef} name="prezzo" type="number" min={0} step={1} placeholder="Prezzo" className="w-24" required />
      </form>
    );
  }

  const canAssign = (team: StatoSquadraDerivato) => {
    const residuo = team.slotResidui[fase.giocatore.ruolo];
    if (residuo <= 0) return { ok: false as const, motivo: `${fase.giocatore.ruolo} pieno` };
    if (team.massimaOfferta !== null && team.creditiResidui < fase.prezzo) {
      return { ok: false as const, motivo: "budget insufficiente" };
    }
    return { ok: true as const, motivo: null };
  };

  return (
    <Command className="rounded-xl border border-border" shouldFilter>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm">
        <span className="font-mono text-xs text-muted-foreground">{fase.giocatore.ruolo}</span>
        <span className="font-medium">{fase.giocatore.nome}</span>
        <span className="text-muted-foreground">a {fase.prezzo} crediti — scegli la squadra</span>
      </div>
      <CommandInput placeholder="Cerca squadra…" autoFocus />
      <CommandList>
        <CommandEmpty>Nessuna squadra trovata.</CommandEmpty>
        <CommandGroup>
          {squadre.map((team) => {
            const stato = canAssign(team);
            return (
              <CommandItem
                key={team.teamId}
                value={team.nome}
                disabled={!stato.ok}
                onSelect={() => {
                  if (!stato.ok) return;
                  onAssegna(fase.giocatore.id, team.teamId, fase.prezzo);
                  setFase({ tipo: "cerca" });
                }}
              >
                <span className="flex-1">{team.nome}</span>
                {stato.ok ? (
                  <span className="text-xs text-muted-foreground">{team.creditiResidui} crediti</span>
                ) : (
                  <span className="text-xs text-destructive">{stato.motivo}</span>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
