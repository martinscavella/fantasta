import Link from "next/link";
import { connection } from "next/server";
import { ChevronRight, Gavel, PlusCircle } from "lucide-react";
import { getAsteIndex } from "@/lib/blob/repository";
import { CreaAstaForm } from "@/components/asta/crea-asta-form";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";

export default async function AsteIndexPage() {
  // Unica pagina senza params/searchParams: senza questo Next la prerenderebbe
  // a build time, leggendo da Blob durante il build e servendo poi un elenco
  // aste congelato. L'elenco va letto a ogni richiesta.
  await connection();

  const index = await getAsteIndex();
  const aste = [...(index?.data.aste ?? [])].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-6 md:p-8">
      <PageHeader title="Aste" description="Le tue aste, una per lega — ognuna col proprio listone, regolamento e stato squadre." />

      {aste.length > 0 && (
        <SectionCard title="Aste esistenti" icon={Gavel}>
          <ul className="flex flex-col gap-2">
            {aste.map((asta) => (
              <li key={asta.id}>
                <Link
                  href={`/asta/${asta.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
                >
                  <span className="font-medium">{asta.nome}</span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    {asta.stagione}
                    <ChevronRight className="size-3.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard title="Nuova asta" icon={PlusCircle} description="Regolamento e squadre si possono ancora modificare dopo, da Impostazioni asta.">
        <CreaAstaForm />
      </SectionCard>
    </div>
  );
}
