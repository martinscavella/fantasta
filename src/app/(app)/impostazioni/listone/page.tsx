import { getListoneIndex } from "@/lib/blob/repository";
import { ImportListoneClient } from "@/components/impostazioni/import-listone-client";

export default async function ImportListonePage({ searchParams }: PageProps<"/impostazioni/listone">) {
  const { stagione } = await searchParams;

  if (!stagione) {
    return (
      <div className="mx-auto max-w-md p-8">
        <h1 className="mb-4 text-xl font-semibold">Importa listone</h1>
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
  const index = await getListoneIndex(stagioneValue);
  const versioneCorrente = index?.data.storico.find((v) => v.versionId === index.data.current) ?? null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">Importa listone — {stagioneValue}</h1>
      {versioneCorrente ? (
        <p className="text-sm text-muted-foreground">
          Versione corrente: {versioneCorrente.numeroGiocatori} giocatori, fonte &quot;{versioneCorrente.fonte}
          &quot;, importata il {new Date(versioneCorrente.importedAt).toLocaleString("it-IT")}.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Nessun listone importato ancora per questa stagione.</p>
      )}
      <ImportListoneClient stagione={stagioneValue} />
    </div>
  );
}
