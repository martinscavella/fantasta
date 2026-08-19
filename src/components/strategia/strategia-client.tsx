"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AstaSubNav } from "@/components/asta/asta-sub-nav";
import { FasceEditor } from "@/components/strategia/fasce-editor";
import { BudgetEditor } from "@/components/strategia/budget-editor";
import { PrezziMassimiTable } from "@/components/strategia/prezzi-massimi-table";
import { SlotObiettiviEditor } from "@/components/strategia/slot-obiettivi-editor";
import { SimulaRosaPanel } from "@/components/strategia/simula-rosa-panel";
import { salvaStrategia } from "@/lib/actions/strategia";
import { applicaTemplate, type TemplateStrategia } from "@/lib/strategia/template";
import type { Player, SetupDoc, StrategyDoc } from "@/lib/blob/schemas";

export function StrategiaClient({
  setup,
  giocatori,
  strategyIniziale,
}: {
  setup: SetupDoc;
  giocatori: Player[];
  strategyIniziale: StrategyDoc;
}) {
  const [strategy, setStrategy] = useState(strategyIniziale);
  const [salvata, setSalvata] = useState(true);
  const [pending, startTransition] = useTransition();
  const [errore, setErrore] = useState<string | null>(null);

  function aggiorna(cambio: Partial<StrategyDoc>) {
    setStrategy((prev) => ({ ...prev, ...cambio }));
    setSalvata(false);
  }

  function salva() {
    setErrore(null);
    startTransition(async () => {
      const risultato = await salvaStrategia(setup.id, strategy);
      if (risultato.ok) {
        setStrategy((prev) => ({ ...prev, updatedAt: risultato.savedAt }));
        setSalvata(true);
      } else {
        setErrore(risultato.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <AstaSubNav astaId={setup.id} nome={setup.nome} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Strategia</h1>
          <Link href={`/strategia/${setup.id}/genera`} className="text-sm text-primary hover:underline">
            Genera con IA
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={salvata ? "secondary" : "outline"}>{salvata ? "salvato" : "modifiche non salvate"}</Badge>
          <Button size="sm" onClick={salva} disabled={pending || salvata}>
            {pending ? "Salvataggio…" : "Salva"}
          </Button>
        </div>
      </div>
      {errore && <p className="text-sm text-destructive">{errore}</p>}

      {strategy.sintesiIA && (
        <section className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
          <h2 className="mb-1 text-sm font-medium text-muted-foreground">Sintesi generata dall&apos;IA</h2>
          <p className="whitespace-pre-wrap">{strategy.sintesiIA}</p>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Fasce</h2>
        <FasceEditor fasce={strategy.fasce} onChange={(fasce) => aggiorna({ fasce })} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Budget per reparto</h2>
        <BudgetEditor
          budget={strategy.budgetReparto}
          creditiBase={setup.creditiBase}
          onChange={(budgetReparto) => aggiorna({ budgetReparto })}
          onTemplate={(template: TemplateStrategia) =>
            aggiorna({ budgetReparto: applicaTemplate(template, setup.creditiBase), template })
          }
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Slot: obiettivi e alternative</h2>
        <SlotObiettiviEditor
          slot={setup.slot}
          giocatori={giocatori}
          slotObiettivi={strategy.slotObiettivi}
          onChange={(slotObiettivi) => aggiorna({ slotObiettivi })}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Prezzo massimo personale</h2>
        <PrezziMassimiTable
          giocatori={giocatori}
          prezziMassimi={strategy.prezziMassimi}
          onChange={(prezziMassimi) => aggiorna({ prezziMassimi })}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Simula rosa</h2>
        <SimulaRosaPanel setup={setup} giocatori={giocatori} strategy={strategy} />
      </section>
    </div>
  );
}
