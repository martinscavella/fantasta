import { notFound } from "next/navigation";
import { getListone, getSetup, getStrategy } from "@/lib/blob/repository";
import { fasceStandard } from "@/lib/pricing";
import { applicaTemplate } from "@/lib/strategia/template";
import { StrategiaClient } from "@/components/strategia/strategia-client";
import type { StrategyDoc } from "@/lib/blob/schemas";

export default async function StrategiaPage({ params }: PageProps<"/asta/[id]/strategia">) {
  const { id } = await params;
  const setup = await getSetup(id);
  if (!setup) notFound();

  const [listone, strategyDoc] = await Promise.all([
    getListone(setup.data.stagione, setup.data.listoneVersionId),
    getStrategy(id),
  ]);

  const strategyIniziale: StrategyDoc =
    strategyDoc?.data ?? {
      astaId: id,
      fasce: fasceStandard(setup.data.creditiBase),
      budgetReparto: applicaTemplate("budget-diffuso", setup.data.creditiBase),
      slotObiettivi: [],
      prezziMassimi: [],
      tettoSpesaEuro: null,
      template: null,
      sintesiIA: null,
      updatedAt: 0,
    };

  return (
    <StrategiaClient
      setup={setup.data}
      giocatori={listone?.data.giocatori ?? []}
      strategyIniziale={strategyIniziale}
    />
  );
}
