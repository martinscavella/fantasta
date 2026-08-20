"use client";

import { cn } from "@/lib/utils";
import type { OpzioneScelta } from "@/lib/ai/prompts/strategia";

// Caselle a pastiglia per i parametri del generatore di strategia: cliccabili
// per intero (l'etichetta è dentro il <label>), con la descrizione sempre
// visibile invece che in un tooltip — sono scelte che si fanno una volta a
// stagione, vale la pena leggerle.

export function GruppoScelte({
  titolo,
  descrizione,
  opzioni,
  selezionati,
  onChange,
  singola = false,
}: {
  titolo: string;
  descrizione?: string;
  opzioni: OpzioneScelta[];
  selezionati: string[];
  onChange: (ids: string[]) => void;
  // Scelta singola: le caselle diventano radio e la selezione si sostituisce.
  singola?: boolean;
}) {
  function attiva(id: string) {
    if (singola) return onChange([id]);
    onChange(selezionati.includes(id) ? selezionati.filter((x) => x !== id) : [...selezionati, id]);
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
        {titolo}
        {descrizione && <span className="text-xs font-normal text-muted-foreground">{descrizione}</span>}
      </legend>

      <div className="flex flex-wrap gap-1.5">
        {opzioni.map((opzione) => {
          const scelta = selezionati.includes(opzione.id);
          return (
            <label
              key={opzione.id}
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-xl border px-2.5 py-1.5 text-sm transition-colors",
                scelta
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-border hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <input
                type={singola ? "radio" : "checkbox"}
                name={singola ? titolo : undefined}
                checked={scelta}
                onChange={() => attiva(opzione.id)}
                className="mt-0.5 size-4 shrink-0 border-input accent-primary"
              />
              <span className="flex flex-col">
                <span className={cn(scelta && "font-medium")}>{opzione.label}</span>
                {opzione.descrizione && (
                  <span className="text-xs text-muted-foreground">{opzione.descrizione}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
