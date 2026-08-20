"use client";

import { useState } from "react";
import { FileText, MessageSquare, Radar, Target, type LucideIcon } from "lucide-react";
import { AstaSubNav } from "@/components/asta/asta-sub-nav";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { TabAnalisiLive } from "@/components/ai/tab-analisi-live";
import { TabDebrief } from "@/components/ai/tab-debrief";
import { TabDossier } from "@/components/ai/tab-dossier";
import { TabStrategia } from "@/components/ai/tab-strategia";
import { cn } from "@/lib/utils";
import type { RigaRosa } from "@/lib/asta/derive";
import type { AnalisiAstaLive, FaseAsta } from "@/lib/analisi-live/schemas";
import type { DossierEntry, Player, SetupDoc, StrategyDoc } from "@/lib/blob/schemas";

// Hub del Ponte IA manuale: le quattro funzioni stavano su quattro pagine
// diverse (/strategia/[id]/genera, /impostazioni/dossier,
// /asta/[id]/analisi-live e una sezione dentro il Riepilogo) pur facendo lo
// stesso identico ciclo. Qui sono quattro tab sopra un componente solo.

type TabId = "strategia" | "dossier" | "analisi-live" | "debrief";

const TAB: { id: TabId; label: string; icon: LucideIcon; descrizione: string }[] = [
  {
    id: "strategia",
    label: "Strategia",
    icon: Target,
    descrizione:
      "Imposta i parametri, copia il prompt in una chat e riporta il JSON: fasce, budget per reparto e prezzi massimi atterrano nella Strategia.",
  },
  {
    id: "dossier",
    label: "Dossier",
    icon: FileText,
    descrizione:
      "Schede giocatore a blocchi da ~25: punti di forza, rischi e prezzo consigliato. Valgono per tutta la stagione e alimentano i suggerimenti del Tracker.",
  },
  {
    id: "analisi-live",
    label: "Analisi live",
    icon: Radar,
    descrizione:
      "Fotografia della lega a metà asta: minacce, alert e piano aggiornato. I numeri vengono ricalcolati con l'aritmetica esatta, non quella del modello.",
  },
  {
    id: "debrief",
    label: "Debrief",
    icon: MessageSquare,
    descrizione: "A bocce ferme: valutazione della rosa, punti deboli per reparto e indicazioni per il mercato di riparazione.",
  },
];

export function AiHubClient({
  setup,
  giocatori,
  strategy,
  dossierEsistente,
  analisiIniziale,
  faseIniziale,
  nomiPerId,
  rosaMia,
  debriefIniziale,
}: {
  setup: SetupDoc;
  giocatori: Player[];
  strategy: StrategyDoc | null;
  dossierEsistente: DossierEntry[];
  analisiIniziale: AnalisiAstaLive | null;
  faseIniziale: FaseAsta;
  nomiPerId: Record<number, string>;
  rosaMia: RigaRosa[];
  debriefIniziale: string;
}) {
  const [attivo, setAttivo] = useState<TabId>("strategia");
  const corrente = TAB.find((t) => t.id === attivo)!;

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <AstaSubNav astaId={setup.id} nome={setup.nome} />

      <PageHeader
        title="IA"
        description="Ponte manuale: l'app costruisce il prompt, tu lo giri in una chat sul tuo abbonamento e riporti qui la risposta. Nessuna chiave API, nessun costo."
      />

      <div className="flex flex-wrap gap-1 rounded-full border border-border bg-card p-1 shadow-sm">
        {TAB.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setAttivo(tab.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              tab.id === attivo
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <tab.icon className="size-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <SectionCard title={corrente.label} description={corrente.descrizione} icon={corrente.icon}>
        {attivo === "strategia" && (
          <TabStrategia setup={setup} giocatori={giocatori} sintesiEsistente={strategy?.sintesiIA ?? null} />
        )}
        {attivo === "dossier" && (
          <TabDossier stagione={setup.stagione} giocatori={giocatori} dossierEsistente={dossierEsistente} />
        )}
        {attivo === "analisi-live" && (
          <TabAnalisiLive
            astaId={setup.id}
            analisiIniziale={analisiIniziale}
            faseIniziale={faseIniziale}
            nomiPerIdIniziale={nomiPerId}
          />
        )}
        {attivo === "debrief" && (
          <TabDebrief setup={setup} rosaMia={rosaMia} strategy={strategy} debriefIniziale={debriefIniziale} />
        )}
      </SectionCard>
    </div>
  );
}
