import type { BudgetPerRuolo, Ruolo } from "@/lib/blob/schemas";

export const TEMPLATE_STRATEGIA = ["budget-diffuso", "corazzata-difensiva", "attacco-stellare"] as const;
export type TemplateStrategia = (typeof TEMPLATE_STRATEGIA)[number];

export const TEMPLATE_LABEL: Record<TemplateStrategia, string> = {
  "budget-diffuso": "Budget diffuso",
  "corazzata-difensiva": "Corazzata difensiva",
  "attacco-stellare": "Attacco stellare",
};

// Ripartizioni indicative (%), non un dato ufficiale — punto di partenza da
// correggere a mano (vedi § Template di strategia nel piano).
const RIPARTIZIONE: Record<TemplateStrategia, Record<Ruolo, number>> = {
  "budget-diffuso": { P: 5, D: 20, C: 30, A: 45 },
  "corazzata-difensiva": { P: 5, D: 35, C: 30, A: 30 },
  "attacco-stellare": { P: 3, D: 15, C: 27, A: 55 },
};

export function applicaTemplate(template: TemplateStrategia, creditiBase: number): BudgetPerRuolo {
  const perc = RIPARTIZIONE[template];
  const p = Math.round((perc.P / 100) * creditiBase);
  const d = Math.round((perc.D / 100) * creditiBase);
  const c = Math.round((perc.C / 100) * creditiBase);
  // L'attacco assorbe l'arrotondamento per restare ancorati esattamente a creditiBase.
  const a = creditiBase - p - d - c;
  return { P: p, D: d, C: c, A: a };
}
