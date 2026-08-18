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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Player, Ruolo } from "@/lib/blob/schemas";
import type { FasciaStandard } from "@/lib/pricing";

export type RigaListone = Player & { fascia: FasciaStandard | null };

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
  columnVisibilityFeature,
  columnSizingFeature,
});

const helper = createColumnHelper<typeof features, RigaListone>();

const FASCIA_VARIANT: Record<FasciaStandard, "default" | "secondary" | "outline"> = {
  Top: "default",
  Semitop: "secondary",
  "Terza fascia": "outline",
  Scommesse: "outline",
};

const columns = helper.columns([
  helper.accessor("nome", { header: "Nome", size: 200, sortFn: "alphanumeric" }),
  helper.accessor("squadra", { header: "Squadra", size: 120, sortFn: "alphanumeric" }),
  helper.accessor("ruolo", { header: "R", size: 56, sortFn: "alphanumeric" }),
  helper.accessor("fascia", {
    header: "Fascia",
    size: 120,
    sortFn: "alphanumeric",
    cell: (ctx) => {
      const fascia = ctx.getValue();
      return fascia ? <Badge variant={FASCIA_VARIANT[fascia]}>{fascia}</Badge> : null;
    },
  }),
  helper.accessor("quotazioneAttuale", { header: "Qt.A", size: 80, sortFn: "basic" }),
  helper.accessor("quotazioneIniziale", { header: "Qt.I", size: 80, sortFn: "basic" }),
  helper.accessor("differenza", { header: "Diff.", size: 80, sortFn: "basic", sortUndefined: "last" }),
  helper.accessor("fvm", { header: "FVM", size: 80, sortFn: "basic", sortUndefined: "last" }),
  helper.accessor("fvmMantra", { header: "FVM M", size: 90, sortFn: "basic", sortUndefined: "last" }),
]);

const RUOLI: Ruolo[] = ["P", "D", "C", "A"];
const FASCE: FasciaStandard[] = ["Top", "Semitop", "Terza fascia", "Scommesse"];
const TUTTI = "_tutti";
const ROW_HEIGHT = 36;

export function ListoneDataTable({ giocatori }: { giocatori: RigaListone[] }) {
  const [ricerca, setRicerca] = useState("");
  const [ruolo, setRuolo] = useState<string>(TUTTI);
  const [fascia, setFascia] = useState<string>(TUTTI);

  const data = useMemo(() => {
    const query = ricerca.trim().toLowerCase();
    return giocatori.filter((g) => {
      if (ruolo !== TUTTI && g.ruolo !== ruolo) return false;
      if (fascia !== TUTTI && g.fascia !== fascia) return false;
      if (query && !g.nome.toLowerCase().includes(query) && !g.squadra.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  }, [giocatori, ricerca, ruolo, fascia]);

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => String(row.id),
    enableMultiSort: true,
    enableSortingRemoval: false,
    initialState: { sorting: [{ id: "quotazioneAttuale", desc: true }] },
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
      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Cerca nome o squadra…"
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          className="w-56"
        />
        <Select value={ruolo} onValueChange={(v) => setRuolo(v ?? TUTTI)}>
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
        <Select value={fascia} onValueChange={(v) => setFascia(v ?? TUTTI)}>
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
        <span className="text-sm text-muted-foreground">{data.length} giocatori</span>
      </div>

      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        {colonneVisibili.map((column) => (
          <label key={column.id} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={column.getIsVisible()}
              onChange={column.getToggleVisibilityHandler()}
            />
            {String(column.columnDef.header)}
          </label>
        ))}
      </div>

      <div ref={scrollRef} className="max-h-[70vh] overflow-auto rounded-xl border border-border">
        <div style={{ width: table.getTotalSize() }}>
          <div className="sticky top-0 z-10 flex border-b border-border bg-background">
            {table.getFlatHeaders().map((header) => (
              <div
                key={header.id}
                style={{ width: header.getSize() }}
                className="flex shrink-0 cursor-pointer items-center gap-1 px-2 py-2 text-left text-sm font-medium select-none"
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
                  className="flex border-b border-border/60 hover:bg-muted/50"
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
