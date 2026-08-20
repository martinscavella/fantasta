"use client";

import { ArrowRight, CircleAlert, CircleCheck, CircleSlash, Sparkle, TrendingUp } from "lucide-react";
import { RUOLO_CLASSI } from "@/lib/ruoli";
import { cn } from "@/lib/utils";
import type { ConsiglioGiocatore, ConsiglioProssimo, Verdetto } from "@/lib/asta/consiglio";

// Striscia di suggerimento sopra la card del giocatore corrente (§ C del piano
// di semplificazione UX). Due metà: verdetto sul giocatore davanti a te, e su
// quale reparto conviene concentrarsi dato ciò che hai già comprato — le due
// cose sono legate, quindi stanno insieme.
//
// Colori dalla terna del DESIGN-SYSTEM.md (emerald = in linea, amber =
// attenzione, rose = sopra il limite): nessuna semantica cromatica nuova.

const STILE: Record<Verdetto, { label: string; classe: string; icona: typeof CircleCheck }> = {
  punta: {
    label: "Punta",
    classe: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    icona: CircleCheck,
  },
  occasione: {
    label: "Occasione",
    classe: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    icona: Sparkle,
  },
  limite: {
    label: "Al limite",
    classe: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    icona: CircleAlert,
  },
  lascia: {
    label: "Lascia",
    classe: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
    icona: CircleSlash,
  },
  neutro: {
    label: "Neutro",
    classe: "border-border bg-muted/40 text-muted-foreground",
    icona: CircleAlert,
  },
};

export function StrisciaConsiglio({
  consiglio,
  prossimo,
}: {
  consiglio: ConsiglioGiocatore;
  prossimo: ConsiglioProssimo;
}) {
  const stile = STILE[consiglio.verdetto];
  const Icona = stile.icona;

  return (
    <div className={cn("flex flex-col gap-2 rounded-xl border px-3 py-2", stile.classe)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="flex shrink-0 items-center gap-1.5 font-semibold tracking-wide uppercase">
          <Icona className="size-4" />
          {stile.label}
        </span>
        <span className="text-foreground/80">{consiglio.motivi.join(" · ")}</span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          tuo max <span className="font-mono font-semibold text-foreground">{consiglio.prezzoMax}</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-current/15 pt-2 text-xs text-muted-foreground">
        <span className="flex shrink-0 items-center gap-1.5 font-medium">
          <ArrowRight className="size-3.5" />
          Prossimo
        </span>
        {prossimo.ruoloPrioritario && (
          <span
            className={cn(
              "shrink-0 rounded px-1.5 font-mono text-[11px] font-bold",
              RUOLO_CLASSI[prossimo.ruoloPrioritario].badge,
            )}
          >
            {prossimo.ruoloPrioritario}
          </span>
        )}
        <span>{prossimo.motivo}</span>
        <span className="ml-auto hidden shrink-0 items-center gap-2 sm:flex">
          {prossimo.scostamentoReparto
            .filter((s) => s.slotResidui > 0)
            .map((s) => (
              <span key={s.ruolo} className="flex items-center gap-1">
                <span className={cn("size-1.5 rounded-full", RUOLO_CLASSI[s.ruolo].dot)} />
                <span className="font-mono">{s.slotResidui}</span>
              </span>
            ))}
          <TrendingUp className="size-3" />
        </span>
      </div>
    </div>
  );
}
