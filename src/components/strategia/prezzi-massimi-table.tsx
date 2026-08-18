"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fasciaStandard, prezzoMassimoDefault } from "@/lib/pricing";
import type { Player, PrezzoMassimo, Ruolo } from "@/lib/blob/schemas";

const TUTTI = "_tutti";
const RUOLI: Ruolo[] = ["P", "D", "C", "A"];

export function PrezziMassimiTable({
  giocatori,
  prezziMassimi,
  onChange,
}: {
  giocatori: Player[];
  prezziMassimi: PrezzoMassimo[];
  onChange: (prezzi: PrezzoMassimo[]) => void;
}) {
  const [filtroRuolo, setFiltroRuolo] = useState<string>(TUTTI);
  const [filtroTesto, setFiltroTesto] = useState("");

  const prezzoPerId = useMemo(() => new Map(prezziMassimi.map((p) => [p.playerId, p])), [prezziMassimi]);

  const filtrati = useMemo(() => {
    const query = filtroTesto.trim().toLowerCase();
    return giocatori.filter((g) => {
      if (filtroRuolo !== TUTTI && g.ruolo !== filtroRuolo) return false;
      if (query && !g.nome.toLowerCase().includes(query) && !g.squadra.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [giocatori, filtroRuolo, filtroTesto]);

  function imposta(playerId: number, valore: number) {
    const esistente = prezzoPerId.has(playerId);
    const next = esistente
      ? prezziMassimi.map((p) => (p.playerId === playerId ? { ...p, valore, origine: "manuale" as const } : p))
      : [...prezziMassimi, { playerId, valore, origine: "manuale" as const }];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          placeholder="Cerca giocatore…"
          value={filtroTesto}
          onChange={(e) => setFiltroTesto(e.target.value)}
          className="max-w-xs"
        />
        <Select value={filtroRuolo} onValueChange={(v) => setFiltroRuolo(v ?? TUTTI)}>
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TUTTI}>Tutti</SelectItem>
            {RUOLI.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="max-h-96 overflow-y-auto rounded-xl border border-border">
        <ul className="flex flex-col">
          {filtrati.slice(0, 150).map((g) => {
            const impostato = prezzoPerId.get(g.id);
            const valore = impostato?.valore ?? prezzoMassimoDefault(g.quotazioneAttuale);
            const fascia = fasciaStandard(g.quotazioneAttuale);
            return (
              <li key={g.id} className="flex items-center gap-2 border-b border-border/60 px-2 py-1.5 text-sm">
                <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground">{g.ruolo}</span>
                <span className="flex-1 truncate">{g.nome}</span>
                <span className="text-xs text-muted-foreground">{g.squadra}</span>
                {fascia && (
                  <Badge variant="outline" className="text-[10px]">
                    {fascia}
                  </Badge>
                )}
                <span className="w-10 text-right font-mono text-xs text-muted-foreground">
                  Qt. {g.quotazioneAttuale}
                </span>
                <Input
                  type="number"
                  min={0}
                  value={valore}
                  onChange={(e) => imposta(g.id, Number(e.target.value))}
                  className="h-7 w-20"
                />
                <Badge variant={impostato?.origine === "manuale" ? "secondary" : "outline"} className="text-[10px]">
                  {impostato?.origine ?? "calcolato"}
                </Badge>
              </li>
            );
          })}
        </ul>
        {filtrati.length > 150 && (
          <p className="p-2 text-xs text-muted-foreground">Mostrati 150 di {filtrati.length} — affina il filtro.</p>
        )}
      </div>
    </div>
  );
}
