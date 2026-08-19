import Link from "next/link";
import { Gavel } from "lucide-react";
import { NavBar } from "@/components/layout/nav-bar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/80 px-6 py-3 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Gavel className="size-4" />
          </span>
          Fantasta
        </Link>
        <NavBar />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
