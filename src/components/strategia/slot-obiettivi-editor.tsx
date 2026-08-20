"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GiocatorePicker } from "@/components/shared/giocatore-picker";
import { ClubBadge } from "@/components/shared/club-badge";
import { prezzoMassimoDefault } from "@/lib/pricing";
import { RUOLI, RUOLO_CLASSI, RUOLO_LABEL } from "@/lib/ruoli";
import { cn } from "@/lib/utils";
import type { BudgetPerRuolo, ObiettivoSlot, Player, PrezzoMassimo, Ruolo, SlotPerRuolo } from "@/lib/blob/schemas";

// Prima: venticinque righe tutte espanse in verticale, una parete da scorrere.
// Ora un reparto alla volta, con il riscontro che mancava — quanto costano gli
// obiettivi scelti rispetto al budget pianificato per quel reparto. Senza,
// si sceglievano obiettivi alla cieca e si scopriva lo sforamento solo
// scendendo fino a "Simula rosa".
//
// L'altro difetto era più insidioso: i candidati venivano filtrati solo contro
// lo slot corrente, quindi lo stesso giocatore poteva essere obiettivo di D1 e
// D2. simulaRosa poi ne salta uno in silenzio, e ci si ritrovava con una rosa
// pianificata piena di buchi invisibili.

function chiave(ruolo: Ruolo, indice: number): string {
  return `${ruolo}-${indice}`;
}

