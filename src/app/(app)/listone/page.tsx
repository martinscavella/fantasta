import Link from "next/link";
import { getAsteIndex, getListone, getListoneIndex, getStats, getStatsIndex } from "@/lib/blob/repository";
import { fasciaStandard } from "@/lib/pricing";
import { ListoneClient } from "@/components/listone/listone-client";
import { PageHeader } from "@/components/shared/page-header";
import { StagioneGate } from "@/components/shared/stagione-gate";
import type { RigaListone } from "@/components/listone/data-table";

export default async function ListonePage({ searchParams }: PageProps<"/listone">) {
  const { stagione } = await searchParams;

  if (!stagione) {
    const asteIndex = await getAsteIndex();
    const stagioni = [...new Set((asteIndex?.data.aste ?? []).map((a) => a.stagione))];
    return (
      <StagioneGate
        stagioni={stagioni}
        title="Listone"
        description="Anagrafica, quotazioni e statistiche dei giocatori per stagione, fuori dal contesto di una singola asta."
      />
    );
  }

  const stagioneValue = Array.isArray(stagione) ? stagione[0] : stagione;
  const index = await getListoneIndex(stagioneValue);

  if (!index?.data.current) {
    return (
      <div className="mx-auto max-w-md p-8">
        <p className="text-sm text-muted-foreground">
          Nessun listone importato per la stagione &quot;{stagioneValue}&quot;.{" "}
          <Link href={`/impostazioni/listone?stagione=${stagioneValue}`} className="underline">
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
    <div className="flex flex-col gap-5 p-6 md:p-8">
      <PageHeader title={`Listone ${stagioneValue}`} description="Tutti i giocatori della stagione, filtrabili e ordinabili — non legato a una singola asta." />
      <ListoneClient giocatori={giocatori} />
    </div>
  );
}
