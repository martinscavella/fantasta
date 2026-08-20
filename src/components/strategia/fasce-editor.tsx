"use client";

import { useMemo } from "react";
import { Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  aggiungiFascia,
  conteggioPerFascia,
  giocatoriFuoriFascia,
  impostaSoglia,
  normalizzaFasce,
  rimuoviFascia,
  rinominaFascia,
} from "@/lib/strategia/fasce";
import { fasceStandard } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { Fascia, Player } from "@/lib/blob/schemas";

// Le fasce sono una partizione dell'asse dei prezzi: si modifica solo il
// pavimento di ciascuna e il tetto si ricalcola da solo (vedi
// lib/strategia/fasce.ts). Prima erano quattro righe di input scollegate in
// cui lo stesso confine si digitava due volte, senza alcun riscontro su
// quanti giocatori finissero davvero in ogni fascia — che è l'unica cosa che
// dice se una soglia ha senso.

const COLORI = [
  "bg-primary",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
] as const;

export function FasceEditor({
  fasce,
  giocatori,
  creditiBase,
  onChange,
}: {
  fasce: Fascia[];
  giocatori: Player[];
  creditiBase: number;
  onChange: (fasce: Fascia[]) => void;
}) {
  const normalizzate = useMemo(() => normalizzaFasce(fasce), [fasce]);
  const conteggi = useMemo(() => conteggioPerFascia(normalizzate, giocatori), [normalizzate, giocatori]);
  const fuori = useMemo(() => giocatoriFuoriFascia(normalizzate, giocatori), [normalizzate, giocatori]);
  const massimo = Math.max(1, ...conteggi.map((c) => c.giocatori));

  return (
    <div className="flex flex-col gap-3">
      {/* Barra di ripartizione: quanto pesa ogni fascia sul listone, a colpo
          d'occhio, prima ancora di leggere i numeri. */}
      {giocatori.length > 0 && (
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
          {conteggi.map((c, i) => (
            <div
              key={c.fascia.nome + i}
              className={cn("h-full transition-all", COLORI[i % COLORI.length])}
              style={{ width: `${(c.giocatori / Math.max(1, giocatori.length - fuori)) * 100}%` }}
              title={`${c.fascia.nome}: ${c.giocatori} giocatori`}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {normalizzate.map((fascia, i) => {
          const conteggio = conteggi[i];
          return (
            <div
              key={i}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 p-2 transition-colors hover:border-border"
            >
              <span className={cn("size-2.5 shrink-0 rounded-full", COLORI[i % COLORI.length])} aria-hidden />

              <Input
                value={fascia.nome}
                onChange={(e) => onChange(rinominaFascia(normalizzate, i, e.target.value))}
                className="w-36"
                aria-label={`Nome della fascia ${i + 1}`}
              />

              {/* Solo il pavimento è modificabile: il tetto è per definizione
                  il pavimento della fascia sopra meno uno, e digitarlo a mano
                  era il modo di aprire buchi nella partizione. */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">da</span>
                <Input
                  type="number"
                  min={0}
                  value={fascia.sogliaMin}
                  onChange={(e) => onChange(impostaSoglia(normalizzate, i, Number(e.target.value)))}
                  className="w-20 font-mono"
                  aria-label={`Soglia minima di ${fascia.nome}`}
                />
                <span className="font-mono text-xs text-muted-foreground">
                  {fascia.sogliaMax === null ? "e oltre" : `a ${fascia.sogliaMax}`}
                </span>
              </div>

              {/* Istogramma: il riscontro che mancava del tutto. */}
              <div className="flex min-w-32 flex-1 items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", COLORI[i % COLORI.length])}
                    style={{ width: `${(conteggio.giocatori / massimo) * 100}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                  <span className="font-mono font-semibold text-foreground">{conteggio.giocatori}</span> giocatori
                </span>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => onChange(rimuoviFascia(normalizzate, i))}
                aria-label={`Rimuovi la fascia ${fascia.nome}`}
                disabled={normalizzate.length <= 1}
              >
                <X />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(aggiungiFascia(normalizzate))}>
          <Plus />
          Aggiungi fascia
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(fasceStandard(creditiBase))}
          title="Soglie standard scalate sul budget di questa lega"
        >
          <RotateCcw />
          Ripristina default
        </Button>

        {fuori > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{fuori}</span> giocatori sotto
            la soglia più bassa, fuori da ogni fascia
          </span>
        )}
      </div>
    </div>
  );
}
