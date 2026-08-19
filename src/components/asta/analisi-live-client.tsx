"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Coins, Link2, Megaphone, Sparkles, Swords, Target } from "lucide-react";
import { AstaSubNav } from "@/components/asta/asta-sub-nav";
import { AiCallout } from "@/components/shared/ai-callout";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { applicaAnalisiLive, applicaPianoAllaStrategia, generaPromptAnalisiLive } from "@/lib/actions/analisi-live";
import type {
  AnalisiAstaLive,
  Alert,
  FaseAsta,
  GravitaAlert,
  LivelloMinaccia,
  SvolgimentoAsta,
  Verdetto,
} from "@/lib/analisi-live/schemas";
import { RUOLO_CLASSI, RUOLO_LABEL } from "@/lib/ruoli";

// Pagina dedicata del modulo "Analisi Asta Live" (aste/{astaId}/analisi-live —
// vedi src/lib/blob/schemas.ts). Ponte IA manuale (§ Analisi decisione live
// nel PLAN.md), stessa convenzione di GeneraStrategiaClient: genera il
// prompt, copialo in una chat, incolla la risposta. Nessuna chiamata API —
// vedi DECISIONI.md del modulo per il perché. Il risultato si salva su Blob
// (si riapre senza reincollare) e un bottone esplicito lo applica alla
// Strategia — non è automatico, resta una scelta dell'utente.

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

const GRAVITA_VARIANT: Record<GravitaAlert, "destructive" | "default" | "outline"> = {
  critico: "destructive",
  attenzione: "default",
  info: "outline",
};

const MINACCIA_VARIANT: Record<LivelloMinaccia, "destructive" | "default" | "secondary" | "outline"> = {
  critico: "destructive",
  alto: "default",
  medio: "secondary",
  basso: "outline",
  nullo: "outline",
};

const VERDETTO_VARIANT: Record<Verdetto, "destructive" | "default" | "secondary" | "outline"> = {
  "rilancia-deciso": "default",
  "rilancia-con-cautela": "secondary",
  lascia: "outline",
  "attendi-fine-asta": "secondary",
  "gia-perso": "outline",
};

