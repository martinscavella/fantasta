import { notFound } from "next/navigation";
import { AnalisiLiveClient } from "@/components/asta/analisi-live-client";
import { getAnalisiLive, getListone, getSetup } from "@/lib/blob/repository";

export default async function AnalisiLivePage({ params }: PageProps<"/asta/[id]/analisi-live">) {
  const { id } = await params;
  const setup = await getSetup(id);
  if (!setup) notFound();

  const [listone, salvata] = await Promise.all([
    getListone(setup.data.stagione, setup.data.listoneVersionId),
    getAnalisiLive(id),
  ]);

  const nomiPerId = Object.fromEntries((listone?.data.giocatori ?? []).map((g) => [g.id, g.nome]));

  return (
    <AnalisiLiveClient
      astaId={setup.data.id}
      nome={setup.data.nome}
      analisiIniziale={salvata?.data.analisi ?? null}
      faseIniziale={salvata?.data.fase ?? "in-corso"}
      nomiPerIdIniziale={nomiPerId}
    />
  );
}
