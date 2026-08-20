"use client";

import { cn } from "@/lib/utils";

// Stepper minimale per i wizard lineari di import (listone, rose): i passi
// sono già deducibili dallo stato esistente (anteprima/esito), non serve altro
// stato dedicato — basta l'indice del passo attivo.
export function Stepper({ passi, passoAttivo }: { passi: readonly string[]; passoAttivo: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {passi.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full font-semibold",
                i < passoAttivo && "bg-primary/15 text-primary",
                i === passoAttivo && "bg-primary text-primary-foreground",
                i > passoAttivo && "bg-muted text-muted-foreground",
              )}
            >
              {i + 1}
            </span>
            <span className={cn(i === passoAttivo ? "font-medium text-foreground" : "text-muted-foreground")}>
              {label}
            </span>
          </div>
          {i < passi.length - 1 && <span className="h-px w-6 bg-border" />}
        </div>
      ))}
    </div>
  );
}
