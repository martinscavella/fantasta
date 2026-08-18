"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { costruisciBlocchi, buildPromptDossier, type BloccoDossier } from "@/lib/ai/prompts/dossier";
import { DossierBloccoGeneratoSchema } from "@/lib/ai/schemas";
import { importaRisposta } from "@/lib/ai/importa";
import { salvaBloccoDossier } from "@/lib/actions/dossier";
import type { DossierEntry, Player } from "@/lib/blob/schemas";

function BloccoDossierItem({
  stagione,
  blocco,
  importati,
}: {
  stagione: string;
  blocco: BloccoDossier;
  importati: Set<number>;
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [copiato, setCopiato] = useState(false);
  const [risposta, setRisposta] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const totale = blocco.giocatori.length;
  const fatti = blocco.giocatori.filter((g) => importati.has(g.id)).length;

  async function copia() {
    const testo = prompt ?? buildPromptDossier(blocco);
    setPrompt(testo);
    await navigator.clipboard.writeText(testo);
    setCopiato(true);
  }

  async function valida() {
    setErrore(null);
    const risultato = importaRisposta(risposta, DossierBloccoGeneratoSchema);
    if (!risultato.ok) {
      setErrore(risultato.errore);
      return;
    }
    setPending(true);
    const esito = await salvaBloccoDossier(stagione, blocco.blockId, risultato.data);
    setPending(false);
    if (!esito.ok) {
      setErrore(esito.error);
      return;
    }
    setRisposta("");
    router.refresh();
  }

  return (
    <li className="rounded-xl border border-border">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm"
        onClick={() => setAperto((a) => !a)}
      >
        <span className="flex-1 font-medium">{blocco.blockId}</span>
        <Badge variant={fatti === totale ? "secondary" : "outline"}>
          {fatti}/{totale} importati
        </Badge>
      </button>

      {aperto && (
        <div className="flex flex-col gap-3 border-t border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {blocco.giocatori.map((g) => g.nome).join(", ")}
            </span>
            <Button type="button" size="xs" variant="outline" onClick={() => void copia()}>
              {copiato ? "Copiato" : "Copia prompt"}
            </Button>
          </div>
          {prompt && <Textarea readOnly value={prompt} rows={6} className="font-mono text-xs" />}

          <Textarea
            placeholder="Incolla qui la risposta…"
            rows={6}
            className="font-mono text-xs"
            value={risposta}
            onChange={(e) => setRisposta(e.target.value)}
          />
          {errore && <p className="text-sm text-destructive">{errore}</p>}
          <Button type="button" size="sm" onClick={() => void valida()} disabled={pending || !risposta.trim()}>
            {pending ? "Salvataggio…" : "Valida e salva"}
          </Button>
        </div>
      )}
    </li>
  );
}

export function DossierClient({
  stagione,
  giocatori,
  dossierEsistente,
}: {
  stagione: string;
  giocatori: Player[];
  dossierEsistente: DossierEntry[];
}) {
  const blocchi = useMemo(() => costruisciBlocchi(giocatori), [giocatori]);
  const importati = useMemo(() => new Set(dossierEsistente.map((d) => d.playerId)), [dossierEsistente]);

  const totaleFatti = giocatori.filter((g) => importati.has(g.id)).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {totaleFatti}/{giocatori.length} giocatori con dossier — {blocchi.length} blocchi da {blocchi[0]?.giocatori.length ?? 0}.
      </p>
      <ul className="flex flex-col gap-2">
        {blocchi.map((blocco) => (
          <BloccoDossierItem key={blocco.blockId} stagione={stagione} blocco={blocco} importati={importati} />
        ))}
      </ul>
    </div>
  );
}
