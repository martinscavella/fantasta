"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, ListChecks, Settings2, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Stepper } from "@/components/shared/stepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Ruolo } from "@/lib/blob/schemas";
import type { ProblemaImport, RiepilogoSquadra } from "@/lib/rose/importa";

const PASSI = ["Carica file", "Configura regolamento", "Conferma"] as const;
const RUOLI: Ruolo[] = ["P", "D", "C", "A"];

type Anteprima = {
  squadre: RiepilogoSquadra[];
  problemi: ProblemaImport[];
  bloccanti: ProblemaImport[];
  daConfermare: ProblemaImport[];
  eventiApplicati: number;
  eventiTotali: number;
  righeSaltate: number;
  creditiBaseMinimo: number;
  slotMinimi: Record<Ruolo, number>;
  nomiSquadre: string[];
};

type Regolamento = {
  creditiBase: string;
  slot: Record<Ruolo, string>;
  sforoTipo: "nessuno" | "a-pagamento";
  euroPerCredito: string;
  miaSquadraIndex: string;
};

const REGOLAMENTO_INIZIALE: Regolamento = {
  creditiBase: "500",
  slot: { P: "3", D: "8", C: "8", A: "6" },
  sforoTipo: "nessuno",
  euroPerCredito: "0.1",
  miaSquadraIndex: "0",
};

function descriviProblema(p: ProblemaImport): string {
  switch (p.tipo) {
    case "giocatore-sconosciuto":
      return `Id ${p.playerId} (rosa di ${p.squadra}) non esiste nel listone di questa stagione.`;
    case "giocatore-duplicato":
      return `${p.nome} compare in più rose (${p.squadre.join(", ")}): resterebbe assegnato solo alla prima.`;
    case "budget-superato":
      return `${p.squadra} ha speso ${p.speso} crediti, oltre i ${p.budget} configurati.`;
    case "slot-superato":
      return `${p.squadra} ha ${p.conteggio} ${p.ruolo}, oltre i ${p.slot} slot configurati.`;
  }
}

