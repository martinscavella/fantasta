import Link from "next/link";
import { BarChart3, FileText, FileUp, Gavel, Table2, Upload, type LucideIcon } from "lucide-react";

// Dentro il route group (app) per ereditare l'header con la nav. Nessuna
// lettura da Blob: la home deve restare raggiungibile anche quando lo store
// non è configurato o è irraggiungibile.
const SEZIONI: { href: string; titolo: string; descrizione: string; icon: LucideIcon }[] = [
  {
    href: "/asta",
    titolo: "Aste",
    descrizione: "Crea un'asta o riprendi il tracker di una in corso.",
    icon: Gavel,
  },
  {
    href: "/asta/importa",
    titolo: "Importa asta conclusa",
    descrizione: "Ricostruisci un'asta già giocata dal file per fantaleghe, rose e prezzi inclusi.",
    icon: FileUp,
  },
  {
    href: "/listone",
    titolo: "Listone",
    descrizione: "Quotazioni, fasce e statistiche di tutti i giocatori.",
    icon: Table2,
  },
  {
    href: "/impostazioni/listone",
    titolo: "Importa listone",
    descrizione: "Carica il file di Fantacalcio.it o Fanta Club, con mapping guidato.",
    icon: Upload,
  },
  {
    href: "/impostazioni/statistiche",
    titolo: "Statistiche",
    descrizione: "Stato dello scraping e coda di revisione dei nomi non abbinati.",
    icon: BarChart3,
  },
  {
    href: "/impostazioni/dossier",
    titolo: "Dossier",
    descrizione: "Genera i prompt a blocchi e importa i dossier giocatore.",
    icon: FileText,
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight">Fantasta</h1>
        <p className="text-muted-foreground">
          Preparazione della strategia e tracking dell&apos;asta del fantacalcio.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SEZIONI.map((sezione) => (
          <li key={sezione.href}>
            <Link
              href={sezione.href}
              className="group flex h-full flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <sezione.icon className="size-5" />
              </span>
              <span className="font-semibold">{sezione.titolo}</span>
              <span className="text-sm text-muted-foreground">{sezione.descrizione}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
