"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ColonnaTarget, Player } from "@/lib/blob/schemas";

const CAMPI_TARGET: { value: ColonnaTarget; label: string }[] = [
  { value: "id", label: "Id" },
  { value: "nome", label: "Nome" },
  { value: "squadra", label: "Squadra" },
  { value: "ruolo", label: "Ruolo (P/D/C/A)" },
  { value: "quotazioneAttuale", label: "Quotazione attuale" },
  { value: "quotazioneIniziale", label: "Quotazione iniziale" },
  { value: "differenza", label: "Differenza" },
  { value: "fvm", label: "FVM" },
  { value: "fvmMantra", label: "FVM Mantra (segnale)" },
];

const IGNORA = "_ignora";

type Diff = {
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
  diff: Diff | null;
};

type CommitResponse = {
  versionId: string;
  numeroGiocatori: number;
  righeSaltate: number;
  diff: Diff | null;
};

export default function ImportListonePage() {
  const [file, setFile] = useState<File | null>(null);
  const [fonte, setFonte] = useState("");
  const [stagione, setStagione] = useState("");
  const [mappaOverride, setMappaOverride] = useState<Record<string, ColonnaTarget | undefined>>({});
  const [headerRowOverride, setHeaderRowOverride] = useState<number | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);

  const pronto = file !== null && fonte.trim() !== "" && stagione.trim() !== "";

  async function analizza() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setCommitResult(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("fonte", fonte);
      form.set("stagione", stagione);
      form.set("mode", "preview");
      if (Object.keys(mappaOverride).length > 0) form.set("mappa", JSON.stringify(mappaOverride));
      if (headerRowOverride !== null) form.set("headerRowIndex", String(headerRowOverride));

      const res = await fetch("/api/listone/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore durante l'analisi");
      setPreview(data as PreviewResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function conferma() {
    if (!file || !preview?.mappaCompleta) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("fonte", fonte);
      form.set("stagione", stagione);
      form.set("mode", "commit");
      form.set("mappa", JSON.stringify(preview.mappa));
      if (preview.headerRowIndex !== null) form.set("headerRowIndex", String(preview.headerRowIndex));

      const res = await fetch("/api/listone/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore durante l'importazione");
      setCommitResult(data as CommitResponse);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">Importa listone</h1>

      <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
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
            <Label htmlFor="stagione">Stagione</Label>
            <Input
              id="stagione"
              placeholder="es. 2026-27"
              value={stagione}
              onChange={(e) => setStagione(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="file">File (.xlsx o .csv)</Label>
          <input
            id="file"
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
              setMappaOverride({});
              setHeaderRowOverride(null);
              setCommitResult(null);
            }}
            className="text-sm"
          />
        </div>
        <Button onClick={analizza} disabled={!pronto || loading}>
          {loading ? "Analisi…" : "Analizza file"}
        </Button>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {preview && preview.headerRowIndex === null && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Non ho trovato automaticamente una riga di intestazione (serve una colonna Nome e una
            Squadra riconoscibili). Indica tu il numero di riga (1 = prima riga del file).
          </p>
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="headerRow">Riga di intestazione</Label>
              <Input
                id="headerRow"
                type="number"
                min={1}
                className="w-32"
                onChange={(e) => setHeaderRowOverride(e.target.value === "" ? null : Number(e.target.value) - 1)}
              />
            </div>
            <Button variant="outline" onClick={analizza} disabled={headerRowOverride === null || loading}>
              Usa questa riga
            </Button>
          </div>
        </div>
      )}

      {preview && preview.headerRowIndex !== null && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">
              Mappatura colonne (riga {preview.headerRowIndex + 1})
            </h2>
            {!preview.mappaCompleta && (
              <p className="text-sm text-muted-foreground">
                Campi obbligatori ancora da assegnare: {preview.campiMancanti.join(", ")}
              </p>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colonna nel file</TableHead>
                  <TableHead>Campo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.headers.map((header) => {
                  const attuale = mappaOverride[header] ?? preview.mappa[header];
                  return (
                    <TableRow key={header}>
                      <TableCell>{header}</TableCell>
                      <TableCell>
                        <Select
                          value={attuale ?? IGNORA}
                          onValueChange={(value) => {
                            const v = value as ColonnaTarget | typeof IGNORA | null;
                            setMappaOverride((prev) => ({
                              ...prev,
                              [header]: v === IGNORA || v === null ? undefined : v,
                            }));
                          }}
                        >
                          <SelectTrigger size="sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={IGNORA}>(ignora)</SelectItem>
                            {CAMPI_TARGET.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Button variant="outline" onClick={analizza} disabled={loading}>
              Aggiorna mappatura
            </Button>
          </div>

          {preview.mappaCompleta && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-3 text-sm">
                <Badge variant="secondary">{preview.giocatori.length} giocatori</Badge>
                {preview.righeSaltate > 0 && (
                  <Badge variant="outline">{preview.righeSaltate} righe scartate (dati mancanti)</Badge>
                )}
                {preview.diff && (
                  <>
                    <Badge variant="secondary">{preview.diff.nuovi.length} nuovi</Badge>
                    <Badge variant="secondary">{preview.diff.ceduti.length} ceduti</Badge>
                    <Badge variant="secondary">{preview.diff.quotazioniVariate.length} quotazioni variate</Badge>
                  </>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Squadra</TableHead>
                      <TableHead>R</TableHead>
                      <TableHead>Qt.A</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.giocatori.slice(0, 50).map((g) => (
                      <TableRow key={g.id}>
                        <TableCell>{g.nome}</TableCell>
                        <TableCell>{g.squadra}</TableCell>
                        <TableCell>{g.ruolo}</TableCell>
                        <TableCell>{g.quotazioneAttuale}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {preview.giocatori.length > 50 && (
                <p className="text-xs text-muted-foreground">
                  Mostrati i primi 50 di {preview.giocatori.length}.
                </p>
              )}

              <Button onClick={conferma} disabled={loading}>
                {loading ? "Importazione…" : "Conferma e importa"}
              </Button>
            </div>
          )}
        </div>
      )}

      {commitResult && (
        <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
          Importati {commitResult.numeroGiocatori} giocatori (versione {commitResult.versionId}).
        </p>
      )}
    </div>
  );
}
