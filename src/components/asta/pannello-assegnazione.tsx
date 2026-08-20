"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Minus, Plus, X } from "lucide-react";
import { ClubBadge } from "@/components/shared/club-badge";
import { Button } from "@/components/ui/button";
import { RUOLO_CLASSI } from "@/lib/ruoli";
import { cn } from "@/lib/utils";
import type { StatoSquadraDerivato } from "@/lib/asta/derive";
import type { Player } from "@/lib/blob/schemas";

// Pannello unico prezzo + squadra (§ B del piano di semplificazione UX).
// Sostituisce i due passi separati "digita prezzo" -> "clicca una colonna
// della griglia": il prezzo arriva già proposto e la squadra è una tessera
// grande, quindi l'assegnazione costa due click e nessuna digitazione
// obbligatoria. Target laptop/desktop: le scorciatoie da tastiera sono un
// bonus sopra i bottoni, mai l'unico modo di fare una cosa.

export type EsitoEleggibilita = { ok: boolean; motivo: string | null };

// Scorciatoie di prezzo: le due ancore che contano davvero in asta sono la
// quotazione di listino e il proprio tetto, il resto sono ritocchi rapidi.
const INCREMENTI = [1, 5, 10] as const;

function PastigliaPrezzo({
  label,
  attiva,
  onClick,
}: {
  label: string;
  attiva?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 rounded-full border px-3 text-xs font-medium transition-colors",
        attiva
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

export function PannelloAssegnazione({
  giocatore,
  prezzoIniziale,
  squadre,
  eleggibilita,
  onAssegna,
  onAnnulla,
}: {
  giocatore: Player;
  // Prezzo massimo reattivo: la proposta di partenza, non un vincolo.
  prezzoIniziale: number;
  squadre: StatoSquadraDerivato[];
  eleggibilita: Map<string, EsitoEleggibilita>;
  onAssegna: (teamId: string, prezzo: number) => void;
  onAnnulla: () => void;
}) {
  const [prezzo, setPrezzo] = useState(() => Math.max(1, prezzoIniziale));
  const prezzoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    prezzoRef.current?.focus();
    prezzoRef.current?.select();
  }, []);

  const classiRuolo = RUOLO_CLASSI[giocatore.ruolo];

  // Le squadre assegnabili, nell'ordine mostrato: è lo stesso ordine su cui si
  // basano le scorciatoie numeriche 1-9, altrimenti il tasto premuto e la
  // tessera evidenziata indicherebbero squadre diverse.
  const assegnabili = useMemo(
    () => squadre.filter((s) => eleggibilita.get(s.teamId)?.ok === true),
    [squadre, eleggibilita],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onAnnulla();
        return;
      }
      // Le cifre servono a digitare il prezzo quando il campo ha il fuoco:
      // intercettarle come scorciatoia squadra renderebbe impossibile scriverlo.
      if (document.activeElement === prezzoRef.current) return;

      if (e.key === "+" || e.key === "ArrowUp") {
        e.preventDefault();
        setPrezzo((p) => p + 1);
        return;
      }
      if (e.key === "-" || e.key === "ArrowDown") {
        e.preventDefault();
        setPrezzo((p) => Math.max(1, p - 1));
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        const squadra = assegnabili[Number(e.key) - 1];
        if (squadra) {
          e.preventDefault();
          onAssegna(squadra.teamId, prezzo);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // Il prezzo sta fra le dipendenze: ri-registra il listener a ogni battuta,
    // un addEventListener in piu' per tasto. E' comunque preferibile a leggere
    // un ref durante il render, che react-hooks vieta.
  }, [assegnabili, prezzo, onAssegna, onAnnulla]);

  return (
    <div className="animate-in fade-in-0 slide-in-from-top-2 flex flex-col gap-4 rounded-2xl border-2 border-primary/30 bg-card p-4 shadow-lg duration-150 md:p-5">
      {/* Chi stiamo assegnando */}
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg font-mono text-base font-bold",
            classiRuolo.badge,
          )}
        >
          {giocatore.ruolo}
        </span>
        <ClubBadge squadra={giocatore.squadra} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold">{giocatore.nome}</p>
          <p className="text-sm text-muted-foreground">{giocatore.squadra}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onAnnulla} aria-label="Annulla assegnazione">
          <X />
        </Button>
      </div>

      {/* Prezzo */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Prezzo</span>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              onClick={() => setPrezzo((p) => Math.max(1, p - 1))}
              aria-label="Diminuisci prezzo"
            >
              <Minus />
            </Button>
            <input
              ref={prezzoRef}
              type="number"
              min={1}
              step={1}
              value={prezzo}
              onChange={(e) => setPrezzo(Math.max(1, Number(e.target.value) || 1))}
              className="h-12 w-24 rounded-xl border border-input bg-transparent text-center font-mono text-2xl font-bold outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label="Prezzo di aggiudicazione"
            />
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              onClick={() => setPrezzo((p) => p + 1)}
              aria-label="Aumenta prezzo"
            >
              <Plus />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <PastigliaPrezzo
              label={`Qt. ${giocatore.quotazioneAttuale}`}
              attiva={prezzo === giocatore.quotazioneAttuale}
              onClick={() => setPrezzo(Math.max(1, giocatore.quotazioneAttuale))}
            />
            <PastigliaPrezzo
              label={`max ${prezzoIniziale}`}
              attiva={prezzo === prezzoIniziale}
              onClick={() => setPrezzo(Math.max(1, prezzoIniziale))}
            />
            {INCREMENTI.map((n) => (
              <PastigliaPrezzo key={n} label={`+${n}`} onClick={() => setPrezzo((p) => p + n)} />
            ))}
          </div>
        </div>
      </div>

      {/* Squadre */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          A chi va? <span className="normal-case opacity-70">— un click assegna a {prezzo}</span>
        </span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {squadre.map((team) => {
            const esito = eleggibilita.get(team.teamId);
            const abilitata = esito?.ok === true;
            const indiceScorciatoia = abilitata ? assegnabili.findIndex((s) => s.teamId === team.teamId) : -1;

            return (
              <button
                key={team.teamId}
                type="button"
                disabled={!abilitata}
                onClick={() => onAssegna(team.teamId, prezzo)}
                className={cn(
                  "group flex min-h-20 flex-col items-start gap-1 rounded-xl border-2 p-2.5 text-left transition-all",
                  abilitata
                    ? "border-border bg-background hover:-translate-y-0.5 hover:border-primary hover:bg-primary/5 hover:shadow-md"
                    : "cursor-not-allowed border-dashed border-border/60 bg-muted/30 opacity-60",
                )}
              >
                <span className="flex w-full items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{team.nome}</span>
                  {indiceScorciatoia >= 0 && indiceScorciatoia < 9 && (
                    <kbd className="hidden shrink-0 rounded border border-border px-1 font-mono text-[10px] text-muted-foreground sm:inline">
                      {indiceScorciatoia + 1}
                    </kbd>
                  )}
                </span>

                {abilitata ? (
                  <>
                    <span className="flex items-baseline gap-1 font-mono text-xs">
                      <span className="text-base font-bold">{team.creditiResidui}</span>
                      <span className="text-muted-foreground">cr</span>
                    </span>
                    <span className="flex w-full items-center justify-between text-[11px] text-muted-foreground">
                      <span className={cn("rounded px-1 font-mono font-semibold", classiRuolo.badge)}>
                        {giocatore.ruolo} {team.slotOccupati[giocatore.ruolo]}/{team.slotBase[giocatore.ruolo]}
                      </span>
                      {team.massimaOfferta !== null && <span className="font-mono">max {team.massimaOfferta}</span>}
                    </span>
                    <span className="mt-auto hidden items-center gap-1 text-[11px] font-semibold text-primary group-hover:flex">
                      <Check className="size-3" />
                      Assegna
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] font-medium text-destructive">{esito?.motivo}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        <kbd className="rounded border border-border px-1 font-mono">↑</kbd>{" "}
        <kbd className="rounded border border-border px-1 font-mono">↓</kbd> regolano il prezzo ·{" "}
        <kbd className="rounded border border-border px-1 font-mono">1</kbd>–
        <kbd className="rounded border border-border px-1 font-mono">9</kbd> scelgono la squadra ·{" "}
        <kbd className="rounded border border-border px-1 font-mono">Esc</kbd> annulla
      </p>
    </div>
  );
}
