import Link from "next/link";
import { CalendarDays } from "lucide-react";

// Variante di sola lettura di StagioneGate: per le pagine dove la stagione
// dev'essere per forza già esistente altrove (Statistiche, Dossier — servono
// entrambe un listone già importato), non ha senso offrire un campo di testo
// libero — porterebbe a una stagione senza dati. Qui si mostra solo l'elenco
// di quelle già in uso, cliccabili direttamente.
export function StagioneList({
  stagioni,
  title,
  description,
  hrefPrefix,
}: {
  stagioni: string[];
  title: string;
  description?: string;
  hrefPrefix: string;
}) {
  return (
    <div className="mx-auto max-w-md p-8">
      <h1 className="mb-1 text-xl font-semibold">{title}</h1>
      {description && <p className="mb-5 text-sm text-muted-foreground">{description}</p>}

      {stagioni.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nessuna stagione disponibile ancora — importa prima un listone da{" "}
          <Link href="/impostazioni/listone" className="underline">
            Importa listone
          </Link>
          .
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {stagioni.map((s) => (
            <li key={s}>
              <Link
                href={`${hrefPrefix}?stagione=${s}`}
                className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted/50"
              >
                <CalendarDays className="size-3.5 text-muted-foreground" />
                {s}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
