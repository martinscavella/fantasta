import { notFound } from "next/navigation";
import { getSetup } from "@/lib/blob/repository";
import { ImpostazioniAstaClient } from "@/components/asta/impostazioni-asta-client";

export default async function ImpostazioniAstaPage({ params }: PageProps<"/asta/[id]/impostazioni">) {
  const { id } = await params;
  const setup = await getSetup(id);
  if (!setup) notFound();

  return <ImpostazioniAstaClient setup={setup.data} />;
}
