import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getBoard, getListone, getSetup } from "@/lib/blob/repository";
import { AstaClient } from "@/components/asta/asta-client";

export default async function AstaPage({ params }: PageProps<"/asta/[id]">) {
  if (!(await requireSession())) redirect("/login");

  const { id } = await params;
  const setup = await getSetup(id);
  if (!setup) notFound();

  const [listone, board] = await Promise.all([
    getListone(setup.data.stagione, setup.data.listoneVersionId),
    getBoard(id),
  ]);

  return (
    <AstaClient
      setup={setup.data}
      giocatori={listone?.data.giocatori ?? []}
      eventiIniziali={board?.data.events ?? []}
    />
  );
}
