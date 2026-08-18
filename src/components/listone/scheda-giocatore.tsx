"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { alternativeSimili, puntiChiave, trendQuotazione, type GiocatoreConStat } from "@/lib/statistiche/analisi";
import { FASCIA_BADGE_VARIANT, fasciaStandard } from "@/lib/pricing";

const RIGHE_STAT: { label: string; leggi: (g: GiocatoreConStat) => number | undefined }[] = [
  { label: "Media voto", leggi: (g) => g.stats?.mediaVoto },
  { label: "Fantamedia", leggi: (g) => g.stats?.fantamedia },
  { label: "Presenze", leggi: (g) => g.stats?.presenze },
  { label: "Gol", leggi: (g) => g.stats?.gol },
  { label: "Assist", leggi: (g) => g.stats?.assist },
  { label: "xG", leggi: (g) => g.stats?.xg },
  { label: "xA", leggi: (g) => g.stats?.xa },
  { label: "Ammonizioni", leggi: (g) => g.stats?.ammonizioni },
  { label: "Espulsioni", leggi: (g) => g.stats?.espulsioni },
  { label: "Rigori segnati", leggi: (g) => g.stats?.rigoriSegnati },
  { label: "Rigori sbagliati", leggi: (g) => g.stats?.rigoriSbagliati },
];

export function SchedaGiocatore({
  giocatore,
  tuttiGiocatori,
  aperto,
  onOpenChange,
  inConfronto,
  confrontoPieno,
  onToggleConfronto,
  onApriGiocatore,
}: {
  giocatore: GiocatoreConStat;
  tuttiGiocatori: GiocatoreConStat[];
  aperto: boolean;
  onOpenChange: (aperto: boolean) => void;
  inConfronto: boolean;
  confrontoPieno: boolean;
  onToggleConfronto: (id: number) => void;
  onApriGiocatore: (id: number) => void;
}) {
  const { forza, debolezza } = useMemo(() => puntiChiave(giocatore, tuttiGiocatori), [giocatore, tuttiGiocatori]);
  const alternative = useMemo(() => alternativeSimili(giocatore, tuttiGiocatori), [giocatore, tuttiGiocatori]);
  const trend = trendQuotazione(giocatore);
  const fascia = fasciaStandard(giocatore.quotazioneAttuale);

  return (
    <Dialog open={aperto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {giocatore.nome}
            <Badge variant="outline">{giocatore.ruolo}</Badge>
            {fascia && <Badge variant={FASCIA_BADGE_VARIANT[fascia]}>{fascia}</Badge>}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{giocatore.squadra}</p>
        </DialogHeader>

        <section className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Quotazione</span>
          <span className="font-mono">{trend.iniziale}</span>
          <span className="text-muted-foreground">→</span>
          <span className="font-mono font-medium">{trend.attuale}</span>
          {trend.deltaAssoluto !== 0 && (
            <span className={trend.deltaAssoluto > 0 ? "font-mono text-xs text-emerald-600 dark:text-emerald-500" : "font-mono text-xs text-destructive"}>
              {trend.deltaAssoluto > 0 ? "+" : ""}
              {trend.deltaAssoluto}
              {trend.deltaPercentuale !== null && ` (${(trend.deltaPercentuale * 100).toFixed(0)}%)`}
            </span>
          )}
        </section>

        {giocatore.stats === null ? (
          <p className="text-sm text-muted-foreground">
            Nessuna statistica disponibile per questo giocatore — non ancora rilevata dallo scraping o in coda di revisione.
          </p>
        ) : (
          <section className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
            {RIGHE_STAT.map(({ label, leggi }) => {
              const valore = leggi(giocatore);
              return (
                <div key={label} className="flex flex-col">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="font-mono">{valore ?? "—"}</span>
                </div>
              );
            })}
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">Punti chiave</h3>
          {forza.length === 0 && debolezza.length === 0 ? (
            <p className="text-sm text-muted-foreground">Dati insufficienti per un&apos;analisi.</p>
          ) : (
            <div className="flex flex-col gap-1 text-sm">
              {forza.map((p) => (
                <p key={p} className="text-emerald-700 dark:text-emerald-500">
                  + {p}
                </p>
              ))}
              {debolezza.map((p) => (
                <p key={p} className="text-destructive">
                  − {p}
                </p>
              ))}
            </div>
          )}
        </section>

        {alternative.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">Alternative simili</h3>
            <ul className="flex flex-col gap-1">
              {alternative.map((alt) => (
                <li key={alt.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-sm hover:bg-muted"
                    onClick={() => onApriGiocatore(alt.id)}
                  >
                    <span className="flex-1 truncate">{alt.nome}</span>
                    <span className="text-xs text-muted-foreground">{alt.squadra}</span>
                    <span className="font-mono text-xs text-muted-foreground">{alt.quotazioneAttuale}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Button
          type="button"
          variant={inConfronto ? "secondary" : "outline"}
          size="sm"
          disabled={!inConfronto && confrontoPieno}
          onClick={() => onToggleConfronto(giocatore.id)}
        >
          {inConfronto ? "Rimuovi dal confronto" : "Aggiungi al confronto"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
