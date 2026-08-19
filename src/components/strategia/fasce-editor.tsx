"use client";

import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Fascia } from "@/lib/blob/schemas";

export function FasceEditor({ fasce, onChange }: { fasce: Fascia[]; onChange: (fasce: Fascia[]) => void }) {
  function aggiorna(indice: number, campo: keyof Fascia, valore: string) {
    const next = fasce.map((f, i) => {
      if (i !== indice) return f;
      if (campo === "nome") return { ...f, nome: valore };
      const numero = valore === "" ? null : Number(valore);
      return { ...f, [campo]: campo === "sogliaMax" ? numero : (numero ?? 0) };
    });
    onChange(next);
  }

  function rimuovi(indice: number) {
    onChange(fasce.filter((_, i) => i !== indice));
  }

  function aggiungi() {
    onChange([...fasce, { nome: "Nuova fascia", sogliaMin: 0, sogliaMax: null }]);
  }

  return (
    <div className="flex flex-col gap-2">
      {fasce.map((fascia, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 p-2">
          <Badge variant="secondary" className="shrink-0">
            {i + 1}
          </Badge>
          <Input
            value={fascia.nome}
            onChange={(e) => aggiorna(i, "nome", e.target.value)}
            className="w-40"
          />
          <span className="text-xs text-muted-foreground">da</span>
          <Input
            type="number"
            min={0}
            value={fascia.sogliaMin}
            onChange={(e) => aggiorna(i, "sogliaMin", e.target.value)}
            className="w-20 font-mono"
          />
          <span className="text-xs text-muted-foreground">a</span>
          <Input
            type="number"
            min={0}
            placeholder="∞"
            value={fascia.sogliaMax ?? ""}
            onChange={(e) => aggiorna(i, "sogliaMax", e.target.value)}
            className="w-20 font-mono"
          />
          <Button type="button" variant="ghost" size="icon-xs" className="ml-auto" onClick={() => rimuovi(i)} aria-label="Rimuovi fascia">
            <X />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={aggiungi} className="w-fit">
        <Plus />
        Aggiungi fascia
      </Button>
    </div>
  );
}
