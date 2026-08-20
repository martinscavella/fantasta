"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown, Columns3, Rows3, SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClubBadge } from "@/components/shared/club-badge";
import { RUOLI, RUOLO_CLASSI, RUOLO_LABEL } from "@/lib/ruoli";
import { cn } from "@/lib/utils";
import { FASCIA_BADGE_VARIANT, type FasciaStandard } from "@/lib/pricing";
import type { Player, PlayerStats } from "@/lib/blob/schemas";

export type RigaListone = Player & {
  fascia: FasciaStandard | null;
  stats: PlayerStats | null;
  // Presente solo nella vista listone di un'asta specifica (§ Tracker
  // d'asta): chi l'ha preso e a che prezzo, per evidenziarlo invece di
  // farlo sparire — sul listone globale è sempre null/assente.
  assegnazione?: { teamNome: string; price: number } | null;
};

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
  columnVisibilityFeature,
  columnSizingFeature,
});

const helper = createColumnHelper<typeof features, RigaListone>();

// I numeri vanno sempre in font-mono e allineati a destra (DESIGN-SYSTEM.md:
// "font-mono — sempre, ovunque appaia un valore numerico"): una classe sola,
// applicata da meta, invece di ripeterla su ogni colonna.
type MetaColonna = { numerica?: boolean };

function celleNumeriche(valore: number | undefined, decimali = 0): string {
  if (valore === undefined) return "—";
  return decimali > 0 ? valore.toFixed(decimali) : String(valore);
}

const colonneDati = helper.columns([
  helper.accessor("nome", {
    header: "Nome",
    size: 240,
    sortFn: "alphanumeric",
    enableHiding: false,
    cell: (ctx) => {
      const assegnazione = ctx.row.original.assegnazione;
      return (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={cn("truncate", assegnazione && "text-muted-foreground")}>{ctx.getValue()}</span>
          {assegnazione && (
            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {assegnazione.teamNome} · <span className="font-mono">{assegnazione.price}</span>
            </span>
          )}
        </span>
      );
    },
  }),
  helper.accessor("squadra", {
    header: "Squadra",
    size: 130,
    sortFn: "alphanumeric",
    cell: (ctx) => {
      const squadra = ctx.getValue();
      return (
        <span className="flex items-center gap-1.5">
          <ClubBadge squadra={squadra} size="xs" />
          <span className="truncate">{squadra}</span>
        </span>
      );
    },
  }),
  helper.accessor("ruolo", {
    header: "R",
    size: 56,
    sortFn: "alphanumeric",
    cell: (ctx) => {
      const ruolo = ctx.getValue();
      return (
        <span className={cn("rounded px-1.5 py-0.5 font-mono text-xs font-semibold", RUOLO_CLASSI[ruolo].badge)}>
          {ruolo}
        </span>
      );
    },
  }),
  helper.accessor("fascia", {
    header: "Fascia",
    size: 120,
    sortFn: "alphanumeric",
    cell: (ctx) => {
      const fascia = ctx.getValue();
      return fascia ? <Badge variant={FASCIA_BADGE_VARIANT[fascia]}>{fascia}</Badge> : null;
    },
  }),
  helper.accessor("quotazioneAttuale", { header: "Qt.A", size: 80, sortFn: "basic", meta: { numerica: true } }),
  helper.accessor("quotazioneIniziale", { header: "Qt.I", size: 80, sortFn: "basic", meta: { numerica: true } }),
  helper.accessor("differenza", {
    header: "Diff.",
    size: 80,
    sortFn: "basic",
    sortUndefined: "last",
    meta: { numerica: true },
    // Il segno è l'informazione: una quotazione in salita e una in discesa
    // devono distinguersi a colpo d'occhio, non leggendo il numero.
    cell: (ctx) => {
      const v = ctx.getValue();
      if (v === undefined) return "—";
      return (
        <span
          className={cn(
            v > 0 && "text-emerald-600 dark:text-emerald-400",
            v < 0 && "text-rose-600 dark:text-rose-400",
          )}
        >
          {v > 0 ? "+" : ""}
          {v}
        </span>
      );
    },
  }),
  helper.accessor("fvm", { header: "FVM", size: 80, sortFn: "basic", sortUndefined: "last", meta: { numerica: true } }),
  helper.accessor("fvmMantra", {
    header: "FVM M",
    size: 90,
    sortFn: "basic",
    sortUndefined: "last",
    meta: { numerica: true },
  }),
  helper.accessor((row) => row.stats?.mediaVoto, {
    id: "mediaVoto",
    header: "MV",
    size: 70,
    sortFn: "basic",
    sortUndefined: "last",
    meta: { numerica: true },
    cell: (ctx) => celleNumeriche(ctx.getValue(), 2),
  }),
  helper.accessor((row) => row.stats?.fantamedia, {
    id: "fantamedia",
    header: "FM",
    size: 70,
    sortFn: "basic",
    sortUndefined: "last",
    meta: { numerica: true },
    cell: (ctx) => celleNumeriche(ctx.getValue(), 2),
  }),
  helper.accessor((row) => row.stats?.presenze, {
    id: "presenze",
    header: "Pres.",
    size: 70,
    sortFn: "basic",
    sortUndefined: "last",
    meta: { numerica: true },
    cell: (ctx) => celleNumeriche(ctx.getValue()),
  }),
  helper.accessor((row) => row.stats?.gol, {
    id: "gol",
    header: "Gol",
    size: 60,
    sortFn: "basic",
    sortUndefined: "last",
    meta: { numerica: true },
    cell: (ctx) => celleNumeriche(ctx.getValue()),
  }),
  helper.accessor((row) => row.stats?.assist, {
    id: "assist",
    header: "Ass.",
    size: 60,
    sortFn: "basic",
    sortUndefined: "last",
    meta: { numerica: true },
    cell: (ctx) => celleNumeriche(ctx.getValue()),
  }),
]);

