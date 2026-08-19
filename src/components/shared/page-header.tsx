import type { ReactNode } from "react";

// Intestazione di pagina condivisa (§ design system): titolo + descrizione
// opzionale a sinistra, azioni (bottoni/badge di stato) a destra. Prima di
// questo, ogni pagina scriveva il proprio <h1> a mano con margini/tipografia
// leggermente diversi — qui la gerarchia è una sola in tutta l'app.
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
