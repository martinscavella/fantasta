"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { percentuali, ricalcolaBudget, sforamento } from "@/lib/strategia/budget";
import { TEMPLATE_LABEL, TEMPLATE_STRATEGIA, type TemplateStrategia } from "@/lib/strategia/template";
import type { BudgetPerRuolo, Ruolo } from "@/lib/blob/schemas";

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];

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

      <div className="grid grid-cols-4 gap-3">
        {RUOLI.map((r) => (
          <div key={r} className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor={`budget-${r}`}>
              {r}
            </label>
            <Input
              id={`budget-${r}`}
              type="number"
              min={0}
              value={budget[r]}
              onChange={(e) => onChange(ricalcolaBudget(budget, creditiBase, r, Number(e.target.value)))}
            />
            <span className="font-mono text-xs text-muted-foreground">{perc[r].toFixed(1)}%</span>
          </div>
        ))}
      </div>

      {sforo !== 0 && (
        <p className={sforo > 0 ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {sforo > 0
            ? `Il budget dei reparti supera i crediti base di ${sforo}.`
            : `Restano ${-sforo} crediti non ancora assegnati a un reparto.`}
        </p>
      )}
    </div>
  );
}
