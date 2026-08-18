import Link from "next/link";
import { connection } from "next/server";
import { getAsteIndex } from "@/lib/blob/repository";
import { CreaAstaForm } from "@/components/asta/crea-asta-form";

export default async function AsteIndexPage() {
  // Unica pagina senza params/searchParams: senza questo Next la prerenderebbe
  // a build time, leggendo da Blob durante il build e servendo poi un elenco
  // aste congelato. L'elenco va letto a ogni richiesta.
  await connection();

  const index = await getAsteIndex();
  const aste = [...(index?.data.aste ?? [])].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">Aste</h1>

      {aste.length > 0 && (
        <ul className="flex flex-col gap-2">
          {aste.map((asta) => (
            <li key={asta.id}>
              <Link
                href={`/asta/${asta.id}`}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50"
              >
                <span>{asta.nome}</span>
                <span className="text-muted-foreground">{asta.stagione}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h2 className="text-sm font-medium text-muted-foreground">Nuova asta</h2>
      <CreaAstaForm />
    </div>
  );
}
