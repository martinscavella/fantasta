import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Card di sezione condivisa (§ design system): stessa elevazione di
// TeamsGrid/Home (rounded-2xl + shadow-sm), che prima esisteva solo lì —
// Strategia e Riepilogo usavano <section> piatte senza bordo/ombra coerenti.
// Icona opzionale in un badge tondo, titolo NON attenuato (era
// text-muted-foreground ovunque: un titolo di sezione non è testo
// secondario, è la prima cosa che si legge scorrendo la pagina).
export function SectionCard({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {Icon && (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" />
            </span>
          )}
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
