import { ListChecks, Terminal } from "lucide-react";
import { getAliases, getAsteIndex, getListone, getListoneIndex, getStats, getStatsIndex } from "@/lib/blob/repository";
import { CodaRevisione, type RigaDaRivedere } from "@/components/statistiche/coda-revisione";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StagioneList } from "@/components/shared/stagione-list";

function formattaData(ts: number | null): string {
  if (ts === null) return "mai";
  return new Date(ts).toLocaleString("it-IT");
}

export default async function StatistichePage({ searchParams }: PageProps<"/impostazioni/statistiche">) {
  const { stagione: stagioneParam } = await searchParams;
  const stagione = Array.isArray(stagioneParam) ? stagioneParam[0] : stagioneParam;

  if (!stagione) {
    const asteIndex = await getAsteIndex();
    const stagioni = [...new Set((asteIndex?.data.aste ?? []).map((a) => a.stagione))];
    return (
      <StagioneList
        stagioni={stagioni}
        hrefPrefix="/impostazioni/statistiche"
        title="Statistiche"
        description="Stato dell'ultimo scraping (media voto, fantamedia, presenze…) e coda di revisione per i nomi che non hanno trovato un match automatico nel listone."
      />
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
      <PageHeader
        title={`Statistiche — ${stagione}`}
        description="Le statistiche non si importano da qui: questa pagina mostra solo lo stato dell'ultimo scraping (eseguito da CLI o dal cron) e la coda di nomi da abbinare a mano."
      />

      <SectionCard title="Stato scraping" icon={Terminal}>
        <div className="flex flex-col gap-1 text-sm">
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
              Nessuna statistica ancora importata per questa stagione. Da terminale, nella cartella del progetto:{" "}
              <code className="rounded bg-muted px-1">npm run scrape -- {stagione}</code>
            </span>
          )}
        </div>
      </SectionCard>

      {statsIndex?.data.current && (
        <SectionCard
          title="Coda di revisione"
          icon={ListChecks}
          description="Nomi trovati dallo scraping che non hanno trovato un match automatico nel listone: assegnali a un giocatore o scarta la riga. Le decisioni si salvano come alias e valgono per i prossimi import."
        >
          <CodaRevisione righe={righeDaRivedere} giocatori={giocatori} />
        </SectionCard>
      )}

      <p className="text-sm text-muted-foreground">
        Statistiche a posto? I dossier giocatore si generano dal tab{" "}
        <span className="font-medium text-foreground">IA</span> di un&apos;asta di questa stagione, insieme alle altre
        funzioni del Ponte manuale.
      </p>
    </div>
  );
}
