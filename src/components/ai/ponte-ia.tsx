"use client";

import { useState, type ReactNode } from "react";
import { Check, ClipboardCopy, Sparkles, Wand2 } from "lucide-react";
import type { z, ZodType } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { importaRisposta } from "@/lib/ai/importa";
import { cn } from "@/lib/utils";

// Il ciclo del Ponte IA manuale (§ Ponte IA nel PLAN.md) è identico per tutte
// e quattro le funzioni — strategia, dossier, analisi live, debrief: costruisci
// il prompt, copialo in una chat, incolla la risposta, valida, applica. Prima
// era riscritto quattro volte in quattro pagine; qui vive una volta sola.
//
// Due varianti tipizzate sopra un'unica base, invece di un solo componente con
// props a union: una union di firme di `onApplica` impedirebbe a TypeScript di
// inferire il tipo del parametro nella callback del chiamante, che è
// esattamente la cosa che deve restare comoda da scrivere.

export type EsitoApplicazione = { ok: true } | { ok: false; error: string };

type PropsComuni = {
  // Campi specifici della funzione (stile/rischio, fase d'asta…). Assente per
  // chi non ha parametri, come il debrief.
  parametri?: ReactNode;
  etichettaGenera?: string;
  // Sincrona quando il prompt si costruisce dai dati già in pagina, asincrona
  // quando serve una server action per leggerli da Blob (analisi live).
  generaPrompt: () => string | Promise<{ ok: true; prompt: string } | { ok: false; error: string }>;
  etichettaApplica?: string;
  messaggioSuccesso?: string;
  // Mostrato sotto il ponte: risultato salvato, sintesi già applicata…
  children?: ReactNode;
};

/** Ponte che valida la risposta contro uno schema zod prima di applicarla. */
export function PonteIA<S extends ZodType>({
  schema,
  onApplica,
  ...comuni
}: PropsComuni & {
  schema: S;
  onApplica: (data: z.infer<S>) => Promise<EsitoApplicazione>;
}) {
  return (
    <PonteIABase
      {...comuni}
      attendeJson
      applica={async (testo) => {
        const validato = importaRisposta(testo, schema);
        // L'errore di zod nomina il campo mancante: si rigira in chat così
        // com'è e Claude corregge (§ Ponte IA nel PLAN.md).
        if (!validato.ok) return { ok: false, error: validato.errore };
        return onApplica(validato.data);
      }}
    />
  );
}

/**
 * Ponte senza validazione client-side: la risposta è prosa da rileggere (il
 * debrief — "non serve nemmeno importarla", § Debrief nel PLAN.md) oppure la
 * validazione avviene nella server action (analisi live, che ricalcola i
 * numeri con l'aritmetica esatta invece di fidarsi di quella del modello).
 */
export function PonteIATesto({
  onApplica,
  ...comuni
}: PropsComuni & { onApplica: (testo: string) => Promise<EsitoApplicazione> }) {
  return <PonteIABase {...comuni} attendeJson={false} applica={onApplica} />;
}

type Fase = "parametri" | "prompt" | "fatto";

function PonteIABase({
  parametri,
  etichettaGenera = "Genera prompt",
  generaPrompt,
  etichettaApplica = "Valida e applica",
  messaggioSuccesso = "Applicato.",
  children,
  attendeJson,
  applica,
}: PropsComuni & {
  attendeJson: boolean;
  applica: (testo: string) => Promise<EsitoApplicazione>;
}) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [copiato, setCopiato] = useState(false);
  const [risposta, setRisposta] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [fatto, setFatto] = useState(false);

  const fase: Fase = fatto ? "fatto" : prompt ? "prompt" : "parametri";

  async function genera() {
    setErrore(null);
    setCopiato(false);
    setFatto(false);
    setPending(true);
    try {
      const esito = await generaPrompt();
      if (typeof esito === "string") setPrompt(esito);
      else if (esito.ok) setPrompt(esito.prompt);
      else setErrore(esito.error);
    } finally {
      setPending(false);
    }
  }

  async function copia() {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopiato(true);
  }

  async function conferma() {
    setErrore(null);
    setFatto(false);
    setPending(true);
    const esito = await applica(risposta);
    setPending(false);

    if (!esito.ok) {
      setErrore(esito.error);
      return;
    }
    setFatto(true);
    setRisposta("");
  }

  return (
    <div className="flex flex-col gap-4">
      {parametri && <div className="flex flex-col gap-3">{parametri}</div>}

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <Passo numero={1} titolo="Genera e copia il prompt" attivo={fase === "parametri"}>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={() => void genera()} disabled={pending}>
              <Wand2 />
              {pending && !prompt ? "Generazione…" : prompt ? "Rigenera" : etichettaGenera}
            </Button>
            {prompt && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant={copiato ? "secondary" : "outline"}
                  onClick={() => void copia()}
                >
                  {copiato ? <Check /> : <ClipboardCopy />}
                  {copiato ? "Copiato" : "Copia prompt"}
                </Button>
                <a
                  href="https://claude.ai/new"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  apri claude.ai
                </a>
              </>
            )}
          </div>
          {prompt && (
            <Textarea readOnly value={prompt} rows={6} className="max-h-56 overflow-y-auto font-mono text-xs" />
          )}
        </Passo>

        <Passo numero={2} titolo="Incolla qui la risposta" attivo={fase === "prompt"}>
          <Textarea
            placeholder={
              attendeJson ? "Incolla il blocco JSON che Claude ha risposto…" : "Incolla il testo della risposta…"
            }
            rows={6}
            className={cn(
              "max-h-56 overflow-y-auto",
              attendeJson ? "font-mono text-xs" : "text-[0.95rem] leading-relaxed",
            )}
            value={risposta}
            onChange={(e) => {
              setRisposta(e.target.value);
              setFatto(false);
            }}
          />
          {errore && <p className="text-sm text-destructive">{errore}</p>}
          {fatto && (
            <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-500">
              <Check className="size-4" />
              {messaggioSuccesso}
            </p>
          )}
          <Button
            type="button"
            size="sm"
            className="w-fit"
            onClick={() => void conferma()}
            disabled={pending || !risposta.trim()}
          >
            <Sparkles />
            {pending ? "Applicazione…" : etichettaApplica}
          </Button>
        </Passo>
      </div>

      {children}
    </div>
  );
}

function Passo({
  numero,
  titolo,
  attivo,
  children,
}: {
  numero: number;
  titolo: string;
  attivo: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          attivo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {numero}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className={cn("text-sm font-medium", !attivo && "text-muted-foreground")}>{titolo}</span>
        {children}
      </div>
    </div>
  );
}
