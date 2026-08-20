"use client";

import { Coins, Link2, Megaphone, Swords, Target } from "lucide-react";
import { AiCallout } from "@/components/shared/ai-callout";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { RUOLO_CLASSI, RUOLO_LABEL } from "@/lib/ruoli";
import type {
  AnalisiAstaLive,
  Alert,
  GravitaAlert,
  LivelloMinaccia,
  Verdetto,
} from "@/lib/analisi-live/schemas";

// Resa dei risultati dell'Analisi live, estratta da analisi-live-client.tsx
// quando le quattro funzioni IA sono confluite nell'hub /asta/[id]/ai: qui
// resta solo il "cosa mostrare", il ciclo copia-incolla-valida sta in PonteIA.

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

function nomeGiocatore(id: number | null, nomiPerId: Record<number, string>): string {
  if (id === null) return "—";
  return nomiPerId[id] ?? `#${id}`;
}

export function RisultatoAnalisi({ analisi, nomiPerId }: { analisi: AnalisiAstaLive; nomiPerId: Record<number, string> }) {
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