export function SlotObiettiviEditor({
  slot,
  giocatori,
  slotObiettivi,
  prezziMassimi,
  budgetReparto,
  creditiBase,
  onChange,
}: {
  slot: SlotPerRuolo;
  giocatori: Player[];
  slotObiettivi: ObiettivoSlot[];
  prezziMassimi: PrezzoMassimo[];
  budgetReparto: BudgetPerRuolo;
  creditiBase: number;
  onChange: (slotObiettivi: ObiettivoSlot[]) => void;
}) {
  const ruoliAttivi = RUOLI.filter((r) => slot[r] > 0);
  const [ruoloAttivo, setRuoloAttivo] = useState<Ruolo>(ruoliAttivi[0] ?? "P");

  const giocatoriPerId = useMemo(() => new Map(giocatori.map((g) => [g.id, g])), [giocatori]);
  const perChiave = useMemo(() => new Map(slotObiettivi.map((o) => [chiave(o.ruolo, o.indiceSlot), o])), [slotObiettivi]);
  const prezzoPerId = useMemo(() => new Map(prezziMassimi.map((p) => [p.playerId, p.valore])), [prezziMassimi]);

  function prezzo(id: number): number {
    const g = giocatoriPerId.get(id);
    if (!g) return 0;
    return prezzoPerId.get(id) ?? prezzoMassimoDefault(g.quotazioneAttuale, creditiBase);
  }

  /** Spesa prevista di un reparto: il prezzo massimo dell'obiettivo di ogni slot. */
  function spesaPrevista(ruolo: Ruolo): number {
    let totale = 0;
    for (let i = 0; i < slot[ruolo]; i++) {
      const principale = perChiave.get(chiave(ruolo, i))?.obiettivoPrincipale;
      if (principale !== null && principale !== undefined) totale += prezzo(principale);
    }
    return totale;
  }

  function slotCoperti(ruolo: Ruolo): number {
    let n = 0;
    for (let i = 0; i < slot[ruolo]; i++) {
      if (perChiave.get(chiave(ruolo, i))?.obiettivoPrincipale != null) n++;
    }
    return n;
  }

  function upsert(ruolo: Ruolo, indice: number, cambio: Partial<ObiettivoSlot>) {
    const esistente = perChiave.get(chiave(ruolo, indice)) ?? {
      ruolo,
      indiceSlot: indice,
      obiettivoPrincipale: null,
      alternative: [],
    };
    const senzaQuesto = slotObiettivi.filter((o) => !(o.ruolo === ruolo && o.indiceSlot === indice));
    onChange([...senzaQuesto, { ...esistente, ...cambio }]);
  }

  // Tutti i giocatori già impegnati in QUALCHE slot di questo ruolo, non solo
  // in quello corrente: è ciò che impedisce di piazzare lo stesso nome su due
  // slot e ritrovarsi uno slot vuoto in simulazione.
  const impegnatiNelRuolo = useMemo(() => {
    const usati = new Set<number>();
    for (const o of slotObiettivi) {
      if (o.ruolo !== ruoloAttivo) continue;
      if (o.obiettivoPrincipale !== null) usati.add(o.obiettivoPrincipale);
      for (const a of o.alternative) usati.add(a);
    }
    return usati;
  }, [slotObiettivi, ruoloAttivo]);

  const candidatiDelRuolo = useMemo(
    () => giocatori.filter((g) => g.ruolo === ruoloAttivo && !impegnatiNelRuolo.has(g.id)),
    [giocatori, ruoloAttivo, impegnatiNelRuolo],
  );

  const spesa = spesaPrevista(ruoloAttivo);
  const budget = budgetReparto[ruoloAttivo];
  const coperti = slotCoperti(ruoloAttivo);
  const oltreBudget = spesa > budget;

  return (
    <div className="flex flex-col gap-3">
      {/* Un reparto alla volta, col suo stato di avanzamento sul selettore. */}
      <div className="flex flex-wrap gap-1.5">
        {ruoliAttivi.map((ruolo) => {
          const attivo = ruolo === ruoloAttivo;
          return (
            <button
              key={ruolo}
              type="button"
              onClick={() => setRuoloAttivo(ruolo)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                attivo ? cn(RUOLO_CLASSI[ruolo].solid, "border-transparent") : cn("border-border", RUOLO_CLASSI[ruolo].badge),
              )}
            >
              {RUOLO_LABEL[ruolo]}
              <span className={cn("font-mono text-xs", attivo ? "opacity-80" : "text-muted-foreground")}>
                {slotCoperti(ruolo)}/{slot[ruolo]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Costo degli obiettivi contro il budget del reparto: prima bisognava
          scendere fino a "Simula rosa" per scoprire di aver sforato. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm">
        <span className="text-muted-foreground">
          <span className="font-mono font-semibold text-foreground">{coperti}</span>/{slot[ruoloAttivo]} slot con
          obiettivo
        </span>
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground">costo previsto</span>
          <span
            className={cn(
              "font-mono font-semibold",
              oltreBudget ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {spesa}
          </span>
          <span className="text-muted-foreground">/ {budget}</span>
        </span>
        <div className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", oltreBudget ? "bg-rose-500" : RUOLO_CLASSI[ruoloAttivo].dot)}
            style={{ width: `${budget > 0 ? Math.min(100, (spesa / budget) * 100) : 0}%` }}
          />
        </div>
        {oltreBudget && (
          <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
            +{spesa - budget} oltre il budget del reparto
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {Array.from({ length: slot[ruoloAttivo] }, (_, indice) => {
          const obiettivo = perChiave.get(chiave(ruoloAttivo, indice));
          const principale = obiettivo?.obiettivoPrincipale ?? null;
          const alternative = obiettivo?.alternative ?? [];
          const giocatorePrincipale = principale !== null ? giocatoriPerId.get(principale) : undefined;

          function spostaAlternativa(da: number, a: number) {
            if (a < 0 || a >= alternative.length) return;
            const next = [...alternative];
            [next[da], next[a]] = [next[a], next[da]];
            upsert(ruoloAttivo, indice, { alternative: next });
          }

          return (
            <div
              key={indice}
              className={cn(
                "flex flex-col gap-2 rounded-xl border p-2.5 transition-colors",
                principale !== null ? "border-border" : "border-dashed border-border/60",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-7 shrink-0 font-mono text-xs font-semibold text-muted-foreground">
                  {ruoloAttivo}
                  {indice + 1}
                </span>

                {giocatorePrincipale ? (
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />
                    <ClubBadge squadra={giocatorePrincipale.squadra} size="xs" />
                    <span className="truncate font-medium">{giocatorePrincipale.nome}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      max {prezzo(giocatorePrincipale.id)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => upsert(ruoloAttivo, indice, { obiettivoPrincipale: null })}
                      aria-label={`Togli ${giocatorePrincipale.nome} dall'obiettivo principale di ${ruoloAttivo}${indice + 1}`}
                    >
                      <X />
                    </Button>
                  </span>
                ) : (
                  <span className="flex flex-1 items-center gap-2">
                    <GiocatorePicker
                      giocatori={candidatiDelRuolo}
                      label="Scegli obiettivo"
                      onSelect={(id) => upsert(ruoloAttivo, indice, { obiettivoPrincipale: id })}
                    />
                    <span className="text-xs text-muted-foreground">nessun obiettivo</span>
                  </span>
                )}
              </div>

              {/* Le alternative sono in ordine di preferenza: senza un modo di
                  riordinarle, l'unica correzione possibile era cancellare e
                  reinserire tutta la lista. */}
              {alternative.length > 0 && (
                <ul className="flex flex-col gap-1 pl-7">
                  {alternative.map((id, posizione) => {
                    const g = giocatoriPerId.get(id);
                    return (
                      <li key={id} className="flex items-center gap-1.5 text-sm">
                        <span className="w-4 shrink-0 text-center font-mono text-[10px] text-muted-foreground">
                          {posizione + 1}
                        </span>
                        {g && <ClubBadge squadra={g.squadra} size="xs" />}
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{g?.nome ?? `#${id}`}</span>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">max {prezzo(id)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          disabled={posizione === 0}
                          onClick={() => spostaAlternativa(posizione, posizione - 1)}
                          aria-label={`Sposta ${g?.nome ?? id} più in alto`}
                        >
                          <ChevronUp />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          disabled={posizione === alternative.length - 1}
                          onClick={() => spostaAlternativa(posizione, posizione + 1)}
                          aria-label={`Sposta ${g?.nome ?? id} più in basso`}
                        >
                          <ChevronDown />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() =>
                            upsert(ruoloAttivo, indice, { alternative: alternative.filter((a) => a !== id) })
                          }
                          aria-label={`Rimuovi ${g?.nome ?? id} dalle alternative`}
                        >
                          <X />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="flex items-center gap-2 pl-7">
                <GiocatorePicker
                  giocatori={candidatiDelRuolo}
                  label="+ alternativa"
                  variant="ghost"
                  onSelect={(id) => upsert(ruoloAttivo, indice, { alternative: [...alternative, id] })}
                />
                {(principale !== null || alternative.length > 0) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="ml-auto text-muted-foreground"
                    onClick={() => upsert(ruoloAttivo, indice, { obiettivoPrincipale: null, alternative: [] })}
                  >
                    Svuota slot
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
