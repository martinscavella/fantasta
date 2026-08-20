# Design system — Fantasta

Convenzioni pratiche per l'interfaccia, estratte dalla UI già esistente
(`TeamsGrid`, home page) e unificate su tutte le pagine. Non è un design
system a sé stante: è shadcn su Base UI (stile `base-nova`, vedi AGENTS.md) con
un livello sottile di componenti condivisi sopra, per evitare che ogni pagina
reinventi bordi/spaziature/gerarchia del testo.

## Componenti condivisi (`src/components/shared/`)

- **`PageHeader`** — `<h1>` + descrizione opzionale + azioni a destra. Ogni
  pagina di primo livello (Strategia, Riepilogo, Analisi live, …) lo usa
  invece di scrivere l'`<h1>` a mano.
- **`SectionCard`** — contenitore di sezione: `rounded-2xl border shadow-sm`,
  icona opzionale in badge tondo, titolo `text-base font-semibold` (non
  attenuato — un titolo di sezione non è testo secondario), descrizione
  opzionale, azioni a destra. Sostituisce le vecchie `<section>` piatte senza
  bordo/ombra.
- **`AiCallout`** — riquadro per testo scritto dall'IA nel Ponte manuale
  (sintesi strategia, debrief, analisi live). Tinta `primary` leggera,
  etichetta "Generato dall'IA", testo a `text-[0.95rem] leading-relaxed`: è il
  contenuto più curato della pagina, deve leggersi come tale, non come una
  nota a margine.

## Gerarchia tipografica

| Ruolo | Classi |
|---|---|
| Titolo pagina | `text-2xl font-bold tracking-tight` (via `PageHeader`) |
| Titolo sezione | `text-base font-semibold tracking-tight` (via `SectionCard`) |
| Descrizione (pagina o sezione) | `text-sm text-muted-foreground` |
| Testo IA (prosa) | `text-[0.95rem] leading-relaxed` (via `AiCallout`) |
| Etichetta minuta (badge, colonna tabella) | `text-xs text-muted-foreground` |
| Numeri (crediti, quotazioni, prezzi) | `font-mono` — sempre, ovunque appaia un valore numerico legato ai crediti |

## Card ed elevazione

Tutte le card di contenuto: `rounded-2xl border border-border bg-card p-4
shadow-sm sm:p-5` (lo stile che già usavano `TeamsGrid` e le card della home).
Le liste dense (righe di rosa, tabelle filtrabili) restano `rounded-xl` senza
ombra — sono contenitori di dati, non blocchi di contenuto autonomi.

## Colore semantico

Riuso della palette per ruolo già definita in `src/lib/ruoli.ts`
(`RUOLO_CLASSI`: P ambra, D verde, C blu, A rosso) ovunque compaia un ruolo.
Per gli stati di budget/rischio, la stessa terna usata in `TeamsGrid`:

- **emerald** — entro budget / in linea col piano
- **amber** — vicino al limite (≥90% speso, sforamento lieve)
- **rose** — sopra budget / sforato

Non inventare altre semantiche di colore: se uno stato non è chiaramente
positivo/in-attenzione/negativo, resta neutro (`muted-foreground`), niente
colore solo per decorazione.

## Icone

`lucide-react`, un'icona per sezione al massimo (non per ogni riga). Scelta
per continuità semantica, non decorativa: `Sparkles` per tutto ciò che è
generato dall'IA, `Layers`/`PieChart` per fasce e budget, `Target` per
obiettivi di slot, `Coins` per prezzi, `Wand2` per la simulazione, `Users` per
le rose, `TrendingUp` per gli scostamenti.

## Dove si applica (stato attuale)

Applicato a Strategia, Riepilogo, hub IA, Tracker e Listone. `TeamsGrid` e la
home page erano già coerenti e sono rimaste il riferimento. Restano da rivedere
le pagine di importazione e impostazioni.

Due componenti aggiunti nel giro di semplificazione UX, entrambi riusabili:

- **`Stepper`** (`components/shared/`) — barra dei passi per i wizard di
  import, condivisa tra listone e rose.
- **`Popover`** (`components/ui/`) — wrapper su Base UI con le stesse
  convenzioni di `select.tsx`/`dialog.tsx`. Nato per il selettore di colonne
  del Listone: quattordici checkbox in fila rubavano una riga intera sopra i
  dati.

Nella tabella del Listone valgono anche: colonne numeriche allineate a destra
in `font-mono` (la regola generale, qui applicata via `meta.numerica`), nome e
casella di confronto bloccati a sinistra durante lo scorrimento orizzontale, e
righe assegnate marcate da un bordo accento invece che da `opacity` sull'intera
riga — a fine asta metà tabella è assegnata, e sbiadirla la renderebbe
illeggibile.
