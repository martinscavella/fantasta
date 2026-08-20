import { notFound } from "next/navigation";
import {
  getAnalisiLive,
  getBoard,
  getDebrief,
  getDossier,
  getListone,
  getSetup,
  getStrategy,
} from "@/lib/blob/repository";
import { reduceBoard } from "@/lib/asta/reducer";
import { costruisciRose } from "@/lib/asta/derive";
import { AiHubClient } from "@/components/ai/ai-hub-client";
import type { Ruolo } from "@/lib/blob/schemas";

// Le quattro funzioni del Ponte IA in una pagina sola. Il tab Dossier lavora
// su setup.stagione: i dossier restano per stagione e condivisi tra le leghe
// (§ Dossier giocatori nel PLAN.md), ci si arriva da dentro un'asta.
export default async function AiHubPage({ params }: PageProps<"/asta/[id]/ai">) {
  const { id } = await params;
  const setup = await getSetup(id);
  if (!setup) notFound();

  const [listone, strategy, dossier, analisi, board, debrief] = await Promise.all([
    getListone(setup.data.stagione, setup.data.listoneVersionId),
    getStrategy(id),
    getDossier(setup.data.stagione),
    getAnalisiLive(id),
    getBoard(id),
    getDebrief(id),
  ]);

  const giocatori = listone?.data.giocatori ?? [];
  const ruoloPerGiocatore = Object.fromEntries(giocatori.map((g) => [g.id, g.ruolo])) as Record<number, Ruolo>;
  const astaState = reduceBoard(board?.data.events ?? [], setup.data, ruoloPerGiocatore);
  const rose = costruisciRose(astaState, giocatori, setup.data.squadre);

  return (
    <AiHubClient
      setup={setup.data}
      giocatori={giocatori}
      strategy={strategy?.data ?? null}
      dossierEsistente={dossier?.data.giocatori ?? []}
      analisiIniziale={analisi?.data.analisi ?? null}
      faseIniziale={analisi?.data.fase ?? "in-corso"}
      nomiPerId={Object.fromEntries(giocatori.map((g) => [g.id, g.nome]))}
      rosaMia={rose[setup.data.miaSquadraId] ?? []}
      debriefIniziale={debrief?.data.testo ?? ""}
    />
  );
}
