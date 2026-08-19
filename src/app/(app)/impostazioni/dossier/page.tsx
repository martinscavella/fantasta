import { getAsteIndex, getDossier, getListone, getListoneIndex } from "@/lib/blob/repository";
import { DossierClient } from "@/components/impostazioni/dossier-client";
import { PageHeader } from "@/components/shared/page-header";
import { StagioneList } from "@/components/shared/stagione-list";

export default async function DossierPage({ searchParams }: PageProps<"/impostazioni/dossier">) {
  const { stagione } = await searchParams;

  if (!stagione) {
    const asteIndex = await getAsteIndex();
    const stagioni = [...new Set((asteIndex?.data.aste ?? []).map((a) => a.stagione))];
    return (
      <StagioneList
        stagioni={stagioni}
        hrefPrefix="/impostazioni/dossier"
        title="Dossier giocatori"
        description="Genera schede giocatore (punti di forza, rischio infortuni, prezzo consigliato) via il ponte manuale con Claude — pochi blocchi copia-incolla, una volta a stagione."
      />
    );
  }

  const stagioneValue = Array.isArray(stagione) ? stagione[0] : stagione;
  const listoneIndex = await getListoneIndex(stagioneValue);

  if (!listoneIndex?.data.current) {
    return (
      <div className="mx-auto max-w-md p-8">
        <p className="text-sm text-muted-foreground">
          Nessun listone importato per la stagione &quot;{stagioneValue}&quot; — importane uno prima da{" "}
          <a href={`/impostazioni/listone?stagione=${stagioneValue}`} className="underline">
            Importa listone
          </a>
          .
        </p>
      </div>
    );
  }

  const [listone, dossier] = await Promise.all([
    getListone(stagioneValue, listoneIndex.data.current),
    getDossier(stagioneValue),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <PageHeader
        title={`Dossier giocatori — ${stagioneValue}`}
        description="I dossier valgono per entrambe le leghe (gli stessi giocatori di Serie A, cambiano solo quotazioni e regole) — vanno generati una volta a stagione."
      />
      <DossierClient
        stagione={stagioneValue}
        giocatori={listone?.data.giocatori ?? []}
        dossierEsistente={dossier?.data.giocatori ?? []}
      />
    </div>
  );
}
