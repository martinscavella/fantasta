import { notFound } from "next/navigation";
import { getListone, getSetup } from "@/lib/blob/repository";
import { GeneraStrategiaClient } from "@/components/strategia/genera-strategia-client";

export default async function GeneraStrategiaPage({ params }: PageProps<"/strategia/[id]/genera">) {
  const { id } = await params;
  const setup = await getSetup(id);
  if (!setup) notFound();

  const listone = await getListone(setup.data.stagione, setup.data.listoneVersionId);

  return <GeneraStrategiaClient setup={setup.data} giocatori={listone?.data.giocatori ?? []} />;
}
