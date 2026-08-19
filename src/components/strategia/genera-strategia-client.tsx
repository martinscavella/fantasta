"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AstaSubNav } from "@/components/asta/asta-sub-nav";
import { buildPromptStrategia } from "@/lib/ai/prompts/strategia";
import { StrategiaGeneratasSchema } from "@/lib/ai/schemas";
import { importaRisposta } from "@/lib/ai/importa";
import { applicaStrategiaGenerata } from "@/lib/actions/strategia";
import type { Player, SetupDoc } from "@/lib/blob/schemas";

export function GeneraStrategiaClient({ setup, giocatori }: { setup: SetupDoc; giocatori: Player[] }) {
  const [stile, setStile] = useState("");
  const [rischio, setRischio] = useState("");
  const [vincoli, setVincoli] = useState("");
  const [regolePunteggio, setRegolePunteggio] = useState("");
  const [prompt, setPrompt] = useState<string | null>(null);
  const [copiato, setCopiato] = useState(false);

  const [risposta, setRisposta] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [applicata, setApplicata] = useState(false);

  function genera() {
    setPrompt(buildPromptStrategia(setup, giocatori, { stile, rischio, vincoli, regolePunteggio }));
    setCopiato(false);
  }

  async function copia() {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopiato(true);
  }

  async function valida() {
    setErrore(null);
    setApplicata(false);
    const risultato = importaRisposta(risposta, StrategiaGeneratasSchema);
    if (!risultato.ok) {
      setErrore(risultato.errore);
      return;
    }
    setPending(true);
    const esito = await applicaStrategiaGenerata(setup.id, risultato.data);
    setPending(false);
    if (!esito.ok) {
      setErrore(esito.error);
      return;
    }
    setApplicata(true);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6 md:p-8">
      <AstaSubNav astaId={setup.id} nome={setup.nome} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Genera strategia</h1>
        <Link href={`/strategia/${setup.id}`} className="text-sm text-primary hover:underline">
          Torna alla strategia
        </Link>
      </div>

      <p className="text-sm text-muted-foreground">
        Compila i parametri, copia il prompt e incollalo in una chat Claude sul tuo abbonamento. Claude farà ricerca
        sul web e risponderà con un blocco JSON: incollalo qui sotto per validarlo e applicarlo alla strategia.
      </p>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stile">Stile di squadra desiderato</Label>
          <Textarea
            id="stile"
            placeholder="es. corazzata difensiva, pochi bomber costosi e tanti difensori solidi"
            value={stile}
            onChange={(e) => setStile(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rischio">Propensione al rischio</Label>
          <Textarea
            id="rischio"
            placeholder="es. accetto 3-4 scommesse ad alto potenziale, il resto certezze"
            value={rischio}
            onChange={(e) => setRischio(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vincoli">Vincoli personali (giocatori/squadre da evitare o da prendere, tetto massimo)</Label>
          <Textarea id="vincoli" value={vincoli} onChange={(e) => setVincoli(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="regolePunteggio">Regole di punteggio particolari della lega</Label>
          <Textarea
            id="regolePunteggio"
            placeholder="es. modificatore di difesa, portiere imbattuto, assist che valgono doppio"
            value={regolePunteggio}
            onChange={(e) => setRegolePunteggio(e.target.value)}
          />
        </div>
        <Button type="button" onClick={genera}>
          Genera prompt
        </Button>
      </section>

      {prompt && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Prompt</h2>
            <Button type="button" size="xs" variant="outline" onClick={() => void copia()}>
              {copiato ? "Copiato" : "Copia prompt"}
            </Button>
          </div>
          <Textarea readOnly value={prompt} rows={10} className="font-mono text-xs" />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <Label htmlFor="risposta">Incolla qui la risposta</Label>
        <Textarea
          id="risposta"
          rows={10}
          className="font-mono text-xs"
          value={risposta}
          onChange={(e) => setRisposta(e.target.value)}
        />
        {errore && <p className="text-sm text-destructive">{errore}</p>}
        {applicata && <p className="text-sm text-emerald-700 dark:text-emerald-500">Strategia applicata.</p>}
        <Button type="button" onClick={() => void valida()} disabled={pending || !risposta.trim()}>
          {pending ? "Applicazione…" : "Valida e applica"}
        </Button>
      </section>
    </div>
  );
}
