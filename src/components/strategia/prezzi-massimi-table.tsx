"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClubBadge } from "@/components/shared/club-badge";
import { indiceFascia, normalizzaFasce } from "@/lib/strategia/fasce";
import { prezzoMassimoDefault } from "@/lib/pricing";
import { RUOLI, RUOLO_CLASSI } from "@/lib/ruoli";
import { cn } from "@/lib/utils";
import type { Fascia, Player, PrezzoMassimo } from "@/lib/blob/schemas";

// Tre correzioni rispetto a prima:
//
// 1. La tabella mostrava le fasce *standard* (fasciaStandard) ignorando quelle
//    che l'utente ha appena configurato nella sezione sopra: due verità
//    diverse sulla stessa pagina. Ora legge strategy.fasce.
// 2. Nessun ordinamento, e un taglio a 150 righe su ~500: le 150 mostrate
//    erano quelle con l'id più basso, cioè arbitrarie. Ora si ordina, e per
//    default dai più cari — che sono quelli su cui un tetto serve davvero.
// 3. Nessun modo di annullare un override: una volta scritto a mano, il
//    valore calcolato era perso.

const TUTTI = "_tutti";

type Ordinamento = "quotazione-desc" | "scostamento-desc" | "nome";

const ORDINAMENTI: { id: Ordinamento; label: string }[] = [
  { id: "quotazione-desc", label: "Quotazione ↓" },
  { id: "scostamento-desc", label: "Più ritoccati" },
  { id: "nome", label: "Nome A-Z" },
];

const LIMITE = 150;

