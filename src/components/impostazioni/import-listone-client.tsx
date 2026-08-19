"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ColonnaTarget, Player } from "@/lib/blob/schemas";

const IGNORA = "_ignora";

const LABEL_COLONNA: Record<ColonnaTarget, string> = {
  id: "Id",
  nome: "Nome",
  squadra: "Squadra",
  ruolo: "Ruolo",
  quotazioneAttuale: "Qt.A",
  quotazioneIniziale: "Qt.I",
  differenza: "Diff.",
  fvm: "FVM",
  fvmMantra: "FVM M",
};
const COLONNE_TARGET = Object.keys(LABEL_COLONNA) as ColonnaTarget[];

type ListoneDiff = {
  nuovi: Player[];
  ceduti: Player[];
  quotazioniVariate: { nome: string; squadra: string; prima: number; dopo: number }[];
};

type PreviewResponse = {
  headerRowIndex: number | null;
  headers: string[];
  mappa: Record<string, ColonnaTarget>;
  mappaCompleta: boolean;
  campiMancanti: ColonnaTarget[];
  giocatori: Player[];
  righeSaltate: number;
  diff: ListoneDiff | null;
};

type CommitResponse = { versionId: string; numeroGiocatori: number; righeSaltate: number; diff: ListoneDiff | null };

const PASSI = ["Carica file", "Mappa colonne", "Conferma"] as const;

// Stepper minimale: la pagina è un wizard lineare di 3 passi ma prima si
// leggeva come un unico form indistinto — qui basta lo stato già presente
// (anteprima/esito) per capire in che passo si è, senza altro stato dedicato.
function Stepper({ passoAttivo }: { passoAttivo: 0 | 1 | 2 }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {PASSI.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full font-semibold",
                i < passoAttivo && "bg-primary/15 text-primary",
                i === passoAttivo && "bg-primary text-primary-foreground",
                i > passoAttivo && "bg-muted text-muted-foreground",
              )}
            >
              {i + 1}
            </span>
            <span className={cn(i === passoAttivo ? "font-medium text-foreground" : "text-muted-foreground")}>{label}</span>
          </div>
          {i < PASSI.length - 1 && <span className="h-px w-6 bg-border" />}
        </div>
      ))}
    </div>
  );
}

