import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getListone, getListoneIndex } from "@/lib/blob/repository";
import { fasciaStandard } from "@/lib/pricing";
import { ListoneDataTable, type RigaListone } from "@/components/listone/data-table";

export default async function ListonePage({ searchParams }: PageProps<"/listone">) {
  if (!(await requireSession())) redirect("/login");

  const { stagione } = await searchParams;

  if (!stagione) {
    return (
      <div className="mx-auto max-w-md p-8">
        <h1 className="mb-4 text-xl font-semibold">Listone</h1>
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

  if (!index?.data.current) {
    return (
      <div className="mx-auto max-w-md p-8">
        <p className="text-sm text-muted-foreground">
          Nessun listone importato per la stagione &quot;{stagioneValue}&quot;.{" "}
          <Link href="/impostazioni/listone" className="underline">
            Importane uno
          </Link>
          .
        </p>
      </div>
    );
  }

  const listone = await getListone(stagioneValue, index.data.current);
  const giocatori: RigaListone[] = (listone?.data.giocatori ?? []).map((g) => ({
    ...g,
    fascia: fasciaStandard(g.quotazioneAttuale),
  }));

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Listone {stagioneValue}</h1>
      <ListoneDataTable giocatori={giocatori} />
    </div>
  );
}
