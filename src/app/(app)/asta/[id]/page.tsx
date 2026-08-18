import { notFound } from "next/navigation";
import { getBoard, getListone, getSetup, getStrategy } from "@/lib/blob/repository";
import { AstaClient } from "@/components/asta/asta-client";

export default async function AstaPage({ params }: PageProps<"/asta/[id]">) {
  const { id } = await params;
  const setup = await getSetup(id);
  if (!setup) notFound();

  const [listone, board, strategy] = await Promise.all([
    getListone(setup.data.stagione, setup.data.listoneVersionId),
    getBoard(id),
    getStrategy(id),
  ]);

  return (
    <AstaClient
      setup={setup.data}
      giocatori={listone?.data.giocatori ?? []}
      eventiIniziali={board?.data.events ?? []}
      prezziMassimi={strategy?.data.prezziMassimi ?? []}
    />
  );
}
