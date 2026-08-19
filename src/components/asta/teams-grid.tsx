"use client";

import { Badge } from "@/components/ui/badge";
import { ClubBadge } from "@/components/shared/club-badge";
import { RUOLI, RUOLO_CLASSI } from "@/lib/ruoli";
import { cn } from "@/lib/utils";
import type { RigaRosa, StatoSquadraDerivato } from "@/lib/asta/derive";

function barraBudgetClasse(pct: number, negativo: boolean): string {
  if (negativo) return "bg-rose-500";
  if (pct >= 90) return "bg-amber-500";
  return "bg-emerald-500";
}

function pillCreditiClasse(creditiResidui: number, creditiBase: number): string {
  if (creditiResidui < 0) return "bg-rose-500/10 text-rose-600 dark:text-rose-400";
  if (creditiBase > 0 && creditiResidui / creditiBase <= 0.1) return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
}

export type EleggibilitaSquadra = { ok: boolean; motivo: string | null };

// Layout a colonne fisse (una per squadra) con bande di ruolo che attraversano
// tutte le colonne alla stessa altezza — le rose sono sempre visibili per
// intero, nessun accordion da aprire per confrontare due squadre.
export function TeamsGrid({
  squadre,
  rose,
  eleggibilita,
  onAssegnaSquadra,
  flashTeamId,
}: {
  squadre: StatoSquadraDerivato[];
  rose: Record<string, RigaRosa[]>;
  // Non-null = un'assegnazione è in corso (giocatore + prezzo già scelti nel
  // pannello a sinistra): le colonne diventano il selettore della squadra,
  // non serve un'altra lista separata per farlo (vedi § Tracker d'asta nel piano).
  eleggibilita?: Map<string, EleggibilitaSquadra> | null;
  onAssegnaSquadra?: (teamId: string) => void;
  // Id della squadra appena assegnata: un lampo verde temporaneo conferma
  // visivamente l'azione senza dover leggere il log sotto.
  flashTeamId?: string | null;
}) {
  const modalitaAssegnazione = eleggibilita != null;
  const modalitaSforo = squadre.some((t) => t.massimaOfferta === null);

  return (
    <div className="w-fit max-w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex overflow-x-auto">
        {squadre.map((team) => {
          const pctSpeso = team.creditiBase > 0 ? Math.min(100, (team.creditiSpesi / team.creditiBase) * 100) : 0;
          const righeRosa = rose[team.teamId] ?? [];

          const elig = eleggibilita?.get(team.teamId) ?? null;
          const cliccabile = modalitaAssegnazione && elig?.ok === true;

          return (
            <div
              key={team.teamId}
              role={cliccabile ? "button" : undefined}
              tabIndex={cliccabile ? 0 : undefined}
              onClick={cliccabile ? () => onAssegnaSquadra?.(team.teamId) : undefined}
              onKeyDown={
                cliccabile
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onAssegnaSquadra?.(team.teamId);
                      }
                    }
                  : undefined
              }
              className={cn(
                "flex w-48 shrink-0 flex-col border-r border-border transition-all duration-700 last:border-r-0",
                modalitaAssegnazione &&
                  (cliccabile
                    ? "cursor-pointer bg-primary/5 ring-2 ring-inset ring-primary/40 hover:bg-primary/10"
                    : "cursor-not-allowed opacity-40"),
                team.teamId === flashTeamId && "bg-emerald-500/10 ring-2 ring-inset ring-emerald-500",
              )}
            >
              {/* Header squadra */}
              <div className="flex flex-col gap-1.5 border-b-2 border-border px-2.5 py-2.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-sm font-bold">{team.nome}</span>
                  {team.rosaCompleta && (
                    <Badge variant="secondary" className="shrink-0 text-[9px]">
                      OK
                    </Badge>
                  )}
                </div>
                <span
                  className={cn(
                    "w-fit rounded-full px-2 py-0.5 font-mono text-xs font-bold",
                    pillCreditiClasse(team.creditiResidui, team.creditiBase),
                  )}
                >
                  {team.creditiResidui}
                </span>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", barraBudgetClasse(pctSpeso, team.creditiResidui < 0))}
                    style={{ width: `${team.creditiResidui < 0 ? 100 : pctSpeso}%` }}
                  />
                </div>
                {modalitaAssegnazione ? (
                  <p className={cn("text-[11px] font-semibold", cliccabile ? "text-primary" : "text-destructive")}>
                    {cliccabile ? "Assegna qui →" : elig?.motivo}
                  </p>
                ) : team.massimaOfferta !== null ? (
                  <p className="text-[11px] text-muted-foreground">
                    Max <span className="font-mono font-semibold text-primary">{team.massimaOfferta}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Sforo <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">{team.sforoCrediti}</span>
                    {team.sforoEuro !== null && ` (${team.sforoEuro.toFixed(2)} €)`}
                  </p>
                )}
              </div>

              {/* Bande di ruolo, allineate tra tutte le colonne perché ogni squadra
                  condivide lo stesso numero di slot per ruolo (setup.slot). */}
              {RUOLI.map((ruolo) => {
                const righe = righeRosa.filter((r) => r.player.ruolo === ruolo);
                const spesaRuolo = righe.reduce((tot, r) => tot + r.price, 0);
                const pctBudgetRuolo = team.creditiBase > 0 ? Math.round((spesaRuolo / team.creditiBase) * 100) : 0;
                const slotTotali = team.slotBase[ruolo];
                const righeConPlaceholder = [...righe, ...Array<null>(Math.max(0, slotTotali - righe.length)).fill(null)];

                return (
                  <div key={ruolo} className="flex flex-col">
                    <div
                      className={cn(
                        "flex h-6 items-center justify-between px-2.5 text-[11px] font-bold",
                        RUOLO_CLASSI[ruolo].band,
                        team.obbligoPerRuolo[ruolo] && "ring-2 ring-inset ring-amber-500",
                      )}
                      title={team.obbligoPerRuolo[ruolo] ? `Obbligata a comprare un ${ruolo}` : undefined}
                    >
                      <span>{ruolo}</span>
                      <span>{pctBudgetRuolo}%</span>
                    </div>
                    {righeConPlaceholder.map((riga, i) =>
                      riga ? (
                        <div
                          key={riga.eventId}
                          className="flex h-7 items-center gap-1.5 border-b border-border/50 px-2.5 text-xs"
                        >
                          <ClubBadge squadra={riga.player.squadra} size="xs" />
                          <span className="flex-1 truncate">{riga.player.nome}</span>
                          <span className="font-mono text-[11px] font-medium">{riga.price}</span>
                        </div>
                      ) : (
                        <div
                          key={`vuoto-${ruolo}-${i}`}
                          className="flex h-7 items-center border-b border-border/50 px-2.5 text-xs text-muted-foreground/40"
                        >
                          —
                        </div>
                      ),
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
        {modalitaSforo ? (
          <>
            <span className="font-semibold text-rose-600 dark:text-rose-400">Sforo</span> = crediti spesi oltre il
            budget base, pagati a parte
          </>
        ) : (
          <>
            <span className="font-semibold text-primary">Max</span> = offerta massima possibile su questo giocatore
            senza far saltare gli slot rimasti
          </>
        )}
        {" · "}bordo ambra sul ruolo = squadra obbligata a comprarlo (slot residui = liberi rimasti)
        {" · "}— = slot ancora libero
      </p>
    </div>
  );
}
