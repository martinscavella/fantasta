"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { percentuali, ricalcolaBudget, sforamento } from "@/lib/strategia/budget";
import { TEMPLATE_LABEL, TEMPLATE_STRATEGIA, type TemplateStrategia } from "@/lib/strategia/template";
import { RUOLI, RUOLO_CLASSI, RUOLO_LABEL } from "@/lib/ruoli";
import type { BudgetPerRuolo } from "@/lib/blob/schemas";

export function BudgetEditor({
  budget,
  creditiBase,
  onChange,
  onTemplate,
}: {
  budget: BudgetPerRuolo;
  creditiBase: number;
  onChange: (budget: BudgetPerRuolo) => void;
  onTemplate: (template: TemplateStrategia) => void;
}) {
  const perc = percentuali(budget, creditiBase);
  const sforo = sforamento(budget, creditiBase);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {TEMPLATE_STRATEGIA.map((t) => (
          <Button
            key={t}
            type="button"
            variant="outline"
            size="xs"
            onClick={() => onTemplate(t)}
          >
            {TEMPLATE_LABEL[t]}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {RUOLI.map((r) => (
          <div key={r} className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground" htmlFor={`budget-${r}`}>
              <span className={`size-2 rounded-full ${RUOLO_CLASSI[r].dot}`} />
              {RUOLO_LABEL[r]}
            </label>
            <Input
              id={`budget-${r}`}
              type="number"
              min={0}
              value={budget[r]}
              onChange={(e) => onChange(ricalcolaBudget(budget, creditiBase, r, Number(e.target.value)))}
              className="font-mono"
            />
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${RUOLO_CLASSI[r].dot}`}
                style={{ width: `${Math.min(100, perc[r])}%` }}
              />
            </div>
            <span className="font-mono text-xs text-muted-foreground">{perc[r].toFixed(1)}%</span>
          </div>
        ))}
      </div>

      {sforo !== 0 && (
        <p
          className={
            sforo > 0
              ? "rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400"
              : "rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
          }
        >
          {sforo > 0
            ? `Il budget dei reparti supera i crediti base di ${sforo}.`
            : `Restano ${-sforo} crediti non ancora assegnati a un reparto.`}
        </p>
      )}
    </div>
  );
}
