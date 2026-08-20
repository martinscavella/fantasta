"use client";

import Link from "next/link";
import { useRef } from "react";
import { usePathname } from "next/navigation";
import { BarChart3, ChevronDown, FileUp, Gavel, Settings, Table2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const VOCI = [
  { href: "/asta", label: "Aste", icon: Gavel },
  { href: "/listone", label: "Listone", icon: Table2 },
] as const;

// Voci a livello di stagione (non legate a un'asta specifica): raggruppate in
// un menu a parte per non ripeterle identiche in ogni schermata, dentro o
// fuori da un'asta selezionata. La descrizione è qui apposta — prima il menu
// dava solo un'etichetta di una parola, e non era chiaro a cosa servisse
// ciascuna voce prima di cliccarci sopra.
const IMPOSTAZIONI = [
  { href: "/impostazioni/listone", label: "Importa listone", desc: "Carica il file ufficiale o Fanta Club", icon: Upload },
  { href: "/asta/importa", label: "Importa asta conclusa", desc: "Rose e prezzi da un file per fantaleghe", icon: FileUp },
  { href: "/impostazioni/statistiche", label: "Statistiche", desc: "Stato scraping e coda di revisione nomi", icon: BarChart3 },
] as const;

function NavLink({ href, label, icon: Icon, attiva }: { href: string; label: string; icon: typeof Gavel; attiva: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        attiva ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <Icon className="size-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

export function NavBar() {
  const pathname = usePathname() ?? "";
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const impostazioniAttiva = IMPOSTAZIONI.some((v) => pathname.startsWith(v.href));

  return (
    <nav className="flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-sm">
      {VOCI.map(({ href, label, icon }) => (
        <NavLink key={href} href={href} label={label} icon={icon} attiva={pathname === href || pathname.startsWith(href + "/")} />
      ))}

      <details ref={detailsRef} className="group relative">
        <summary
          className={cn(
            "flex list-none items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors select-none",
            impostazioniAttiva ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <Settings className="size-3.5" />
          <span className="hidden sm:inline">Impostazioni</span>
          <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
        </summary>
        <div className="absolute top-full right-0 z-30 mt-2 flex w-64 flex-col gap-0.5 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg">
          {IMPOSTAZIONI.map(({ href, label, desc, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => {
                if (detailsRef.current) detailsRef.current.open = false;
              }}
              className={cn(
                "flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                pathname.startsWith(href) ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="mt-0.5 size-3.5 shrink-0" />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{label}</span>
                <span className="text-xs text-muted-foreground">{desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </details>
    </nav>
  );
}
