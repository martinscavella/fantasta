import Link from "next/link";
import { getAsteIndex, getListoneIndex } from "@/lib/blob/repository";
import { ImportaRoseClient } from "@/components/asta/importa-rose-client";
import { StagioneGate } from "@/components/shared/stagione-gate";

// Segmento statico: in App Router "/asta/importa" vince su "/asta/[id]", e gli
// id delle aste sono UUID — nessuna collisione possibile.
export default async function ImportaRosePage({ searchParams }: PageProps<"/asta/importa">) {
  const { stagione } = await searchParams;

  if (!stagione) {
    const asteIndex = await getAsteIndex();
    const stagioni = [...new Set((asteIndex?.data.aste ?? []).map((a) => a.stagione))];
    return (
      <StagioneGate
        stagioni={stagioni}
        title="Importa un'asta conclusa"
        description="Carica il file per fantaleghe di Fantacalcio.it e ricostruisci un'asta già giocata, con tutte le rose e i prezzi pagati."
      />
    );
  }

  const stagioneValue = Array.isArray(stagione) ? stagione[0] : stagione;
  const index = await getListoneIndex(stagioneValue);
  const versioneCorrente = index?.data.storico.find((v) => v.versionId === index.data.current) ?? null;

  // Gli id nel file sono quelli del listone: senza listone importato non c'è
  // nulla da abbinare, e vale la pena dirlo prima che l'utente carichi il file.
  if (!versioneCorrente) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-3 p-8">
        <h1 className="text-xl font-semibold">Importa un&apos;asta conclusa — {stagioneValue}</h1>
        <p className="text-sm text-muted-foreground">
          Nessun listone importato per questa stagione. Il file delle rose contiene solo gli id dei giocatori:
          servono le anagrafiche per capire chi sono.
        </p>
        <Link href={`/impostazioni/listone?stagione=${stagioneValue}`} className="text-sm underline">
          Importa prima il listone
        </Link>
      </div>
    );
  }

  return (
    <ImportaRoseClient
      stagione={stagioneValue}
      listoneDescrizione={`Listone in uso: ${versioneCorrente.numeroGiocatori} giocatori, fonte "${versioneCorrente.fonte}".`}
    />
  );
}
