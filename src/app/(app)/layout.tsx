import Link from "next/link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center gap-4 border-b border-border px-6 py-3">
        <span className="font-semibold">Fantasta</span>
        <nav className="flex gap-3 text-sm text-muted-foreground">
          <Link href="/asta" className="hover:text-foreground">
            Aste
          </Link>
          <Link href="/listone" className="hover:text-foreground">
            Listone
          </Link>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
