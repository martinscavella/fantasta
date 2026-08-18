import Link from "next/link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center gap-4 border-b border-border px-6 py-3">
        <Link href="/" className="font-semibold">
          Fantasta
        </Link>
        <nav className="flex gap-3 text-sm text-muted-foreground">
          <Link href="/asta" className="hover:text-foreground">
            Aste
          </Link>
          <Link href="/listone" className="hover:text-foreground">
            Listone
          </Link>
          <Link href="/impostazioni/listone" className="hover:text-foreground">
            Importa listone
          </Link>
          <Link href="/impostazioni/statistiche" className="hover:text-foreground">
            Statistiche
          </Link>
          <Link href="/impostazioni/dossier" className="hover:text-foreground">
            Dossier
          </Link>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
