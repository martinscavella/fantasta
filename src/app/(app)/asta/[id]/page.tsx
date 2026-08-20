import { notFound } from "next/navigation";
import {
  getBoard,
  getDossier,
  getListone,
  getSetup,
  getStats,
  getStatsIndex,
  getStrategy,
} from "@/lib/blob/repository";
import { AstaClient } from "@/components/asta/asta-client";

export default async function AstaPage({ params }: PageProps<"/asta/[id]">) {
  const { id } = await params;
  const setup = await getSetup(id);
  if (!setup) notFound();

  const [listone, board, strategy, statsIndex, dossier] = await Promise.all([
    getListone(setup.data.stagione, setup.data.listoneVersionId),
    getBoard(id),
    getStrategy(id),
    getStatsIndex(setup.data.stagione),
    // Alimenta i segnali di rischio della striscia consiglio: se non è mai
    // stato generato dall'hub IA il tracker funziona identico, senza quei motivi.
    getDossier(setup.data.stagione),
  ]);
  const stats = statsIndex?.data.current ? await getStats(setup.data.stagione, statsIndex.data.current) : null;

  return (
    <AstaClient
      setup={setup.data}
      giocatori={listone?.data.giocatori ?? []}
      eventiIniziali={board?.data.events ?? []}
      strategy={strategy?.data ?? null}
      statistiche={stats?.data.giocatori ?? []}
      dossier={dossier?.data.giocatori ?? []}
    />
  );
}
