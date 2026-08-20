"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Gavel, Settings, Sparkles, Table2, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function AstaSubNav({ astaId, nome }: { astaId: string; nome: string }) {
  const pathname = usePathname() ?? "";

  const tabs = [
    { href: `/asta/${astaId}`, label: "Tracker", icon: Gavel, attiva: pathname === `/asta/${astaId}` },
    { href: `/asta/${astaId}/listone`, label: "Listone", icon: Table2, attiva: pathname.startsWith(`/asta/${astaId}/listone`) },
    { href: `/asta/${astaId}/strategia`, label: "Strategia", icon: Target, attiva: pathname.startsWith(`/asta/${astaId}/strategia`) },
    { href: `/asta/${astaId}/ai`, label: "IA", icon: Sparkles, attiva: pathname.startsWith(`/asta/${astaId}/ai`) },
    { href: `/asta/${astaId}/riepilogo`, label: "Riepilogo", icon: TrendingUp, attiva: pathname.startsWith(`/asta/${astaId}/riepilogo`) },
  ];

  // Le impostazioni non sono un passo del flusso come gli altri tab: stanno a
  // parte come icona, per non rubare spazio alle cinque voci che si usano davvero.
  const impostazioniHref = `/asta/${astaId}/impostazioni`;
  const impostazioniAttiva = pathname.startsWith(impostazioniHref);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-1.5 text-sm">
        <Link
          href="/asta"
          className="flex items-center gap-1 rounded-full px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Aste
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="truncate font-semibold">{nome}</span>
      </div>
      <nav className="flex flex-wrap items-center gap-1 rounded-full border border-border bg-card p-1 shadow-sm">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors",
              tab.attiva
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <tab.icon className="size-3.5" />
            {tab.label}
          </Link>
        ))}
        <span className="mx-0.5 h-4 w-px bg-border" />
        <Link
          href={impostazioniHref}
          title="Impostazioni asta"
          aria-label="Impostazioni asta"
          className={cn(
            "flex items-center rounded-full p-1.5 transition-colors",
            impostazioniAttiva
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <Settings className="size-3.5" />
        </Link>
      </nav>
    </div>
  );
}
