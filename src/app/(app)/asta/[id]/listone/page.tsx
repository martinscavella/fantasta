import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getBoard, getListone, getSetup, getStats, getStatsIndex } from "@/lib/blob/repository";
import { reduceBoard } from "@/lib/asta/reducer";
import { costruisciRose } from "@/lib/asta/derive";
import { fasciaStandard } from "@/lib/pricing";
import { AstaSubNav } from "@/components/asta/asta-sub-nav";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { ListoneClient } from "@/components/listone/listone-client";
import type { RigaListone } from "@/components/listone/data-table";
import type { Ruolo } from "@/lib/blob/schemas";

export default async function AstaListonePage({ params }: PageProps<"/asta/[id]/listone">) {
  const { id } = await params;
  const setup = await getSetup(id);
  if (!setup) notFound();

  const [listone, board, statsIndex] = await Promise.all([
    getListone(setup.data.stagione, setup.data.listoneVersionId),
    getBoard(id),
    getStatsIndex(setup.data.stagione),
  ]);
  const stats = statsIndex?.data.current ? await getStats(setup.data.stagione, statsIndex.data.current) : null;
  const statsPerPlayerId = new Map(
    (stats?.data.giocatori ?? []).filter((s) => s.playerId !== null).map((s) => [s.playerId!, s]),
  );

  const giocatori = listone?.data.giocatori ?? [];
  const ruoloPerGiocatore = Object.fromEntries(giocatori.map((g) => [g.id, g.ruolo])) as Record<number, Ruolo>;
  const astaState = reduceBoard(board?.data.events ?? [], setup.data, ruoloPerGiocatore);
  const rose = costruisciRose(astaState, giocatori, setup.data.squadre);

  // Chi ha preso ciascun giocatore in QUESTA asta, per evidenziarlo nel
  // listone invece di farlo sparire (§ Tracker d'asta nel piano).
  const assegnazionePerId = new Map<number, { teamNome: string; price: number }>();
  for (const squadra of setup.data.squadre) {
    for (const riga of rose[squadra.id] ?? []) {
      assegnazionePerId.set(riga.player.id, { teamNome: squadra.nome, price: riga.price });
    }
  }

  const righe: RigaListone[] = giocatori.map((g) => ({
    ...g,
    fascia: fasciaStandard(g.quotazioneAttuale, setup.data.creditiBase),
    stats: statsPerPlayerId.get(g.id) ?? null,
    assegnazione: assegnazionePerId.get(g.id) ?? null,
  }));

  return (
    <div className="flex flex-col gap-5 p-6 md:p-8">
      <AstaSubNav astaId={setup.data.id} nome={setup.data.nome} />
      <PageHeader
        title="Listone"
        description="I giocatori già assegnati in questa asta restano in elenco, sbarrati, con squadra e prezzo — così sai sempre chi è ancora libero."
        actions={
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/asta/${setup.data.id}/analisi-live`} />}>
            <Sparkles />
            Analisi live
          </Button>
        }
      />
      <ListoneClient giocatori={righe} />
    </div>
  );
}
