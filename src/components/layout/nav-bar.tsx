"use client";

import Link from "next/link";
import { useRef } from "react";
import { usePathname } from "next/navigation";
import { BarChart3, ChevronDown, FileText, Gavel, Settings, Table2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const VOCI = [
  { href: "/asta", label: "Aste", icon: Gavel },
  { href: "/listone", label: "Listone", icon: Table2 },
] as const;

// Voci a livello di stagione (non legate a un'asta specifica): raggruppate in
// un menu a parte per non ripeterle identiche in ogni schermata, dentro o
// fuori da un'asta selezionata.
const IMPOSTAZIONI = [
  { href: "/impostazioni/listone", label: "Importa listone", icon: Upload },
  { href: "/impostazioni/statistiche", label: "Statistiche", icon: BarChart3 },
  { href: "/impostazioni/dossier", label: "Dossier", icon: FileText },
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
        <div className="absolute top-full right-0 z-30 mt-2 flex w-52 flex-col gap-0.5 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg">
          {IMPOSTAZIONI.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => {
                if (detailsRef.current) detailsRef.current.open = false;
              }}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                pathname.startsWith(href) ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </Link>
          ))}
        </div>
      </details>
    </nav>
  );
}
