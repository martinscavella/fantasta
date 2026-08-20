"use client";

import Link from "next/link";
import { Download, MessageSquare, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeamsGrid } from "@/components/asta/teams-grid";
import { AstaSubNav } from "@/components/asta/asta-sub-nav";
import { AiCallout } from "@/components/shared/ai-callout";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { RUOLO_CLASSI } from "@/lib/ruoli";
import type { RigaRosa, StatoSquadraDerivato } from "@/lib/asta/derive";
import { scostamentoStrategia, spesaPerRuolo } from "@/lib/riepilogo/scostamento";
import { esportaAstaJson, esportaRosaCsv, scaricaFile } from "@/lib/riepilogo/export";
import type { SetupDoc, StrategyDoc } from "@/lib/blob/schemas";

// Solo lo sforamento (speso più del pianificato) è un segnale d'attenzione:
// spendere meno del preventivato è la norma per gran parte dell'asta (reparti
// non ancora affrontati, margine lasciato apposta), non va colorato come se
// fosse un problema — altrimenti a inizio asta l'intera pagina è ambra.
function classeScostamento(scostamento: number): string {
  return scostamento > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground";
}

export function RiepilogoClient({
  setup,
  squadreDerivate,
  rose,
  strategy,
  debriefIniziale,
}: {
  setup: SetupDoc;
  squadreDerivate: StatoSquadraDerivato[];
  rose: Record<string, RigaRosa[]>;
  strategy: StrategyDoc | null;
  debriefIniziale: string;
}) {
  const rosaMia = rose[setup.miaSquadraId] ?? [];
  const nomeMiaSquadra = setup.squadre.find((s) => s.id === setup.miaSquadraId)?.nome ?? "—";
  const spesaEffettiva = spesaPerRuolo(rosaMia);
  const scostamento = strategy ? scostamentoStrategia(strategy.budgetReparto, spesaEffettiva) : null;
  const spesaTotale = rosaMia.reduce((tot, r) => tot + r.price, 0);

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <AstaSubNav astaId={setup.id} nome={setup.nome} />

      <PageHeader title="Riepilogo" description="La tua rosa finale, lo scostamento dalla strategia e il confronto con tutta la lega." />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard
          title={`La tua rosa — ${nomeMiaSquadra}`}
          icon={Users}
          actions={<span className="font-mono text-sm font-semibold">{spesaTotale} crediti spesi</span>}
        >
          <div className="overflow-hidden rounded-xl border border-border">
            <ul className="flex flex-col">
              {rosaMia.length === 0 ? (
                <li className="p-3 text-sm text-muted-foreground">Nessun giocatore acquistato.</li>
              ) : (
                rosaMia.map((r) => (
                  <li
                    key={r.eventId}
                    className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5 text-sm transition-colors last:border-b-0 hover:bg-accent/40"
                  >
                    <span className={`size-2 shrink-0 rounded-full ${RUOLO_CLASSI[r.player.ruolo].dot}`} title={r.player.ruolo} />
                    <span className="flex-1 truncate">{r.player.nome}</span>
                    <span className="text-xs text-muted-foreground">{r.player.squadra}</span>
                    <span className="w-10 text-right font-mono">{r.price}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </SectionCard>

        <SectionCard title="Scostamento dalla strategia pianificata" icon={TrendingUp}>
          {scostamento ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {scostamento.map((s) => {
                const pct = s.pianificato > 0 ? Math.min(100, (s.effettivo / s.pianificato) * 100) : 0;
                return (
                  <div key={s.ruolo} className="flex flex-col gap-1.5 rounded-lg border border-border/60 p-2.5">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <span className={`size-2 rounded-full ${RUOLO_CLASSI[s.ruolo].dot}`} />
                      {s.ruolo}
                    </span>
                    <span className="font-mono text-sm">
                      {s.effettivo} <span className="text-muted-foreground">/ {s.pianificato}</span>
                    </span>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${s.scostamento > 0 ? "bg-rose-500" : RUOLO_CLASSI[s.ruolo].dot}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`font-mono text-xs ${classeScostamento(s.scostamento)}`}>
                      {s.scostamento > 0 ? "+" : ""}
                      {s.scostamento}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nessuna strategia pianificata registrata per questa asta.</p>
          )}
        </SectionCard>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="size-4" />
          </span>
          <h2 className="text-base font-semibold tracking-tight">Tutte le squadre</h2>
        </div>
        <TeamsGrid squadre={squadreDerivate} rose={rose} />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="Esporta" icon={Download}>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => scaricaFile(`${setup.nome}-rosa.csv`, esportaRosaCsv(rosaMia), "text/csv")}
            >
              <Download />
              Esporta CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => scaricaFile(`${setup.nome}-rosa.json`, esportaAstaJson(setup.nome, rosaMia), "application/json")}
            >
              <Download />
              Esporta JSON
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="Debrief IA"
          description="La valutazione della rosa a bocce ferme si genera dal tab IA, insieme alle altre funzioni del Ponte manuale."
          icon={MessageSquare}
        >
          {debriefIniziale ? (
            <AiCallout label="Debrief salvato" testo={debriefIniziale} />
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/asta/${setup.id}/ai`} />}
            >
              <MessageSquare />
              Genera il debrief
            </Button>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
