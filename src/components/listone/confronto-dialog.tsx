"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { costruisciTabellaConfronto, type GiocatoreConStat } from "@/lib/statistiche/analisi";
import { FASCIA_BADGE_VARIANT, fasciaStandard } from "@/lib/pricing";

export function ConfrontoDialog({
  giocatori,
  aperto,
  onOpenChange,
  onRimuovi,
}: {
  giocatori: GiocatoreConStat[];
  aperto: boolean;
  onOpenChange: (aperto: boolean) => void;
  onRimuovi: (id: number) => void;
}) {
  const tabella = costruisciTabellaConfronto(giocatori);

  return (
    <Dialog open={aperto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-[calc(100%-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Confronto giocatori</DialogTitle>
        </DialogHeader>

        {giocatori.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun giocatore selezionato.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60">
                  <th className="px-2 py-2 text-left font-medium text-muted-foreground"></th>
                  {giocatori.map((g) => {
                    const fascia = fasciaStandard(g.quotazioneAttuale);
                    return (
                      <th key={g.id} className="px-2 py-2 text-left align-top">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{g.nome}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => onRimuovi(g.id)}
                              aria-label={`Rimuovi ${g.nome} dal confronto`}
                            >
                              ×
                            </Button>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[10px]">
                              {g.ruolo}
                            </Badge>
                            {fascia && (
                              <Badge variant={FASCIA_BADGE_VARIANT[fascia]} className="text-[10px]">
                                {fascia}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {tabella.map((riga) => (
                  <tr key={riga.label} className="border-b border-border/60">
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">{riga.label}</td>
                    {riga.valori.map((valore, i) => (
                      <td key={giocatori[i].id} className="px-2 py-1.5 font-mono">
                        {valore}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
