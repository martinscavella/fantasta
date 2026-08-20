"use client";

import { useState } from "react";
import { PonteIATesto, type EsitoApplicazione } from "@/components/ai/ponte-ia";
import { RisultatoAnalisi } from "@/components/ai/risultato-analisi";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { applicaAnalisiLive, applicaPianoAllaStrategia, generaPromptAnalisiLive } from "@/lib/actions/analisi-live";
import type { AnalisiAstaLive, FaseAsta, SvolgimentoAsta } from "@/lib/analisi-live/schemas";

const FASI: { value: FaseAsta; label: string }[] = [
  { value: "in-corso", label: "In corso (nessuna fase precisa)" },
  { value: "pre-asta", label: "Pre-asta" },
  { value: "dopo-P", label: "Appena chiusi i portieri" },
  { value: "dopo-D", label: "Appena chiusi i difensori" },
  { value: "dopo-C", label: "Appena chiusi i centrocampisti" },
  { value: "dopo-A", label: "Appena chiusi gli attaccanti" },
];

const SVOLGIMENTI: { value: SvolgimentoAsta["tipo"]; label: string }[] = [
  { value: "chiamata", label: "A chiamata (ogni squadra chiama chi vuole)" },
  { value: "ordine", label: "A scorrimento alfabetico" },
];

const LETTERE = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

export function TabAnalisiLive({
  astaId,
  analisiIniziale,
  faseIniziale,
  nomiPerIdIniziale,
}: {
  astaId: string;
  analisiIniziale: AnalisiAstaLive | null;
  faseIniziale: FaseAsta;
  nomiPerIdIniziale: Record<number, string>;
}) {
  const [fase, setFase] = useState<FaseAsta>(faseIniziale);
  const [svolgimentoTipo, setSvolgimentoTipo] = useState<SvolgimentoAsta["tipo"]>("chiamata");
  const [letteraIniziale, setLetteraIniziale] = useState("A");

  const [analisi, setAnalisi] = useState<{ analisi: AnalisiAstaLive; nomiPerId: Record<number, string> } | null>(
    analisiIniziale ? { analisi: analisiIniziale, nomiPerId: nomiPerIdIniziale } : null,
  );
  const [applicando, setApplicando] = useState(false);
  const [pianoApplicato, setPianoApplicato] = useState(false);
  const [errorePiano, setErrorePiano] = useState<string | null>(null);

  function svolgimento(): SvolgimentoAsta {
    return svolgimentoTipo === "ordine" ? { tipo: "ordine", letteraIniziale } : { tipo: "chiamata" };
  }

  async function applicaAlPiano() {
    if (!analisi) return;
    setErrorePiano(null);
    setApplicando(true);
    const esito = await applicaPianoAllaStrategia(astaId, analisi.analisi);
    setApplicando(false);
    if (esito.ok) setPianoApplicato(true);
    else setErrorePiano(esito.error);
  }

  return (
    <PonteIATesto
      generaPrompt={() => generaPromptAnalisiLive(astaId, fase, svolgimento())}
      onApplica={async (testo): Promise<EsitoApplicazione> => {
        setPianoApplicato(false);
        const esito = await applicaAnalisiLive(astaId, fase, testo, svolgimento());
        if (!esito.ok) {
          setAnalisi(null);
          return { ok: false, error: esito.error };
        }
        setAnalisi({ analisi: esito.analisi, nomiPerId: esito.nomiPerId });
        return { ok: true };
      }}
      etichettaApplica="Valida e mostra analisi"
      messaggioSuccesso="Analisi validata: i numeri sono stati ricalcolati."
      parametri={
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Fase dell&apos;asta</Label>
            <Select
              value={fase}
              onValueChange={(v) => v && setFase(v as FaseAsta)}
              items={Object.fromEntries(FASI.map((f) => [f.value, f.label]))}
            >
              <SelectTrigger size="sm" className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FASI.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Svolgimento</Label>
            <Select
              value={svolgimentoTipo}
              onValueChange={(v) => v && setSvolgimentoTipo(v as SvolgimentoAsta["tipo"])}
              items={Object.fromEntries(SVOLGIMENTI.map((s) => [s.value, s.label]))}
            >
              <SelectTrigger size="sm" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SVOLGIMENTI.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {svolgimentoTipo === "ordine" && (
            <div className="flex flex-col gap-1.5">
              <Label>Lettera</Label>
              <Select
                value={letteraIniziale}
                onValueChange={(v) => v && setLetteraIniziale(v)}
                items={Object.fromEntries(LETTERE.map((l) => [l, l]))}
              >
                <SelectTrigger size="sm" className="w-20" aria-label="Lettera di partenza">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LETTERE.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      }
    >
      {analisi && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 p-3">
            <span className="text-sm text-muted-foreground">
              Aggiorna prezzi massimi e obiettivi di slot nella Strategia con quanto ricalcolato qui sotto.
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => void applicaAlPiano()} disabled={applicando}>
              {applicando ? "Applico…" : pianoApplicato ? "Applicato" : "Applica al piano"}
            </Button>
          </div>
          {errorePiano && <p className="text-sm text-destructive">{errorePiano}</p>}
          <RisultatoAnalisi analisi={analisi.analisi} nomiPerId={analisi.nomiPerId} />
        </div>
      )}
    </PonteIATesto>
  );
}
