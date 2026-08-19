"use client";

import { useMemo, useRef, useState } from "react";
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
import { Columns3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClubBadge } from "@/components/shared/club-badge";
import { RUOLO_CLASSI } from "@/lib/ruoli";
import { cn } from "@/lib/utils";
import { FASCIA_BADGE_VARIANT, type FasciaStandard } from "@/lib/pricing";
import type { Player, PlayerStats, Ruolo } from "@/lib/blob/schemas";

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

const colonneDati = helper.columns([
  helper.accessor("nome", {
    header: "Nome",
    size: 240,
    sortFn: "alphanumeric",
    cell: (ctx) => {
      const assegnazione = ctx.row.original.assegnazione;
      return (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={cn("truncate", assegnazione && "text-muted-foreground line-through")}>{ctx.getValue()}</span>
          {assegnazione && (
            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground no-underline">
              {assegnazione.teamNome} · {assegnazione.price}
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
  helper.accessor("quotazioneAttuale", { header: "Qt.A", size: 80, sortFn: "basic" }),
  helper.accessor("quotazioneIniziale", { header: "Qt.I", size: 80, sortFn: "basic" }),
  helper.accessor("differenza", { header: "Diff.", size: 80, sortFn: "basic", sortUndefined: "last" }),
  helper.accessor("fvm", { header: "FVM", size: 80, sortFn: "basic", sortUndefined: "last" }),
  helper.accessor("fvmMantra", { header: "FVM M", size: 90, sortFn: "basic", sortUndefined: "last" }),
  helper.accessor((row) => row.stats?.mediaVoto, {
    id: "mediaVoto",
    header: "MV",
    size: 70,
    sortFn: "basic",
    sortUndefined: "last",
    cell: (ctx) => ctx.getValue()?.toFixed(2) ?? "—",
  }),
  helper.accessor((row) => row.stats?.fantamedia, {
    id: "fantamedia",
    header: "FM",
    size: 70,
    sortFn: "basic",
    sortUndefined: "last",
    cell: (ctx) => ctx.getValue()?.toFixed(2) ?? "—",
  }),
  helper.accessor((row) => row.stats?.presenze, {
    id: "presenze",
    header: "Pres.",
    size: 70,
    sortFn: "basic",
    sortUndefined: "last",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor((row) => row.stats?.gol, {
    id: "gol",
    header: "Gol",
    size: 60,
    sortFn: "basic",
    sortUndefined: "last",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
  helper.accessor((row) => row.stats?.assist, {
    id: "assist",
    header: "Ass.",
    size: 60,
    sortFn: "basic",
    sortUndefined: "last",
    cell: (ctx) => ctx.getValue() ?? "—",
  }),
]);

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];
const FASCE: FasciaStandard[] = ["Top", "Semitop", "Terza fascia", "Scommesse"];
const TUTTI = "_tutti";
const ROW_HEIGHT = 36;
export const MAX_CONFRONTO = 4;

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
  const haAssegnazioni = useMemo(() => giocatori.some((g) => g.assegnazione), [giocatori]);

  const columns = useMemo(
    () => [
      helper.display({
        id: "confronto",
        header: "",
        size: 32,
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
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: (index) => rows[index].id,
    overscan: 10,
  });

  const colonneVisibili = table.getAllLeafColumns().filter((c) => c.getCanHide());

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
        <Input
          placeholder="Cerca nome o squadra…"
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          className="w-56"
        />
        <Select
          value={ruolo}
          onValueChange={(v) => setRuolo(v ?? TUTTI)}
          items={{ [TUTTI]: "Tutti i ruoli", ...Object.fromEntries(RUOLI.map((r) => [r, r])) }}
        >
          <SelectTrigger size="sm">
            <SelectValue placeholder="Ruolo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TUTTI}>Tutti i ruoli</SelectItem>
            {RUOLI.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={fascia}
          onValueChange={(v) => setFascia(v ?? TUTTI)}
          items={{ [TUTTI]: "Tutte le fasce", ...Object.fromEntries(FASCE.map((f) => [f, f])) }}
        >
          <SelectTrigger size="sm">
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
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={nascondiAssegnati}
              onChange={(e) => setNascondiAssegnati(e.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            Nascondi assegnati
          </label>
        )}
        <span className="text-sm text-muted-foreground">{data.length} giocatori</span>
      </div>

      <p className="text-xs text-muted-foreground">
        Clicca una riga per aprire la scheda giocatore · spunta la casella a sinistra per aggiungerlo al confronto (fino a {MAX_CONFRONTO}).
      </p>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <Columns3 className="size-3.5" />
          Colonne
        </span>
        {colonneVisibili.map((column) => (
          <label key={column.id} className="flex items-center gap-1.5">
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

      <div ref={scrollRef} className="max-h-[70vh] overflow-auto rounded-2xl border border-border bg-card shadow-sm">
        <div style={{ width: table.getTotalSize() }}>
          <div className="sticky top-0 z-10 flex border-b border-border bg-muted/60 backdrop-blur-sm">
            {table.getFlatHeaders().map((header) => (
              <div
                key={header.id}
                style={{ width: header.getSize() }}
                className="flex shrink-0 cursor-pointer items-center gap-1 px-2 py-2 text-left text-sm font-semibold select-none hover:text-primary"
                onClick={header.column.getToggleSortingHandler()}
              >
                <table.FlexRender header={header} />
                {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? ""}
              </div>
            ))}
          </div>
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((item) => {
              const row = rows[item.index];
              return (
                <div
                  key={row.id}
                  data-index={item.index}
                  className={cn(
                    "flex cursor-pointer border-b border-border/60 transition-colors hover:bg-accent/40",
                    row.original.assegnazione && "opacity-50 hover:opacity-100",
                  )}
                  onClick={() => onApriScheda(row.original.id)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: ROW_HEIGHT,
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="flex shrink-0 items-center px-2 text-sm"
                    >
                      <table.FlexRender cell={cell} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
