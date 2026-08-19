import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// Riquadro per il testo scritto dall'IA nel Ponte manuale (sintesi di
// strategia, debrief, analisi live — § Ponte IA nel PLAN.md). Prima era un
// box muted qualsiasi con un'etichetta minuscola: esattamente il contrario di
// "le parti scritte bene in chiaro" che l'utente ha chiesto di sistemare —
// questo è il testo più curato della pagina (ricerca web + ragionamento),
// merita la tipografia più leggibile, non la più discreta.
export function AiCallout({
  label = "Generato dall'IA",
  testo,
  actions,
  className,
}: {
  label?: string;
  testo: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary/[0.045] p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary uppercase">
          <Sparkles className="size-3.5" />
          {label}
        </span>
        {actions}
      </div>
      <p className="text-[0.95rem] leading-relaxed whitespace-pre-wrap text-foreground">{testo}</p>
    </div>
  );
}