export function ImportaRoseClient({
  stagione,
  listoneDescrizione,
}: {
  stagione: string;
  listoneDescrizione: string;
}) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [regolamento, setRegolamento] = useState<Regolamento>(REGOLAMENTO_INIZIALE);
  const [anteprima, setAnteprima] = useState<Anteprima | null>(null);
  const [confermaScarti, setConfermaScarti] = useState(false);
  const [pending, setPending] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  function buildFormData(mode: "preview" | "commit"): FormData | null {
    if (!file) return null;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mode", mode);
    fd.append("stagione", stagione);
    fd.append("nome", nome.trim());
    fd.append("creditiBase", regolamento.creditiBase);
    for (const ruolo of RUOLI) fd.append(`slot${ruolo}`, regolamento.slot[ruolo]);
    fd.append("sforoTipo", regolamento.sforoTipo);
    fd.append("euroPerCredito", regolamento.euroPerCredito);
    fd.append("miaSquadraIndex", regolamento.miaSquadraIndex);
    fd.append("forza", String(confermaScarti));
    return fd;
  }

  async function invia(mode: "preview" | "commit") {
    const fd = buildFormData(mode);
    if (!fd) {
      setErrore("Seleziona il file delle rose prima di continuare");
      return;
    }
    setPending(true);
    setErrore(null);
    try {
      const res = await fetch("/api/rose/import", { method: "POST", body: fd });
      const body = await res.json();
      // Anche i rifiuti (409) portano l'anteprima aggiornata: va mostrata
      // comunque, è quella che spiega perché il commit non è passato.
      if (body.squadre) setAnteprima(body as Anteprima);
      if (!res.ok) {
        setErrore(body.error ?? "Errore durante l'import");
        return;
      }
      if (mode === "commit" && body.astaId) router.push(`/asta/${body.astaId}/riepilogo`);
    } catch {
      setErrore("Richiesta fallita: controlla la connessione e riprova");
    } finally {
      setPending(false);
    }
  }

  function aggiornaSlot(ruolo: Ruolo, valore: string) {
    setRegolamento((prev) => ({ ...prev, slot: { ...prev.slot, [ruolo]: valore } }));
  }

  const bloccato = !anteprima || anteprima.bloccanti.length > 0;
  const passoAttivo = anteprima ? (anteprima.bloccanti.length === 0 ? 2 : 1) : 0;
  const serveConferma = (anteprima?.daConfermare.length ?? 0) > 0;
  const tuttoApplicato = anteprima !== null && anteprima.eventiApplicati === anteprima.eventiTotali;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6 md:p-8">
      <PageHeader
        title="Importa un'asta conclusa"
        description={`Carica il "file per fantaleghe" di Fantacalcio.it: crea l'asta con le squadre del file e tutte le assegnazioni, pronta per il Riepilogo. ${listoneDescrizione}`}
      />

      <Stepper passi={PASSI} passoAttivo={passoAttivo} />

      <SectionCard title="File e nome asta" icon={FileUp}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nome">Nome asta</Label>
            <Input
              id="nome"
              placeholder="es. Lega degli amici"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="file">File rose (.csv)</Label>
            <input
              id="file"
              type="file"
              accept=".csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setAnteprima(null);
                setConfermaScarti(false);
              }}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Regolamento"
        icon={Settings2}
        description="Il file non contiene le regole della lega: vanno impostate qui. L'anteprima segnala se non reggono i dati caricati, e sotto ogni campo mostra il minimo compatibile."
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="creditiBase">Crediti</Label>
              <Input
                id="creditiBase"
                type="number"
                min={1}
                value={regolamento.creditiBase}
                onChange={(e) => setRegolamento((prev) => ({ ...prev, creditiBase: e.target.value }))}
              />
              {anteprima && (
                <span className="text-xs text-muted-foreground">
                  min <span className="font-mono">{anteprima.creditiBaseMinimo}</span>
                </span>
              )}
            </div>
            {RUOLI.map((ruolo) => (
              <div key={ruolo} className="flex flex-col gap-1.5">
                <Label htmlFor={`slot${ruolo}`}>{ruolo}</Label>
                <Input
                  id={`slot${ruolo}`}
                  type="number"
                  min={1}
                  value={regolamento.slot[ruolo]}
                  onChange={(e) => aggiornaSlot(ruolo, e.target.value)}
                />
                {anteprima && (
                  <span className="text-xs text-muted-foreground">
                    min <span className="font-mono">{anteprima.slotMinimi[ruolo]}</span>
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>Modalità sforo</Label>
              <Select
                value={regolamento.sforoTipo}
                onValueChange={(v) =>
                  setRegolamento((prev) => ({
                    ...prev,
                    sforoTipo: (v as Regolamento["sforoTipo"]) ?? "nessuno",
                  }))
                }
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nessuno">Nessuno (budget chiuso)</SelectItem>
                  <SelectItem value="a-pagamento">A sforo (crediti extra a pagamento)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {regolamento.sforoTipo === "a-pagamento" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="euroPerCredito">€ per credito extra</Label>
                <Input
                  id="euroPerCredito"
                  type="number"
                  min={0}
                  step="0.01"
                  value={regolamento.euroPerCredito}
                  onChange={(e) => setRegolamento((prev) => ({ ...prev, euroPerCredito: e.target.value }))}
                />
              </div>
            )}

            {anteprima && (
              <div className="flex flex-col gap-1.5">
                <Label>La tua squadra</Label>
                <Select
                  value={regolamento.miaSquadraIndex}
                  onValueChange={(v) => setRegolamento((prev) => ({ ...prev, miaSquadraIndex: v ?? "0" }))}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anteprima.nomiSquadre.map((s, i) => (
                      <SelectItem key={s} value={String(i)}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Button type="button" onClick={() => void invia("preview")} disabled={pending || !file}>
            {pending ? "Analisi…" : anteprima ? "Ricalcola anteprima" : "Analizza file"}
          </Button>
        </div>
      </SectionCard>

      {errore && <p className="text-sm text-destructive">{errore}</p>}

      {anteprima && (
        <SectionCard
          title="Anteprima"
          icon={ListChecks}
          actions={
            <>
              <Badge variant="secondary">{anteprima.squadre.length} squadre</Badge>
              <Badge variant={tuttoApplicato ? "secondary" : "outline"}>
                {anteprima.eventiApplicati}/{anteprima.eventiTotali} assegnazioni
              </Badge>
              {anteprima.righeSaltate > 0 && (
                <Badge variant="outline">{anteprima.righeSaltate} righe illeggibili</Badge>
              )}
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Squadra</th>
                    <th className="px-3 py-2 text-right font-medium">Spesa</th>
                    {RUOLI.map((r) => (
                      <th key={r} className="px-2 py-2 text-right font-medium">
                        {r}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right font-medium">Sforo</th>
                  </tr>
                </thead>
                <tbody>
                  {anteprima.squadre.map((s, indice) => (
                    <tr key={s.nome} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-1.5">
                        {s.nome}
                        {String(indice) === regolamento.miaSquadraIndex && (
                          <span className="ml-2 text-xs text-muted-foreground">(la tua)</span>
                        )}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-1.5 text-right font-mono",
                          s.sforoCrediti > 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {s.totaleSpeso}
                      </td>
                      {RUOLI.map((r) => (
                        <td
                          key={r}
                          className={cn(
                            "px-2 py-1.5 text-right font-mono",
                            s.conteggioPerRuolo[r] > Number(regolamento.slot[r]) &&
                              "text-rose-600 dark:text-rose-400",
                          )}
                        >
                          {s.conteggioPerRuolo[r]}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                        {s.sforoCrediti > 0
                          ? s.sforoEuro !== null
                            ? `${s.sforoCrediti} · ${s.sforoEuro.toFixed(2)} €`
                            : String(s.sforoCrediti)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {anteprima.problemi.length > 0 && (
              <ul className="flex flex-col gap-1 rounded-xl border border-border p-3 text-sm">
                {anteprima.problemi.slice(0, 30).map((p, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <TriangleAlert
                      className={cn(
                        "mt-0.5 size-3.5 shrink-0",
                        p.tipo === "budget-superato" || p.tipo === "slot-superato"
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-amber-600 dark:text-amber-400",
                      )}
                    />
                    <span>{descriviProblema(p)}</span>
                  </li>
                ))}
                {anteprima.problemi.length > 30 && (
                  <li className="text-xs text-muted-foreground">…e altri {anteprima.problemi.length - 30}.</li>
                )}
              </ul>
            )}

            {bloccato ? (
              <p className="text-sm text-destructive">
                Correggi crediti o slot qui sopra: con questo regolamento alcune assegnazioni verrebbero scartate
                in silenzio, e le rose risulterebbero incomplete.
              </p>
            ) : (
              <>
                {serveConferma && (
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={confermaScarti}
                      onChange={(e) => setConfermaScarti(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      Importa comunque, scartando le {anteprima.eventiTotali - anteprima.eventiApplicati} righe
                      segnalate qui sopra.
                    </span>
                  </label>
                )}
                <Button
                  type="button"
                  onClick={() => void invia("commit")}
                  disabled={pending || !nome.trim() || (serveConferma && !confermaScarti)}
                >
                  <CheckCircle2 className="size-4" />
                  {pending ? "Import…" : "Crea asta e importa le rose"}
                </Button>
                {!nome.trim() && (
                  <p className="text-xs text-muted-foreground">Dai un nome all&apos;asta per procedere.</p>
                )}
              </>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
