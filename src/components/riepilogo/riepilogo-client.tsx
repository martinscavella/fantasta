"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TeamsGrid } from "@/components/asta/teams-grid";
import type { RigaRosa, StatoSquadraDerivato } from "@/lib/asta/derive";
import { scostamentoStrategia, spesaPerRuolo } from "@/lib/riepilogo/scostamento";
import { esportaAstaJson, esportaRosaCsv, scaricaFile } from "@/lib/riepilogo/export";
import { buildPromptDebrief } from "@/lib/ai/prompts/debrief";
import { salvaDebrief } from "@/lib/actions/debrief";
import type { SetupDoc, StrategyDoc } from "@/lib/blob/schemas";

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

  const [prompt, setPrompt] = useState<string | null>(null);
  const [copiato, setCopiato] = useState(false);
  const [debriefTesto, setDebriefTesto] = useState(debriefIniziale);
  const [pending, setPending] = useState(false);
  const [salvato, setSalvato] = useState(true);

  function generaPromptDebrief() {
    setPrompt(buildPromptDebrief(setup.nome, rosaMia, strategy));
    setCopiato(false);
  }

  async function copiaPrompt() {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopiato(true);
  }

  async function salva() {
    setPending(true);
    const esito = await salvaDebrief(setup.id, debriefTesto);
    setPending(false);
    if (esito.ok) setSalvato(true);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Riepilogo — {setup.nome}</h1>
        <Link href={`/asta/${setup.id}`} className="text-sm text-muted-foreground hover:text-foreground">
          Torna all&apos;asta
        </Link>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">La tua rosa — {nomeMiaSquadra}</h2>
          <span className="font-mono text-sm">{spesaTotale} crediti spesi</span>
        </div>
        <div className="rounded-xl border border-border">
          <ul className="flex flex-col">
            {rosaMia.length === 0 ? (
              <li className="p-3 text-sm text-muted-foreground">Nessun giocatore acquistato.</li>
            ) : (
              rosaMia.map((r) => (
                <li key={r.eventId} className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5 text-sm">
                  <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground">{r.player.ruolo}</span>
                  <span className="flex-1 truncate">{r.player.nome}</span>
                  <span className="text-xs text-muted-foreground">{r.player.squadra}</span>
                  <span className="w-10 text-right font-mono">{r.price}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Scostamento dalla strategia pianificata</h2>
        {scostamento ? (
          <div className="grid grid-cols-4 gap-3 text-sm">
            {scostamento.map((s) => (
              <div key={s.ruolo} className="flex flex-col gap-1 rounded-xl border border-border p-2">
                <span className="text-xs text-muted-foreground">{s.ruolo}</span>
                <span className="font-mono">
                  {s.effettivo} / {s.pianificato}
                </span>
                <span className={s.scostamento > 0 ? "font-mono text-xs text-destructive" : "font-mono text-xs text-muted-foreground"}>
                  {s.scostamento > 0 ? "+" : ""}
                  {s.scostamento}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nessuna strategia pianificata registrata per questa asta.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Tutte le squadre</h2>
        <TeamsGrid squadre={squadreDerivate} rose={rose} />
      </section>

      <section className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => scaricaFile(`${setup.nome}-rosa.csv`, esportaRosaCsv(rosaMia), "text/csv")}
        >
          Esporta CSV
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => scaricaFile(`${setup.nome}-rosa.json`, esportaAstaJson(setup.nome, rosaMia), "application/json")}
        >
          Esporta JSON
        </Button>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Debrief IA</h2>
        <p className="text-sm text-muted-foreground">
          Genera il prompt, incollalo in una chat Claude e riporta qui la risposta in prosa — non serve nessuna
          validazione, è solo testo da leggere.
        </p>
        {!prompt && (
          <Button type="button" size="sm" onClick={generaPromptDebrief}>
            Genera prompt
          </Button>
        )}
        {prompt && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Prompt</span>
              <Button type="button" size="xs" variant="outline" onClick={() => void copiaPrompt()}>
                {copiato ? "Copiato" : "Copia prompt"}
              </Button>
            </div>
            <Textarea readOnly value={prompt} rows={8} className="font-mono text-xs" />
          </div>
        )}
        <Textarea
          placeholder="Incolla qui il debrief…"
          rows={8}
          value={debriefTesto}
          onChange={(e) => {
            setDebriefTesto(e.target.value);
            setSalvato(false);
          }}
        />
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={() => void salva()} disabled={pending || salvato}>
            {pending ? "Salvataggio…" : "Salva debrief"}
          </Button>
          {salvato && debriefTesto && <Badge variant="secondary">salvato</Badge>}
        </div>
      </section>
    </div>
  );
}
