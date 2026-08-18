import Link from "next/link";

// Dentro il route group (app) per ereditare l'header con la nav. Nessuna
// lettura da Blob: la home deve restare raggiungibile anche quando lo store
// non è configurato o è irraggiungibile.
const SEZIONI = [
  {
    href: "/asta",
    titolo: "Aste",
    descrizione: "Crea un'asta o riprendi il tracker di una in corso.",
  },
  {
    href: "/listone",
    titolo: "Listone",
    descrizione: "Quotazioni, fasce e statistiche di tutti i giocatori.",
  },
  {
    href: "/impostazioni/listone",
    titolo: "Importa listone",
    descrizione: "Carica il file di Fantacalcio.it o Fanta Club, con mapping guidato.",
  },
  {
    href: "/impostazioni/statistiche",
    titolo: "Statistiche",
    descrizione: "Stato dello scraping e coda di revisione dei nomi non abbinati.",
  },
  {
    href: "/impostazioni/dossier",
    titolo: "Dossier",
    descrizione: "Genera i prompt a blocchi e importa i dossier giocatore.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Fantasta</h1>
        <p className="text-sm text-muted-foreground">
          Preparazione della strategia e tracking dell&apos;asta del fantacalcio.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {SEZIONI.map((sezione) => (
          <li key={sezione.href}>
            <Link
              href={sezione.href}
              className="flex flex-col gap-0.5 rounded-lg border border-border px-3 py-2 hover:bg-muted/50"
            >
              <span className="text-sm font-medium">{sezione.titolo}</span>
              <span className="text-sm text-muted-foreground">{sezione.descrizione}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