const FASCE: FasciaStandard[] = ["Top", "Semitop", "Terza fascia", "Scommesse"];
const TUTTI = "_tutti";
export const MAX_CONFRONTO = 4;

type Densita = "compatta" | "normale";
const ALTEZZA_RIGA: Record<Densita, number> = { compatta: 32, normale: 40 };
const CHIAVE_DENSITA = "fantasta:listone:densita";

// Larghezza delle due colonne bloccate a sinistra (checkbox confronto + nome):
// scorrendo in orizzontale si perdeva di vista di chi fosse la riga.
const LARGHEZZA_CONFRONTO = 32;

export function ListoneDataTable({
  giocatori,
  selezionati,
  onToggleSeleziona,
  onApriScheda,
}: {
  giocatori: RigaListone[];
  selezionati: Set<number>;
  onToggleSeleziona: (id: number) => void;
  onApriScheda: (id: number) => void;
}) {
  const [ricerca, setRicerca] = useState("");
  const [ruolo, setRuolo] = useState<string>(TUTTI);
  const [fascia, setFascia] = useState<string>(TUTTI);
  const [nascondiAssegnati, setNascondiAssegnati] = useState(false);
  const [densita, setDensita] = useState<Densita>("normale");
  const haAssegnazioni = useMemo(() => giocatori.some((g) => g.assegnazione), [giocatori]);

  // La preferenza di densità si legge in un effetto, non durante il render:
  // localStorage non esiste sul server e ESLint vieta setState sincrono negli
  // effetti solo quando dipende da props/stato — qui è un caricamento una tantum.
  useEffect(() => {
    const salvata = window.localStorage.getItem(CHIAVE_DENSITA);
    if (salvata === "compatta" || salvata === "normale") setDensita(salvata);
  }, []);

  function cambiaDensita(prossima: Densita) {
    setDensita(prossima);
    window.localStorage.setItem(CHIAVE_DENSITA, prossima);
  }

  const columns = useMemo(
    () => [
      helper.display({
        id: "confronto",
        header: "",
        size: LARGHEZZA_CONFRONTO,
        enableHiding: false,
        enableSorting: false,
        cell: (ctx) => {
          const id = ctx.row.original.id;
          const selezionato = selezionati.has(id);
          return (
            <input
              type="checkbox"
              checked={selezionato}
              disabled={!selezionato && selezionati.size >= MAX_CONFRONTO}
              onClick={(e) => e.stopPropagation()}
              onChange={() => onToggleSeleziona(id)}
              title="Aggiungi al confronto"
              className="size-4 rounded border-input accent-primary"
            />
          );
        },
      }),
      ...colonneDati,
    ],
    [selezionati, onToggleSeleziona],
  );

  const data = useMemo(() => {
    const query = ricerca.trim().toLowerCase();
    return giocatori.filter((g) => {
      if (ruolo !== TUTTI && g.ruolo !== ruolo) return false;
      if (fascia !== TUTTI && g.fascia !== fascia) return false;
      if (nascondiAssegnati && g.assegnazione) return false;
      if (query && !g.nome.toLowerCase().includes(query) && !g.squadra.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  }, [giocatori, ricerca, ruolo, fascia, nascondiAssegnati]);

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => String(row.id),
    enableMultiSort: true,
    enableSortingRemoval: false,
    initialState: { sorting: [{ id: "nome", desc: false }] },
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const altezzaRiga = ALTEZZA_RIGA[densita];
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => altezzaRiga,
    getItemKey: (index) => rows[index].id,
    overscan: 10,
  });

  const colonneNascondibili = table.getAllLeafColumns().filter((c) => c.getCanHide());
  const nascoste = colonneNascondibili.filter((c) => !c.getIsVisible()).length;

  // Offset sinistro delle colonne bloccate: la checkbox parte da 0, il nome
  // subito dopo. Serve a entrambe le righe (intestazione e corpo).
  function stickyProps(columnId: string, indice: number): { className: string; style: React.CSSProperties } | null {
    if (columnId === "confronto") return { className: "sticky left-0 z-20", style: { left: 0 } };
    if (columnId === "nome" && indice === 1) {
      return { className: "sticky z-20", style: { left: LARGHEZZA_CONFRONTO } };
    }
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Barra filtri: una riga sola, stessi gesti del tracker per il ruolo. */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-2.5 shadow-sm">
        <Input
          placeholder="Cerca nome o squadra…"
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          className="w-52"
        />

        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setRuolo(TUTTI)}
            className={cn(
              "flex h-8 items-center rounded-full border px-2.5 text-xs font-medium transition-colors",
              ruolo === TUTTI
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
              title={RUOLO_LABEL[r]}
              aria-label={RUOLO_LABEL[r]}
              onClick={() => setRuolo(r)}
              className={cn(
                "flex size-8 items-center justify-center rounded-full border font-mono text-xs font-semibold transition-colors active:scale-90",
                ruolo === r ? cn(RUOLO_CLASSI[r].solid, "border-transparent") : cn("border-border", RUOLO_CLASSI[r].badge),
              )}
            >
              {r}
            </button>
          ))}
        </div>

        <Select
          value={fascia}
          onValueChange={(v) => setFascia(v ?? TUTTI)}
          items={{ [TUTTI]: "Tutte le fasce", ...Object.fromEntries(FASCE.map((f) => [f, f])) }}
        >
          <SelectTrigger size="sm" className="w-36">
            <SelectValue placeholder="Fascia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TUTTI}>Tutte le fasce</SelectItem>
            {FASCE.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {haAssegnazioni && (
          <label className="flex h-8 items-center gap-1.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={nascondiAssegnati}
              onChange={(e) => setNascondiAssegnati(e.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            Nascondi assegnati
          </label>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">{data.length}</span> giocatori
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => cambiaDensita(densita === "compatta" ? "normale" : "compatta")}
            title={densita === "compatta" ? "Righe normali" : "Righe compatte"}
          >
            <Rows3 />
            {densita === "compatta" ? "Compatta" : "Normale"}
          </Button>

          {/* Le 14 checkbox di colonna occupavano una riga intera sopra i dati:
              qui stanno dentro un popover e il conteggio dice cosa è nascosto. */}
          <Popover>
            <PopoverTrigger
              render={
                <Button type="button" variant="outline" size="sm">
                  <Columns3 />
                  Colonne
                  {nascoste > 0 && <Badge variant="secondary">{nascoste} nascoste</Badge>}
                </Button>
              }
            />
            <PopoverContent align="end" className="w-52">
              <div className="flex flex-col">
                {colonneNascondibili.map((column) => (
                  <label
                    key={column.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={column.getIsVisible()}
                      onChange={column.getToggleVisibilityHandler()}
                      className="size-4 rounded border-input accent-primary"
                    />
                    {String(column.columnDef.header)}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="max-h-[70vh] overflow-auto rounded-2xl border border-border bg-card shadow-sm"
      >
        <div style={{ width: table.getTotalSize() }}>
          <div className="sticky top-0 z-30 flex border-b border-border bg-muted/95 backdrop-blur-sm">
            {table.getFlatHeaders().map((header, indice) => {
              const sticky = stickyProps(header.column.id, indice);
              const ordinata = header.column.getIsSorted() as "asc" | "desc" | false;
              // -1 quando la colonna non partecipa all'ordinamento; >0 solo se
              // ci sono piu' colonne ordinate insieme, ed e' li' che l'indice serve.
              const posizione = header.column.getSortIndex();
              const numerica = (header.column.columnDef.meta as MetaColonna | undefined)?.numerica;

              return (
                <div
                  key={header.id}
                  style={{ width: header.getSize(), ...sticky?.style }}
                  className={cn(
                    "group/header relative flex shrink-0 items-center gap-1 px-2 py-2 text-sm font-semibold select-none",
                    numerica && "justify-end",
                    header.column.getCanSort() && "cursor-pointer hover:text-primary",
                    sticky?.className,
                    sticky && "bg-muted/95",
                  )}
                  onClick={header.column.getToggleSortingHandler()}
                  title={header.column.getCanSort() ? "Clicca per ordinare · Shift+clic per ordinamento multiplo" : undefined}
                >
                  <table.FlexRender header={header} />
                  {header.column.getCanSort() && (
                    <span className="flex shrink-0 items-center">
                      {ordinata === "asc" ? (
                        <ChevronUp className="size-3.5" />
                      ) : ordinata === "desc" ? (
                        <ChevronDown className="size-3.5" />
                      ) : (
                        <ChevronsUpDown className="size-3.5 text-muted-foreground/40 opacity-0 transition-opacity group-hover/header:opacity-100" />
                      )}
                      {/* Con più colonne ordinate insieme, l'indice dice quale
                          conta per prima: enableMultiSort era già attivo ma invisibile. */}
                      {posizione > 0 && (
                        <span className="font-mono text-[10px] text-muted-foreground">{posizione + 1}</span>
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
              <SearchX className="size-6" />
              Nessun giocatore con questi filtri.
            </div>
          ) : (
            <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {virtualizer.getVirtualItems().map((item) => {
                const row = rows[item.index];
                const assegnato = Boolean(row.original.assegnazione);
                return (
                  <div
                    key={row.id}
                    data-index={item.index}
                    className={cn(
                      "group/riga flex cursor-pointer border-b border-border/60 transition-colors",
                      item.index % 2 === 1 && "bg-muted/25",
                      "hover:bg-accent/50",
                      // Bordo accento invece di opacity sull'intera riga: a fine
                      // asta metà tabella è assegnata, e sbiadirla la rende illeggibile.
                      assegnato && "border-l-2 border-l-muted-foreground/40",
                    )}
                    onClick={() => onApriScheda(row.original.id)}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: altezzaRiga,
                      transform: `translateY(${item.start}px)`,
                    }}
                  >
                    {row.getVisibleCells().map((cell, indice) => {
                      const sticky = stickyProps(cell.column.id, indice);
                      const numerica = (cell.column.columnDef.meta as MetaColonna | undefined)?.numerica;
                      return (
                        <div
                          key={cell.id}
                          style={{ width: cell.column.getSize(), ...sticky?.style }}
                          className={cn(
                            "flex shrink-0 items-center px-2 text-sm",
                            numerica && "justify-end font-mono",
                            sticky?.className,
                            // Le celle bloccate hanno bisogno di uno sfondo proprio,
                            // o il contenuto che scorre sotto resta visibile.
                            sticky && (item.index % 2 === 1 ? "bg-card" : "bg-card"),
                            sticky && "group-hover/riga:bg-accent/50",
                          )}
                        >
                          <table.FlexRender cell={cell} />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Clicca una riga per la scheda giocatore · casella a sinistra per il confronto (max {MAX_CONFRONTO}) ·
        Shift+clic su un&apos;intestazione per ordinare su più colonne.
      </p>
    </div>
  );
}
