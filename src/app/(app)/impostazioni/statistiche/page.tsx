import { getAliases, getListone, getListoneIndex, getStats, getStatsIndex } from "@/lib/blob/repository";
import { CodaRevisione, type RigaDaRivedere } from "@/components/statistiche/coda-revisione";

function formattaData(ts: number | null): string {
  if (ts === null) return "mai";
  return new Date(ts).toLocaleString("it-IT");
}

export default async function StatistichePage({ searchParams }: PageProps<"/impostazioni/statistiche">) {
  const { stagione: stagioneParam } = await searchParams;
  const stagione = Array.isArray(stagioneParam) ? stagioneParam[0] : stagioneParam;

  if (!stagione) {
    return (
      <div className="mx-auto max-w-md p-8">
        <h1 className="mb-4 text-xl font-semibold">Statistiche</h1>
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

  const [statsIndex, aliasesDoc, listoneIndex] = await Promise.all([
    getStatsIndex(stagione),
    getAliases(),
    getListoneIndex(stagione),
  ]);

  const listone = listoneIndex?.data.current
    ? await getListone(stagione, listoneIndex.data.current)
    : null;
  const giocatori = listone?.data.giocatori ?? [];

  const lastAttempt = statsIndex?.data.lastAttempt ?? null;
  const lastSuccess = statsIndex?.data.lastSuccess ?? null;

  let righeDaRivedere: RigaDaRivedere[] = [];
  let totaleRighe = 0;

  if (statsIndex?.data.current) {
    const stats = await getStats(stagione, statsIndex.data.current);
    if (stats) {
      totaleRighe = stats.data.giocatori.length;
      const aliasDecisi = new Set(
        (aliasesDoc?.data.overrides ?? []).map((a) => `${a.fonte}::${a.nomeOriginale}`),
      );
      righeDaRivedere = stats.data.giocatori
        .filter((g) => g.playerId === null && !aliasDecisi.has(`${g.fonte}::${g.nomeOriginale}`))
        .map((g) => ({ fonte: g.fonte, nomeOriginale: g.nomeOriginale, presenze: g.presenze, mediaVoto: g.mediaVoto }));
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">Statistiche — {stagione}</h1>

      <div className="flex flex-col gap-1 rounded-xl border border-border p-4 text-sm">
        <span>
          Ultimo tentativo: <span className="text-muted-foreground">{formattaData(lastAttempt)}</span>
        </span>
        <span>
          Ultimo aggiornamento riuscito: <span className="text-muted-foreground">{formattaData(lastSuccess)}</span>
        </span>
        {statsIndex?.data.current ? (
          <span>
            {totaleRighe} righe importate, {righeDaRivedere.length} da rivedere
          </span>
        ) : (
          <span className="text-muted-foreground">
            Nessuna statistica ancora importata per questa stagione — esegui{" "}
            <code className="rounded bg-muted px-1">npm run scrape -- {stagione}</code>.
          </span>
        )}
      </div>

      {statsIndex?.data.current && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Coda di revisione</h2>
          <CodaRevisione righe={righeDaRivedere} giocatori={giocatori} />
        </section>
      )}
    </div>
  );
}