export function AnalisiLiveClient({
  astaId,
  nome,
  analisiIniziale,
  faseIniziale,
  nomiPerIdIniziale,
}: {
  astaId: string;
  nome: string;
  analisiIniziale: AnalisiAstaLive | null;
  faseIniziale: FaseAsta;
  nomiPerIdIniziale: Record<number, string>;
}) {
  const [fase, setFase] = useState<FaseAsta>(faseIniziale);
  const [svolgimentoTipo, setSvolgimentoTipo] = useState<SvolgimentoAsta["tipo"]>("chiamata");
  const [letteraIniziale, setLetteraIniziale] = useState("A");
  const [pending, startTransition] = useTransition();

  const [prompt, setPrompt] = useState<string | null>(null);
  const [copiato, setCopiato] = useState(false);
  const [erroreGenerazione, setErroreGenerazione] = useState<string | null>(null);

  const [risposta, setRisposta] = useState("");
  const [erroreApplicazione, setErroreApplicazione] = useState<string | null>(null);
  const [analisi, setAnalisi] = useState<{ analisi: AnalisiAstaLive; nomiPerId: Record<number, string> } | null>(
    analisiIniziale ? { analisi: analisiIniziale, nomiPerId: nomiPerIdIniziale } : null,
  );

  const [applicando, setApplicando] = useState(false);
  const [pianoApplicato, setPianoApplicato] = useState(false);
  const [errorePiano, setErrorePiano] = useState<string | null>(null);

  function svolgimento(): SvolgimentoAsta {
    return svolgimentoTipo === "ordine" ? { tipo: "ordine", letteraIniziale } : { tipo: "chiamata" };
  }

  function genera() {
    setErroreGenerazione(null);
    setPrompt(null);
    setCopiato(false);
    startTransition(async () => {
      const esito = await generaPromptAnalisiLive(astaId, fase, svolgimento());
      if (esito.ok) setPrompt(esito.prompt);
      else setErroreGenerazione(esito.error);
    });
  }

  async function copia() {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopiato(true);
  }

  function valida() {
    setErroreApplicazione(null);
    setAnalisi(null);
    setPianoApplicato(false);
    startTransition(async () => {
      const esito = await applicaAnalisiLive(astaId, fase, risposta, svolgimento());
      if (esito.ok) setAnalisi({ analisi: esito.analisi, nomiPerId: esito.nomiPerId });
      else setErroreApplicazione(esito.error);
    });
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
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <AstaSubNav astaId={astaId} nome={nome} />

      <PageHeader
        title="Analisi live"
        description="Genera il prompt, copialo in una chat (es. Claude) e lasciala cercare sul web. Incolla la risposta: i numeri vengono ricalcolati con l'aritmetica esatta, non quella del modello."
      />

      <SectionCard title="Genera e incolla l'analisi" icon={Sparkles}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
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
              {svolgimentoTipo === "ordine" && (
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
              )}
              <Button type="button" size="sm" onClick={genera} disabled={pending}>
                {pending ? "Generazione…" : "Genera prompt"}
              </Button>
              {prompt && (
                <Button type="button" size="xs" variant="outline" className="ml-auto" onClick={() => void copia()}>
                  {copiato ? "Copiato" : "Copia prompt"}
                </Button>
              )}
            </div>

            {erroreGenerazione && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{erroreGenerazione}</span>
              </div>
            )}

            {prompt ? (
              <Textarea readOnly value={prompt} rows={8} className="h-full min-h-40 flex-1 overflow-y-auto font-mono text-xs" />
            ) : (
              <p className="flex min-h-40 flex-1 items-center justify-center rounded-lg border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
                Il prompt generato comparirà qui.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="risposta-analisi-live">Incolla qui la risposta</Label>
            <Textarea
              id="risposta-analisi-live"
              rows={8}
              className="min-h-40 flex-1 overflow-y-auto font-mono text-xs"
              value={risposta}
              onChange={(e) => setRisposta(e.target.value)}
            />
            {erroreApplicazione && <p className="text-sm text-destructive">{erroreApplicazione}</p>}
            <Button type="button" className="w-fit" onClick={valida} disabled={pending || !risposta.trim()}>
              {pending ? "Validazione…" : "Valida e mostra analisi"}
            </Button>
          </div>
        </div>
      </SectionCard>

      {analisi && (
        <>
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
        </>
      )}
    </div>
  );
}

function nomeGiocatore(id: number | null, nomiPerId: Record<number, string>): string {
  if (id === null) return "—";
  return nomiPerId[id] ?? `#${id}`;
}

function RisultatoAnalisi({ analisi, nomiPerId }: { analisi: AnalisiAstaLive; nomiPerId: Record<number, string> }) {
  return (
    <div className="flex flex-col gap-6">
      <AiCallout
        label="Sintesi dell'analisi"
        testo={analisi.sintesi}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={analisi.meta.affidabilita === "alta" ? "default" : analisi.meta.affidabilita === "media" ? "secondary" : "outline"}>
              affidabilità {analisi.meta.affidabilita}
            </Badge>
            {analisi.meta.degradato && (
              <Badge variant="outline" title={analisi.meta.noteDegrado ?? undefined}>
                analisi degradata
              </Badge>
            )}
            {!analisi.meta.ricercaWebEseguita && <Badge variant="outline">nessuna ricerca web</Badge>}
          </div>
        }
      />

      {analisi.alert.length > 0 && (
        <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
          {analisi.alert.map((a, i) => (
            <AlertRow key={i} alert={a} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        {analisi.minaccePerSlot.length > 0 && (
          <SectionCard title="I miei slot" icon={Target}>
            <div className="flex flex-col gap-2">
              {analisi.minaccePerSlot.map((m, i) => (
                <div key={i} className="rounded-lg border border-border/60 p-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="gap-1">
                      <span className={`size-1.5 rounded-full ${RUOLO_CLASSI[m.ruolo].dot}`} />
                      {RUOLO_LABEL[m.ruolo]} #{m.indiceSlot + 1}
                    </Badge>
                    <span className="font-medium">{nomeGiocatore(m.playerId, nomiPerId)}</span>
                    <Badge variant={VERDETTO_VARIANT[m.verdetto]}>{m.verdetto}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    tetto <span className="font-mono font-medium text-foreground">{m.mioTettoAggiornato}</span> · stima mercato{" "}
                    <span className="font-mono">{m.prezzoStimatoMercato}</span> · {m.nRivaliAttivi} rivali
                  </div>
                  <p className="mt-1 text-muted-foreground">{m.note}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {analisi.avversari.length > 0 && (
          <SectionCard title="Avversari" icon={Swords}>
            <div className="flex flex-col gap-2">
              {analisi.avversari.map((a) => (
                <div key={a.squadra} className="rounded-lg border border-border/60 p-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{a.squadra}</span>
                    <Badge variant={MINACCIA_VARIANT[a.livelloMinaccia]}>minaccia {a.livelloMinaccia}</Badge>
                    <Badge variant="outline">{a.profilo}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    max offerta <span className="font-mono font-medium text-foreground">{a.potereAcquistoMax}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{a.descrizioneProfilo}</p>
                  {a.obiettiviProbabili.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Probabili obiettivi:{" "}
                      {a.obiettiviProbabili
                        .map((o) => `${nomeGiocatore(o.playerId, nomiPerId)} (${Math.round(o.probabilita * 100)}%, ~${o.prezzoStimato})`)
                        .join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        {analisi.consigliChiamata.length > 0 && (
          <SectionCard title="Consigli di chiamata" icon={Megaphone}>
            <div className="flex flex-col gap-1.5">
              {analisi.consigliChiamata.map((c, i) => (
                <div key={i} className="flex flex-wrap items-start gap-1.5 rounded-lg border border-border/60 p-2.5 text-sm">
                  <Badge variant="outline">{c.tipo}</Badge>
                  <span className="font-medium">{nomeGiocatore(c.playerId, nomiPerId)}</span>
                  <span className="text-muted-foreground">{c.motivo}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        <SectionCard title="Piano aggiornato" icon={Coins}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-4 rounded-lg border border-border/60 p-2.5 font-mono text-sm">
              <span>crediti residui: {analisi.pianoAggiornato.creditiResiduiMiei}</span>
              <span>
                budget residuo: P{analisi.pianoAggiornato.budgetResiduoReparto.P} · D{analisi.pianoAggiornato.budgetResiduoReparto.D} · C
                {analisi.pianoAggiornato.budgetResiduoReparto.C} · A{analisi.pianoAggiornato.budgetResiduoReparto.A}
              </span>
            </div>
            {analisi.pianoAggiornato.prezziMassimiAggiornati.length > 0 && (
              <div className="flex flex-col gap-1">
                {analisi.pianoAggiornato.prezziMassimiAggiornati.map((p) => (
                  <div key={p.playerId} className="flex items-center gap-2 text-sm">
                    <span className="min-w-32 font-medium">{nomeGiocatore(p.playerId, nomiPerId)}</span>
                    <span className="font-mono">{p.valore}</span>
                    {p.delta !== 0 && (
                      <span className={p.delta > 0 ? "font-mono text-xs text-emerald-600 dark:text-emerald-400" : "font-mono text-xs text-destructive"}>
                        ({p.delta > 0 ? "+" : ""}
                        {p.delta})
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{p.motivo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {analisi.meta.fonti.length > 0 && (
        <SectionCard title="Fonti" icon={Link2}>
          <ul className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            {analisi.meta.fonti.map((f) => (
              <li key={f.url} className="max-w-xs truncate">
                <a href={f.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
                  {f.titolo}
                </a>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border p-2 text-xs">
      <Badge variant={GRAVITA_VARIANT[alert.gravita]} className="mt-0.5 shrink-0">
        {alert.gravita}
      </Badge>
      <div className="flex flex-col gap-0.5">
        <span>{alert.messaggio}</span>
        <span className="text-muted-foreground">{alert.azione}</span>
      </div>
    </div>
  );
}
