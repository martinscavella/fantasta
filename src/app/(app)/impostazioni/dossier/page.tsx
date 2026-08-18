import { getDossier, getListone, getListoneIndex } from "@/lib/blob/repository";
import { DossierClient } from "@/components/impostazioni/dossier-client";

export default async function DossierPage({ searchParams }: PageProps<"/impostazioni/dossier">) {
  const { stagione } = await searchParams;

  if (!stagione) {
    return (
      <div className="mx-auto max-w-md p-8">
        <h1 className="mb-4 text-xl font-semibold">Dossier giocatori</h1>
        <form className="flex flex-col gap-3">
          <label className="text-sm text-muted-foreground" htmlFor="stagione">
            Stagione
          </label>
          <input
            id="stagione"
            name="stagione"
            placeholder="es. 2026-27"
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          />
          <button type="submit" className="h-8 rounded-lg bg-primary text-sm text-primary-foreground">
            Apri
          </button>
        </form>
      </div>
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
      <h1 className="text-xl font-semibold">Dossier giocatori — {stagioneValue}</h1>
      <p className="text-sm text-muted-foreground">
        I dossier valgono per entrambe le leghe (gli stessi giocatori di Serie A, cambiano solo quotazioni e regole)
        — vanno generati una volta a stagione.
      </p>
      <DossierClient
        stagione={stagioneValue}
        giocatori={listone?.data.giocatori ?? []}
        dossierEsistente={dossier?.data.giocatori ?? []}
      />
    </div>
  );
}
