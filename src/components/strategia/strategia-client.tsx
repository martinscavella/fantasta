"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Coins, Layers, Sparkles, Target, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AstaSubNav } from "@/components/asta/asta-sub-nav";
import { AiCallout } from "@/components/shared/ai-callout";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
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

      <PageHeader
        title="Strategia"
        description="Fasce, budget per reparto, obiettivi di slot e prezzi massimi — tutto ciò che prepari prima dell'asta."
        actions={
          <>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/asta/${setup.id}/ai`} />}>
              <Sparkles />
              Genera con IA
            </Button>
            <Badge variant={salvata ? "secondary" : "outline"}>{salvata ? "salvato" : "modifiche non salvate"}</Badge>
            <Button size="sm" onClick={salva} disabled={pending || salvata}>
              {pending ? "Salvataggio…" : "Salva"}
            </Button>
          </>
        }
      />
      {errore && <p className="text-sm text-destructive">{errore}</p>}

      {strategy.sintesiIA && <AiCallout label="Sintesi della strategia generata dall'IA" testo={strategy.sintesiIA} />}

      <SectionCard
        title="Fasce"
        description="Soglie di prezzo che classificano i giocatori del listone. Sposta il pavimento di una fascia: il tetto della successiva si adatta da solo, e la barra mostra quanti giocatori ci finiscono."
        icon={Layers}
      >
        <FasceEditor
          fasce={strategy.fasce}
          giocatori={giocatori}
          creditiBase={setup.creditiBase}
          onChange={(fasce) => aggiorna({ fasce })}
        />
      </SectionCard>

      <SectionCard
        title="Budget per reparto"
        description="Ripartizione dei crediti tra portieri, difensori, centrocampisti e attaccanti."
        icon={Coins}
      >
        <BudgetEditor
          budget={strategy.budgetReparto}
          creditiBase={setup.creditiBase}
          onChange={(budgetReparto) => aggiorna({ budgetReparto })}
          onTemplate={(template: TemplateStrategia) =>
            aggiorna({ budgetReparto: applicaTemplate(template, setup.creditiBase), template })
          }
        />
      </SectionCard>

      <SectionCard
        title="Slot: obiettivi e alternative"
        description="Chi punti a prendere per ogni slot, in ordine di preferenza. Un reparto alla volta, col costo degli obiettivi confrontato col budget che gli hai assegnato."
        icon={Target}
      >
        <SlotObiettiviEditor
          slot={setup.slot}
          giocatori={giocatori}
          slotObiettivi={strategy.slotObiettivi}
          prezziMassimi={strategy.prezziMassimi}
          budgetReparto={strategy.budgetReparto}
          creditiBase={setup.creditiBase}
          onChange={(slotObiettivi) => aggiorna({ slotObiettivi })}
        />
      </SectionCard>

      <SectionCard title="Prezzo massimo personale" description="Il tetto che sei disposto a pagare per ogni giocatore, modificabile a mano." icon={Coins}>
        <PrezziMassimiTable
          giocatori={giocatori}
          prezziMassimi={strategy.prezziMassimi}
          creditiBase={setup.creditiBase}
          onChange={(prezziMassimi) => aggiorna({ prezziMassimi })}
        />
      </SectionCard>

      <SectionCard title="Simula rosa" description="Costruisci la rosa dai tuoi obiettivi e verifica copertura slot e budget." icon={Wand2}>
        <SimulaRosaPanel setup={setup} giocatori={giocatori} strategy={strategy} />
      </SectionCard>
    </div>
  );
}
