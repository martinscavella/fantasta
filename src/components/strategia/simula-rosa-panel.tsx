"use client";

import { useMemo } from "react";
import { CircleAlert, CircleCheck, LayoutGrid, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ClubBadge } from "@/components/shared/club-badge";
import { simulaRosa } from "@/lib/strategia/simula";
import { RUOLI, RUOLO_CLASSI, RUOLO_LABEL } from "@/lib/ruoli";
import { cn } from "@/lib/utils";
import type { Player, Ruolo, SetupDoc, StrategyDoc } from "@/lib/blob/schemas";

// Prima: un bottone "Simula", tre riquadri con stringhe di stelline e una
// lista piatta di venticinque righe. La simulazione è una funzione pura di
// dati già tutti in memoria — non c'era motivo di nasconderla dietro un
// click, né di far scorrere una lista indistinta per capire com'è fatta la
// rosa. Ora è sempre aggiornata, raggruppata per reparto, e i voti dicono da
// dove escono invece di mostrare cinque stelle senza motivo.

function Stelle({ valore }: { valore: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${valore} su 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={cn("size-1.5 rounded-full", i < valore ? "bg-amber-400" : "bg-muted-foreground/25")}
        />
      ))}
    </span>
  );
}

function CartaVoto({
  titolo,
  valore,
  dettaglio,
  spiegazione,
}: {
  titolo: string;
  valore: number;
  dettaglio: string;
  spiegazione: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border/60 p-3">
      <span className="text-xs text-muted-foreground">{titolo}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-lg font-bold">{dettaglio}</span>
        <Stelle valore={valore} />
      </span>
      <span className="text-xs leading-snug text-muted-foreground">{spiegazione}</span>
    </div>
  );
}

