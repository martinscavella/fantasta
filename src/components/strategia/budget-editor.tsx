"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { percentuali, ricalcolaBudget, sforamento } from "@/lib/strategia/budget";
import { applicaTemplate, TEMPLATE_LABEL, TEMPLATE_STRATEGIA, type TemplateStrategia } from "@/lib/strategia/template";
import { RUOLI, RUOLO_CLASSI, RUOLO_LABEL } from "@/lib/ruoli";
import { cn } from "@/lib/utils";
import type { BudgetPerRuolo, SlotPerRuolo } from "@/lib/blob/schemas";

// Due difetti nell'interazione precedente:
//
// 1. Il campo numerico ricalcolava gli altri tre a ogni battuta: digitare
//    "150" passava per 1 e 15, e ogni passaggio ridistribuiva i reparti
//    rimanenti. Il valore finale era giusto, gli altri tre no. Ora il numero
//    si conferma su Invio o uscendo dal campo, e la manipolazione diretta si
//    fa con lo slider, che è continuo per natura.
// 2. Mancava il numero che dice davvero se una ripartizione regge: quanto
//    resta per slot. "150 crediti ai difensori" non significa niente finché
//    non sai che sono otto, cioè ~19 a testa.

export function BudgetEditor({
  budget,
  creditiBase,
  slot,
  onChange,
  onTemplate,
}: {
  budget: BudgetPerRuolo;
  creditiBase: number;
  slot: SlotPerRuolo;
  onChange: (budget: BudgetPerRuolo) => void;
  onTemplate: (template: TemplateStrategia) => void;
}) {
  const perc = percentuali(budget, creditiBase);
  const sforo = sforamento(budget, creditiBase);

  return (
    <div className="flex flex-col gap-4">
      {/* I template mostrano la ripartizione che applicano: prima erano tre
          bottoni anonimi e bisognava cliccarli per scoprire cosa facessero. */}
      <div className="flex flex-wrap gap-2">
        {TEMPLATE_STRATEGIA.map((t) => {
          const anteprima = applicaTemplate(t, creditiBase);
          return (
            <Button
              key={t}
              type="button"
              variant="outline"
              size="sm"
              className="h-auto flex-col items-start gap-0.5 py-1.5"
              onClick={() => onTemplate(t)}
            >
              <span>{TEMPLATE_LABEL[t]}</span>
              <span className="font-mono text-[10px] font-normal text-muted-foreground">
                {RUOLI.map((r) => `${r} ${anteprima[r]}`).join(" · ")}
              </span>
            </Button>
          );
        })}
      </div>

      {/* Ripartizione complessiva a colpo d'occhio, prima dei singoli reparti. */}
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {RUOLI.map((r) => (
          <div
            key={r}
            className={cn("h-full transition-all", RUOLO_CLASSI[r].dot)}
            style={{ width: `${Math.max(0, Math.min(100, perc[r]))}%` }}
            title={`${RUOLO_LABEL[r]}: ${budget[r]} crediti (${perc[r].toFixed(1)}%)`}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {RUOLI.map((ruolo) => (
          <RigaReparto
            key={ruolo}
            ruolo={ruolo}
            valore={budget[ruolo]}
            percentuale={perc[ruolo]}
            slot={slot[ruolo]}
            creditiBase={creditiBase}
            onCommit={(nuovo) => onChange(ricalcolaBudget(budget, creditiBase, ruolo, nuovo))}
          />
        ))}
      </div>

      {sforo !== 0 && (
        <p
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            sforo > 0
              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
          )}
        >
          {sforo > 0
            ? `Il budget dei reparti supera i crediti base di ${sforo}.`
            : `Restano ${-sforo} crediti non ancora assegnati a un reparto.`}
        </p>
      )}
    </div>
  );
}

function RigaReparto({
  ruolo,
  valore,
  percentuale,
  slot,
  creditiBase,
  onCommit,
}: {
  ruolo: (typeof RUOLI)[number];
  valore: number;
  percentuale: number;
  slot: number;
  creditiBase: number;
  onCommit: (valore: number) => void;
}) {
  // Campo non controllato: il valore si propaga al documento solo alla
  // conferma, così digitare non ridistribuisce gli altri reparti a meta
  // numero. `key={valore}` lo rimonta quando il valore cambia da fuori
  // (slider, template, conferma), che e l unico momento in cui va rinfrescato:
  // sincronizzarlo con uno stato locale in un effetto sarebbe setState
  // sincrono dentro useEffect, vietato dal lint del progetto.
  function conferma(testo: string) {
    const n = Number(testo);
    if (Number.isFinite(n) && n !== valore) onCommit(n);
  }

  const perSlot = slot > 0 ? valore / slot : 0;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/60 p-3">
      <div className="flex items-center gap-2">
        <span className={cn("size-2.5 shrink-0 rounded-full", RUOLO_CLASSI[ruolo].dot)} aria-hidden />
        <label className="flex-1 text-sm font-medium" htmlFor={`budget-${ruolo}`}>
          {RUOLO_LABEL[ruolo]}
          <span className="ml-1.5 font-mono text-xs font-normal text-muted-foreground">{slot} slot</span>
        </label>
        <Input
          key={valore}
          id={`budget-${ruolo}`}
          type="number"
          min={0}
          max={creditiBase}
          defaultValue={valore}
          onBlur={(e) => conferma(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              conferma(e.currentTarget.value);
            }
          }}
          className="h-8 w-20 font-mono"
        />
      </div>

      <input
        type="range"
        min={0}
        max={creditiBase}
        step={1}
        value={valore}
        onChange={(e) => onCommit(Number(e.target.value))}
        aria-label={`Budget per ${RUOLO_LABEL[ruolo]}`}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />

      <div className="flex items-baseline justify-between text-xs text-muted-foreground">
        <span className="font-mono">{percentuale.toFixed(1)}%</span>
        {/* Il numero che rende leggibile la ripartizione: senza, "150 ai
            difensori" non dice se sono tanti o pochi. */}
        <span>
          ~<span className="font-mono font-semibold text-foreground">{Math.round(perSlot)}</span> per slot
        </span>
      </div>
    </div>
  );
}
