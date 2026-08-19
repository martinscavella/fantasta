"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function AstaSubNav({ astaId, nome }: { astaId: string; nome: string }) {
  const pathname = usePathname() ?? "";

  const tabs = [
    { href: `/asta/${astaId}`, label: "Tracker", attiva: pathname === `/asta/${astaId}` },
    { href: `/asta/${astaId}/listone`, label: "Listone", attiva: pathname.startsWith(`/asta/${astaId}/listone`) },
    { href: `/strategia/${astaId}`, label: "Strategia", attiva: pathname.startsWith(`/strategia/${astaId}`) },
    { href: `/riepilogo/${astaId}`, label: "Riepilogo", attiva: pathname.startsWith(`/riepilogo/${astaId}`) },
  ];

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
      <nav className="flex gap-1 rounded-full border border-border bg-card p-1 shadow-sm">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              tab.attiva
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