export function SimulaRosaPanel({
  setup,
  giocatori,
  strategy,
}: {
  setup: SetupDoc;
  giocatori: Player[];
  strategy: StrategyDoc;
}) {
  const risultato = useMemo(() => simulaRosa(setup, giocatori, strategy), [setup, giocatori, strategy]);

  const perRuolo = useMemo(() => {
    const mappa = new Map<Ruolo, typeof risultato.slot>();
    for (const ruolo of RUOLI) mappa.set(ruolo, []);
    for (const s of risultato.slot) mappa.get(s.ruolo)?.push(s);
    for (const righe of mappa.values()) righe.sort((a, b) => a.indiceSlot - b.indiceSlot);
    return mappa;
  }, [risultato]);

  const piuCaro = useMemo(
    () => risultato.slot.reduce<(typeof risultato.slot)[number] | null>(
      (max, s) => (s.giocatore && (!max || s.prezzo > max.prezzo) ? s : max),
      null,
    ),
    [risultato],
  );

  if (risultato.slotCoperti === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Imposta almeno un obiettivo negli slot qui sopra: la simulazione si aggiorna da sola.
      </p>
    );
  }

  const residuo = setup.creditiBase - risultato.spesaTotale;

  return (
    <div className="flex flex-col gap-4">
      {/* Colpo d'occhio: spesa totale e come si distribuisce tra i reparti. */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-4xl font-bold tracking-tight">{risultato.spesaTotale}</span>
            <span className="text-sm text-muted-foreground">/ {setup.creditiBase} crediti</span>
          </div>
          <Badge
            className={cn(
              "gap-1.5 border-transparent px-3 py-1.5",
              risultato.entroBudget
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-rose-500/10 text-rose-700 dark:text-rose-400",
            )}
          >
            {risultato.entroBudget ? <CircleCheck className="size-3.5" /> : <CircleAlert className="size-3.5" />}
            {risultato.entroBudget ? `${residuo} crediti liberi` : `${-residuo} oltre il budget`}
          </Badge>
        </div>

        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
          {RUOLI.map((ruolo) => (
            <div
              key={ruolo}
              className={cn("h-full transition-all", RUOLO_CLASSI[ruolo].dot)}
              style={{ width: `${(risultato.spesaPerRuolo[ruolo] / setup.creditiBase) * 100}%` }}
              title={`${RUOLO_LABEL[ruolo]}: ${risultato.spesaPerRuolo[ruolo]}`}
            />
          ))}
        </div>

        {/* Simulato contro pianificato, reparto per reparto: è il confronto
            che diceva se il piano regge, e prima non c'era da nessuna parte. */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RUOLI.map((ruolo) => {
            const simulato = risultato.spesaPerRuolo[ruolo];
            const pianificato = strategy.budgetReparto[ruolo];
            const scarto = simulato - pianificato;
            return (
              <div key={ruolo} className="flex flex-col gap-0.5 rounded-lg bg-background/60 px-2.5 py-1.5">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <span className={cn("size-2 rounded-full", RUOLO_CLASSI[ruolo].dot)} />
                  {ruolo}
                </span>
                <span className="font-mono text-sm font-semibold">
                  {simulato}
                  <span className="text-xs font-normal text-muted-foreground"> / {pianificato}</span>
                </span>
                <span
                  className={cn(
                    "font-mono text-[11px]",
                    scarto > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground",
                  )}
                >
                  {scarto === 0 ? "in linea" : `${scarto > 0 ? "+" : ""}${scarto}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CartaVoto
          titolo="Copertura slot"
          valore={risultato.rating.coperturaSlot}
          dettaglio={`${risultato.slotCoperti}/${risultato.slotTotali}`}
          spiegazione={
            risultato.slotCoperti === risultato.slotTotali
              ? "Ogni slot ha un obiettivo o un'alternativa."
              : `${risultato.slotTotali - risultato.slotCoperti} slot senza nessun nome: in asta ci arrivi senza piano.`
          }
        />
        <CartaVoto
          titolo="Concentrazione spesa"
          valore={risultato.rating.concentrazioneSpesa}
          dettaglio={`${Math.round(risultato.quotaMassima * 100)}%`}
          spiegazione={
            piuCaro?.giocatore
              ? `${piuCaro.giocatore.nome} da solo vale questa quota della spesa totale.`
              : "Quota del giocatore più caro sulla spesa totale."
          }
        />
      </div>

      {/* Rosa per reparto, non una lista piatta di venticinque righe. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {RUOLI.filter((r) => setup.slot[r] > 0).map((ruolo) => {
          const righe = perRuolo.get(ruolo) ?? [];
          return (
            <div key={ruolo} className="flex flex-col overflow-hidden rounded-xl border border-border/60">
              <div
                className={cn(
                  "flex items-center justify-between px-2.5 py-1.5 text-xs font-bold",
                  RUOLO_CLASSI[ruolo].band,
                )}
              >
                <span className="flex items-center gap-1.5">
                  <LayoutGrid className="size-3" />
                  {RUOLO_LABEL[ruolo]}
                </span>
                <span className="font-mono">{risultato.spesaPerRuolo[ruolo]}</span>
              </div>
              <ul className="flex flex-col">
                {righe.map((s) => (
                  <li
                    key={`${s.ruolo}-${s.indiceSlot}`}
                    className="flex items-center gap-2 border-b border-border/50 px-2.5 py-1.5 text-sm last:border-b-0"
                  >
                    <span className="w-6 shrink-0 font-mono text-[10px] text-muted-foreground">
                      {ruolo}
                      {s.indiceSlot + 1}
                    </span>
                    {s.giocatore ? (
                      <>
                        <ClubBadge squadra={s.giocatore.squadra} size="xs" />
                        <span className="min-w-0 flex-1 truncate">{s.giocatore.nome}</span>
                        {s.fonteScelta === "alternativa" && (
                          <Badge variant="outline" className="shrink-0 text-[9px]">
                            alt
                          </Badge>
                        )}
                        <span className="shrink-0 font-mono text-xs font-medium">{s.prezzo}</span>
                      </>
                    ) : (
                      <span className="flex-1 text-xs text-muted-foreground/60">nessun obiettivo</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <TrendingUp className="mt-0.5 size-3.5 shrink-0" />
        Il fattore rischio (titolarità e infortuni) richiede i dati di scraping e non è ancora nel voto.
      </p>
    </div>
  );
}
