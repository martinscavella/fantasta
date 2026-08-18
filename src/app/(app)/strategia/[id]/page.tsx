import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getListone, getSetup, getStrategy } from "@/lib/blob/repository";
import { FASCE_STANDARD } from "@/lib/pricing";
import { applicaTemplate } from "@/lib/strategia/template";
import { StrategiaClient } from "@/components/strategia/strategia-client";
import type { StrategyDoc } from "@/lib/blob/schemas";

export default async function StrategiaPage({ params }: PageProps<"/strategia/[id]">) {
  if (!(await requireSession())) redirect("/login");

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
      fasce: FASCE_STANDARD,
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