export function ImportListoneClient({ stagione }: { stagione: string }) {
  const router = useRouter();
  const [fonte, setFonte] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [anteprima, setAnteprima] = useState<PreviewResponse | null>(null);
  const [mappaOverride, setMappaOverride] = useState<Record<string, ColonnaTarget | typeof IGNORA>>({});
  const [pending, setPending] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [esito, setEsito] = useState<CommitResponse | null>(null);

  function buildFormData(mode: "preview" | "commit"): FormData | null {
    if (!file || !fonte.trim()) return null;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("fonte", fonte.trim());
    fd.append("stagione", stagione);
    fd.append("mode", mode);
    if (anteprima?.headerRowIndex !== null && anteprima?.headerRowIndex !== undefined) {
      fd.append("headerRowIndex", String(anteprima.headerRowIndex));
    }
    fd.append("mappa", JSON.stringify(mappaOverride));
    return fd;
  }

  async function analizza() {
    const fd = buildFormData("preview");
    if (!fd) {
      setErrore("Seleziona un file e indica la fonte prima di analizzare");
      return;
    }
    setPending(true);
    setErrore(null);
    setEsito(null);
    try {
      const res = await fetch("/api/listone/import", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) {
        setErrore(body.error ?? "Errore durante l'analisi");
        return;
      }
      setAnteprima(body as PreviewResponse);
    } finally {
      setPending(false);
    }
  }

  function cambiaMappa(header: string, valore: string) {
    setMappaOverride((prev) => ({ ...prev, [header]: valore as ColonnaTarget | typeof IGNORA }));
  }

  async function conferma() {
    const fd = buildFormData("commit");
    if (!fd) return;
    setPending(true);
    setErrore(null);
    try {
      const res = await fetch("/api/listone/import", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) {
        setErrore(body.error ?? "Errore durante l'importazione");
        return;
      }
      setEsito(body as CommitResponse);
    } finally {
      setPending(false);
    }
  }

  const passoAttivo = esito ? 2 : anteprima ? 1 : 0;

  return (
    <div className="flex flex-col gap-4">
      <Stepper passoAttivo={passoAttivo} />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fonte">Fonte</Label>
          <Input
            id="fonte"
            placeholder="es. fantacalcio.it, fantaclub"
            value={fonte}
            onChange={(e) => setFonte(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="file">File (.xlsx o .csv)</Label>
          <input
            id="file"
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setAnteprima(null);
              setEsito(null);
            }}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm"
          />
        </div>
      </div>

      <Button type="button" onClick={() => void analizza()} disabled={pending || !file || !fonte.trim()}>
        {pending ? "Analisi…" : "Analizza file"}
      </Button>

      {errore && <p className="text-sm text-destructive">{errore}</p>}

      {anteprima && anteprima.headerRowIndex === null && (
        <p className="text-sm text-destructive">
          Riga di intestazione non trovata: verifica che il file contenga colonne riconducibili a nome e squadra.
        </p>
      )}

      {anteprima && anteprima.headerRowIndex !== null && (
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              Mappatura colonne (riga intestazione: {anteprima.headerRowIndex + 1})
            </h2>
            <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
              {anteprima.headers.map((header) => {
                const valore = mappaOverride[header] ?? anteprima.mappa[header] ?? IGNORA;
                return (
                  <div key={header} className="flex items-center gap-3 text-sm">
                    <span className="w-48 truncate font-mono text-xs text-muted-foreground">{header}</span>
                    <Select value={valore} onValueChange={(v) => cambiaMappa(header, v ?? IGNORA)}>
                      <SelectTrigger size="sm" className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={IGNORA}>Ignora</SelectItem>
                        {COLONNE_TARGET.map((c) => (
                          <SelectItem key={c} value={c}>
                            {LABEL_COLONNA[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void analizza()} disabled={pending}>
              Ricalcola anteprima con questa mappatura
            </Button>
          </section>

          {anteprima.campiMancanti.length > 0 && (
            <p className="text-sm text-destructive">
              Mappatura incompleta: mancano {anteprima.campiMancanti.map((c) => LABEL_COLONNA[c]).join(", ")}.
            </p>
          )}

          {anteprima.mappaCompleta && (
            <>
              <section className="flex flex-wrap items-center gap-3 text-sm">
                <Badge variant="secondary">{anteprima.giocatori.length} giocatori</Badge>
                {anteprima.righeSaltate > 0 && <Badge variant="outline">{anteprima.righeSaltate} righe saltate</Badge>}
                {anteprima.diff && (
                  <>
                    <Badge variant="outline">{anteprima.diff.nuovi.length} nuovi</Badge>
                    <Badge variant="outline">{anteprima.diff.ceduti.length} ceduti</Badge>
                    <Badge variant="outline">{anteprima.diff.quotazioniVariate.length} quotazioni variate</Badge>
                  </>
                )}
              </section>

              <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
                <ul className="flex flex-col">
                  {anteprima.giocatori.slice(0, 50).map((g) => (
                    <li key={g.id} className="flex items-center gap-2 border-b border-border/60 px-2 py-1.5 text-sm">
                      <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground">{g.ruolo}</span>
                      <span className="flex-1 truncate">{g.nome}</span>
                      <span className="text-xs text-muted-foreground">{g.squadra}</span>
                      <span className="w-10 text-right font-mono">{g.quotazioneAttuale}</span>
                    </li>
                  ))}
                </ul>
                {anteprima.giocatori.length > 50 && (
                  <p className="p-2 text-xs text-muted-foreground">
                    Mostrati 50 di {anteprima.giocatori.length}.
                  </p>
                )}
              </div>

              <Button type="button" onClick={() => void conferma()} disabled={pending}>
                {pending ? "Importazione…" : "Conferma import"}
              </Button>
            </>
          )}
        </div>
      )}

      {esito && (
        <div className="flex flex-col gap-2 rounded-xl border border-border p-3 text-sm">
          <p>
            Importati {esito.numeroGiocatori} giocatori (versione {esito.versionId}).
            {esito.righeSaltate > 0 && ` ${esito.righeSaltate} righe saltate.`}
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => router.push(`/listone?stagione=${stagione}`)}>
            Vai al listone
          </Button>
        </div>
      )}
    </div>
  );
}
