import { notFound } from "next/navigation";
import { getBoard, getDebrief, getListone, getSetup, getStrategy } from "@/lib/blob/repository";
import { reduceBoard } from "@/lib/asta/reducer";
import { costruisciRose, derivaSquadre } from "@/lib/asta/derive";
import { RiepilogoClient } from "@/components/riepilogo/riepilogo-client";
import type { Ruolo } from "@/lib/blob/schemas";

export default async function RiepilogoPage({ params }: PageProps<"/riepilogo/[id]">) {
  const { id } = await params;
  const setup = await getSetup(id);
  if (!setup) notFound();

  const [listone, board, strategy, debrief] = await Promise.all([
    getListone(setup.data.stagione, setup.data.listoneVersionId),
    getBoard(id),
    getStrategy(id),
    getDebrief(id),
  ]);

  const giocatori = listone?.data.giocatori ?? [];
  const eventi = board?.data.events ?? [];
  const ruoloPerGiocatore = Object.fromEntries(giocatori.map((g) => [g.id, g.ruolo])) as Record<number, Ruolo>;

  const astaState = reduceBoard(eventi, setup.data, ruoloPerGiocatore);
  const squadreDerivate = derivaSquadre(astaState, setup.data, giocatori);
  const rose = costruisciRose(astaState, giocatori, setup.data.squadre);

  return (
    <RiepilogoClient
      setup={setup.data}
      squadreDerivate={squadreDerivate}
      rose={rose}
      strategy={strategy?.data ?? null}
      debriefIniziale={debrief?.data.testo ?? ""}
    />
  );
}
