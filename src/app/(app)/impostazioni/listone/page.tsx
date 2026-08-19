import Link from "next/link";
import { getAsteIndex, getListoneIndex } from "@/lib/blob/repository";
import { ImportListoneClient } from "@/components/impostazioni/import-listone-client";
import { PageHeader } from "@/components/shared/page-header";
import { StagioneGate } from "@/components/shared/stagione-gate";

export default async function ImportListonePage({ searchParams }: PageProps<"/impostazioni/listone">) {
  const { stagione } = await searchParams;

  if (!stagione) {
    const asteIndex = await getAsteIndex();
    const stagioni = [...new Set((asteIndex?.data.aste ?? []).map((a) => a.stagione))];
    return (
      <StagioneGate
        stagioni={stagioni}
        title="Importa listone"
        description="Carica il file ufficiale Fantacalcio.it o l'export di Fanta Club: qui si mappano le colonne una volta per fonte e si versiona ogni import."
      />
    );
  }

  const stagioneValue = Array.isArray(stagione) ? stagione[0] : stagione;
  const index = await getListoneIndex(stagioneValue);
  const versioneCorrente = index?.data.storico.find((v) => v.versionId === index.data.current) ?? null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <PageHeader
        title={`Importa listone — ${stagioneValue}`}
        description={
          versioneCorrente
            ? `Versione corrente: ${versioneCorrente.numeroGiocatori} giocatori, fonte "${versioneCorrente.fonte}", importata il ${new Date(versioneCorrente.importedAt).toLocaleString("it-IT")}.`
            : "Nessun listone importato ancora per questa stagione."
        }
      />
      <ImportListoneClient stagione={stagioneValue} />
      <p className="text-sm text-muted-foreground">
        Fatto? Il passo successivo è{" "}
        <Link href={`/impostazioni/statistiche?stagione=${stagioneValue}`} className="underline">
          rivedere le statistiche
        </Link>{" "}
        o, se serve solo il listone, tornare al{" "}
        <Link href={`/listone?stagione=${stagioneValue}`} className="underline">
          Listone
        </Link>
        .
      </p>
    </div>
  );
}
