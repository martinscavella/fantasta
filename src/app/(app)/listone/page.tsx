import Link from "next/link";
import { getListone, getListoneIndex, getStats, getStatsIndex } from "@/lib/blob/repository";
import { fasciaStandard } from "@/lib/pricing";
import { ListoneClient } from "@/components/listone/listone-client";
import type { RigaListone } from "@/components/listone/data-table";

export default async function ListonePage({ searchParams }: PageProps<"/listone">) {
  const { stagione } = await searchParams;

  if (!stagione) {
    return (
      <div className="mx-auto max-w-md p-8">
        <h1 className="mb-4 text-xl font-semibold">Listone</h1>
        <form className="flex flex-col gap-3">
          <label className="text-sm text-muted-foreground" htmlFor="stagione">
            Stagione
          </label>
          <input
            id="stagione"
            name="stagione"
            placeholder="es. 2026-27"
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          />
          <button type="submit" className="h-8 rounded-lg bg-primary text-sm text-primary-foreground">
            Apri
          </button>
        </form>
      </div>
    );
  }

  const stagioneValue = Array.isArray(stagione) ? stagione[0] : stagione;
  const index = await getListoneIndex(stagioneValue);

  if (!index?.data.current) {
    return (
      <div className="mx-auto max-w-md p-8">
        <p className="text-sm text-muted-foreground">
          Nessun listone importato per la stagione &quot;{stagioneValue}&quot;.{" "}
          <Link href="/impostazioni/listone" className="underline">
            Importane uno
          </Link>
          .
        </p>
      </div>
    );
  }

  const [listone, statsIndex] = await Promise.all([
    getListone(stagioneValue, index.data.current),
    getStatsIndex(stagioneValue),
  ]);
  const stats = statsIndex?.data.current ? await getStats(stagioneValue, statsIndex.data.current) : null;

  // Un giocatore può avere più righe di stats risolte alla stessa playerId
  // solo se più fonti la abbinano allo stesso id; qui basta l'ultima vinta —
  // non c'è ancora un merge multi-fonte (§ Scraping statistiche, fuori scope Fase 8).
  const statsPerPlayerId = new Map((stats?.data.giocatori ?? []).filter((s) => s.playerId !== null).map((s) => [s.playerId!, s]));

  const giocatori: RigaListone[] = (listone?.data.giocatori ?? []).map((g) => ({
    ...g,
    fascia: fasciaStandard(g.quotazioneAttuale),
    stats: statsPerPlayerId.get(g.id) ?? null,
  }));

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Listone {stagioneValue}</h1>
      <ListoneClient giocatori={giocatori} />
    </div>
  );
}