export function PrezziMassimiTable({
  giocatori,
  prezziMassimi,
  fasce,
  creditiBase,
  onChange,
}: {
  giocatori: Player[];
  prezziMassimi: PrezzoMassimo[];
  fasce: Fascia[];
  creditiBase: number;
  onChange: (prezzi: PrezzoMassimo[]) => void;
}) {
  const [filtroRuolo, setFiltroRuolo] = useState<string>(TUTTI);
  const [filtroTesto, setFiltroTesto] = useState("");
  const [ordinamento, setOrdinamento] = useState<Ordinamento>("quotazione-desc");
  const [soloRitoccati, setSoloRitoccati] = useState(false);

  const prezzoPerId = useMemo(() => new Map(prezziMassimi.map((p) => [p.playerId, p])), [prezziMassimi]);
  const fasceNormalizzate = useMemo(() => normalizzaFasce(fasce), [fasce]);
  const manuali = useMemo(() => prezziMassimi.filter((p) => p.origine === "manuale").length, [prezziMassimi]);

  function calcolato(g: Player): number {
    return prezzoMassimoDefault(g.quotazioneAttuale, creditiBase);
  }

  const filtrati = useMemo(() => {
    const query = filtroTesto.trim().toLowerCase();
    const base = giocatori.filter((g) => {
      if (filtroRuolo !== TUTTI && g.ruolo !== filtroRuolo) return false;
      if (soloRitoccati && prezzoPerId.get(g.id)?.origine !== "manuale") return false;
      if (query && !g.nome.toLowerCase().includes(query) && !g.squadra.toLowerCase().includes(query)) return false;
      return true;
    });

    const scostamento = (g: Player) => Math.abs((prezzoPerId.get(g.id)?.valore ?? calcolato(g)) - calcolato(g));

    return [...base].sort((a, b) => {
      switch (ordinamento) {
        case "quotazione-desc":
          return b.quotazioneAttuale - a.quotazioneAttuale;
        case "scostamento-desc":
          return scostamento(b) - scostamento(a);
        case "nome":
          return a.nome.localeCompare(b.nome);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- calcolato dipende solo da creditiBase
  }, [giocatori, filtroRuolo, filtroTesto, soloRitoccati, ordinamento, prezzoPerId, creditiBase]);

  function imposta(playerId: number, valore: number) {
    const next = prezzoPerId.has(playerId)
      ? prezziMassimi.map((p) => (p.playerId === playerId ? { ...p, valore, origine: "manuale" as const } : p))
      : [...prezziMassimi, { playerId, valore, origine: "manuale" as const }];
    onChange(next);
  }

  function ripristina(playerId: number) {
    onChange(prezziMassimi.filter((p) => p.playerId !== playerId));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Cerca giocatore…"
          value={filtroTesto}
          onChange={(e) => setFiltroTesto(e.target.value)}
          className="w-48"
        />

        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setFiltroRuolo(TUTTI)}
            className={cn(
              "flex h-8 items-center rounded-full border px-2.5 text-xs font-medium transition-colors",
              filtroRuolo === TUTTI
                ? "border-transparent bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            Tutti
          </button>
          {RUOLI.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setFiltroRuolo(r)}
              className={cn(
                "flex size-8 items-center justify-center rounded-full border font-mono text-xs font-semibold transition-colors active:scale-90",
                filtroRuolo === r
                  ? cn(RUOLO_CLASSI[r].solid, "border-transparent")
                  : cn("border-border", RUOLO_CLASSI[r].badge),
              )}
            >
              {r}
            </button>
          ))}
        </div>

        <Select
          value={ordinamento}
          onValueChange={(v) => setOrdinamento((v as Ordinamento) ?? "quotazione-desc")}
          items={Object.fromEntries(ORDINAMENTI.map((o) => [o.id, o.label]))}
        >
          <SelectTrigger size="sm" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDINAMENTI.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {manuali > 0 && (
          <label className="flex h-8 items-center gap-1.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={soloRitoccati}
              onChange={(e) => setSoloRitoccati(e.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            Solo i {manuali} ritoccati
          </label>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto rounded-xl border border-border">
        {filtrati.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nessun giocatore con questi filtri.</p>
        ) : (
          <ul className="flex flex-col">
            {filtrati.slice(0, LIMITE).map((g) => {
              const impostato = prezzoPerId.get(g.id);
              const base = calcolato(g);
              const valore = impostato?.valore ?? base;
              const manuale = impostato?.origine === "manuale";
              const delta = valore - base;
              const i = indiceFascia(fasceNormalizzate, g.quotazioneAttuale);
              const fascia = i >= 0 ? fasceNormalizzate[i] : null;

              return (
                <li
                  key={g.id}
                  className={cn(
                    "flex items-center gap-2 border-b border-border/60 px-2 py-1.5 text-sm transition-colors last:border-b-0 hover:bg-accent/40",
                    manuale && "border-l-2 border-l-primary",
                  )}
                >
                  <span
                    className={cn(
                      "w-5 shrink-0 rounded px-1 text-center font-mono text-[10px] font-semibold",
                      RUOLO_CLASSI[g.ruolo].badge,
                    )}
                  >
                    {g.ruolo}
                  </span>
                  <ClubBadge squadra={g.squadra} size="xs" />
                  <span className="min-w-0 flex-1 truncate">{g.nome}</span>

                  {fascia && (
                    <Badge variant="outline" className="hidden shrink-0 text-[10px] sm:inline-flex">
                      {fascia.nome}
                    </Badge>
                  )}

                  <span className="w-12 shrink-0 text-right font-mono text-xs text-muted-foreground">
                    Qt. {g.quotazioneAttuale}
                  </span>

                  <Input
                    type="number"
                    min={0}
                    value={valore}
                    onChange={(e) => imposta(g.id, Number(e.target.value))}
                    className="h-7 w-20 shrink-0 font-mono"
                    aria-label={`Prezzo massimo per ${g.nome}`}
                  />

                  {/* Scostamento dal valore calcolato: dice a colpo d'occhio
                      quanto ci si è discostati e in che direzione. */}
                  <span
                    className={cn(
                      "w-12 shrink-0 text-right font-mono text-xs",
                      delta > 0 && "text-emerald-600 dark:text-emerald-400",
                      delta < 0 && "text-rose-600 dark:text-rose-400",
                      delta === 0 && "text-muted-foreground/50",
                    )}
                    title={`Calcolato: ${base}`}
                  >
                    {delta === 0 ? "—" : `${delta > 0 ? "+" : ""}${delta}`}
                  </span>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className={cn("shrink-0", !manuale && "invisible")}
                    onClick={() => ripristina(g.id)}
                    aria-label={`Ripristina il prezzo calcolato per ${g.nome}`}
                    title={`Ripristina il calcolato (${base})`}
                  >
                    <RotateCcw />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {filtrati.length > LIMITE && (
        <p className="text-xs text-muted-foreground">
          Mostrati i primi <span className="font-mono">{LIMITE}</span> di{" "}
          <span className="font-mono">{filtrati.length}</span> per l&apos;ordinamento scelto.
        </p>
      )}
    </div>
  );
}
