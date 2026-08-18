# Fantasta — web app di strategia e tracking per l'asta del fantacalcio

## Context

Serve uno strumento personale per dominare l'asta del fantacalcio, con le funzionalità di [FantaLab](https://www.fantalab.it/) ma calibrate sull'uso reale dichiarato:

- **Tracker, non piattaforma live.** L'asta si fa dal vivo/su un altro tool. Questa app serve a *me* per segnare chi ha comprato chi e a che prezzo — incluse le squadre avversarie — e sapere in ogni istante chi è rimasto libero. Niente timer, banditore, rilanci o multiplayer realtime.
- **Solo modalità Classic** (P/D/C/A). Niente ruoli Mantra né moduli.
- **Due leghe con regolamenti diversi**: una su Fantacalcio.it a budget chiuso, una su Fanta Club **a sforo** (i crediti extra si pagano con soldi veri). Listoni diversi, regole diverse, stessa app.
- **Vantaggio competitivo**: durante l'asta devo sapere in tempo reale quanto può ancora spendere ogni avversario, quali slot deve riempire per forza, e se il prezzo corrente di un giocatore è sopra o sotto il mio limite.

Risultato atteso: una singola schermata d'asta usabile in meno di 2 secondi per azione, alimentata da un listone ufficiale importato e da statistiche raccolte via scraping, più gli strumenti di preparazione (fasce, slot, budget, prezzi massimi, obiettivi) da compilare prima dell'asta.

**Progetto nuovo**, greenfield, in `C:\Users\Scave\Desktop\fantasta`.

---

## Decisioni prese (dalle risposte dell'utente)

| Ambito | Scelta |
|---|---|
| Tipo app | Single-user: preparazione strategia + tracking assegnazioni. **No realtime, no timer, no banditore** |
| Modalità | Solo Classic |
| Dati | Import listone multi-piattaforma (Fantacalcio.it + Fanta Club) + scraping statistiche |
| Aste | Più aste in parallelo, con regolamenti diversi — inclusa la **modalità a sforo** |
| Stack | Next.js + shadcn, **Vercel Blob come storage dati** |
| IA | **Ponte manuale**: l'app genera il prompt, tu lo giri in chat sul tuo abbonamento, l'app valida e importa la risposta. Costo zero. API solo per l'analisi live, opzionale |

---

## Stack

Riuso quasi integrale delle convenzioni di `Desktop/diez-crm`, che è già su questo stack:

- **Next.js 16** + React 19 + TypeScript
- **shadcn/ui su Base UI** (`@base-ui/react`, **non Radix**), stile `base-nova`, baseColor `neutral`, Tailwind 4, `lucide-react`
- **Vercel Blob** (`@vercel/blob` ≥ 2.3) — store **privato**
- **zod 4** per validare ogni documento in lettura/scrittura
- **Zustand** (stato asta client) + **`idb-keyval`** (buffer IndexedDB anti-crash)
- **TanStack Table** + `@tanstack/react-virtual` per il listone
- **`read-excel-file`** (parser xlsx) — più leggero e streaming-friendly di `xlsx`/SheetJS
- **`cheerio`** + `undici` per gli scraper
- **Vitest** (config in `.mts`) + **Playwright**

### Gotcha da rispettare (già noti dal progetto esistente)

- Middleware Next 16 = `src/proxy.ts` con `export function proxy()`, **non** `middleware.ts` (al momento il progetto non ne ha uno: vedi § Autenticazione)
- `params`/`searchParams` delle pagine sono **Promise** → `await params`; `cookies()` è async
- shadcn su Base UI: composizione con `render={<Link …/>}` **non** `asChild`; `Select.onValueChange` passa `(value: string | null)`; size bottoni includono `icon-sm`/`xs`. **Verificare sempre la firma reale in `src/components/ui/*.tsx` prima di scrivere UI**
- ESLint `react-hooks/set-state-in-effect` vieta `setState` sincrono negli effect → caricare dati negli event handler
- Fidarsi di `npx tsc --noEmit`, non delle diagnostiche IDE (in ritardo di un edit)
- Leggere `node_modules/next/dist/docs/` prima di scrivere codice Next: questa versione ha breaking change rispetto al training

---

## Architettura dati su Vercel Blob

Vercel Blob è object storage, non un database: niente query, niente transazioni, niente update parziali. Per questo caso d'uso (utente singolo, ~600 giocatori, ~500 eventi d'asta) è adeguato, **a patto di applicare tre pattern**. Li documento perché sono la parte che può far perdere dati se sbagliata.

### 1. Store privato + letture consistenti

I documenti di strategia sono l'asset competitivo: non devono essere leggibili da chi indovina un URL. Store creato con `--access private`, così i blob non si raggiungono direttamente. Attenzione però: l'app che li serve non ha autenticazione (vedi § Autenticazione), quindi la riservatezza si regge solo sul fatto che l'URL del deploy non sia noto.

Per i documenti mutabili (stato asta), `get(pathname, { access: 'private', useCache: false })`: bypassa la CDN e garantisce l'ultima versione. Senza questo flag un overwrite può impiegare **fino a 60 secondi** a propagarsi, e in asta significa perdere assegnazioni.

### 2. Scritture condizionali (optimistic concurrency)

Ogni `put` mutabile usa `allowOverwrite: true` + `ifMatch: <etag>` letto da `head()`. Se un'altra scheda del browser ha scritto nel frattempo, l'SDK lancia `BlobPreconditionFailedError` → si rilegge, si fa merge e si riprova. Senza `ifMatch`, due tab aperte = perdita silenziosa di dati.

### 3. Documenti immutabili dove possibile

Listone e statistiche non cambiano dopo la scrittura → pathname versionato + cache CDN lunga (letture veloci e quasi gratuite). Solo un piccolo `index.json` mutabile punta alla versione corrente.

### Layout dei blob

```
listone/{stagione}/{versionId}.json        immutabile — anagrafica + quotazioni (~200 KB)
listone/{stagione}/index.json              mutabile   — versione corrente + storico import
stats/{stagione}/{versionId}.json          immutabile — statistiche aggregate da scraping
stats/{stagione}/index.json                mutabile   — versione corrente + stato freshness
stats/aliases.json                         mutabile   — override manuale name-matching
aste/index.json                            mutabile   — elenco aste
aste/{astaId}/setup.json                   mutabile   — regole lega, squadre, budget
aste/{astaId}/strategy.json                mutabile   — fasce, slot, target, prezzi max
aste/{astaId}/board.json                   mutabile   — event log delle assegnazioni
```

### `board.json` è un event log, non uno snapshot

```ts
type BoardEvent =
  | { id: string; ts: number; type: 'ASSIGN'; playerId: number; teamId: string; price: number }
  | { id: string; ts: number; type: 'UNDO'; targetEventId: string }
  | { id: string; ts: number; type: 'EDIT'; targetEventId: string; price?: number; teamId?: string }
```

Lo stato (rose, crediti, slot) è **derivato** da un reducer puro. Tre vantaggi che ripagano subito:

1. **Undo/correzione gratis** — in asta si sbaglia a digitare, e serve poterlo correggere in un tasto
2. **Reducer puro = test banali** con Vitest, senza mock di rete
3. **Merge dei conflitti facile** — gli eventi hanno id univoci, quindi in caso di `412` il merge è l'unione dei due log ordinata per `ts`

500 eventi × ~100 byte ≈ 50 KB: riscrivere l'intero documento a ogni salvataggio è perfettamente sostenibile.

### Il punto critico: Blob non è nel percorso critico

Un round-trip a Blob con `useCache: false` costa 200–500 ms. Durante l'asta è inaccettabile. Quindi:

```
azione utente → Zustand (istantaneo, UI ottimistica)
             → IndexedDB (~1 ms, sopravvive a crash/refresh)
             → debounce 2s → POST /api/aste/[id]/board → Blob (ifMatch)
```

Blob è **backup e sync tra dispositivi**, non la fonte di verità durante l'asta. Un indicatore di stato in UI (`salvato` / `salvataggio…` / `offline — dati al sicuro in locale`) rende la cosa esplicita. Al ricaricamento della pagina si confronta il log locale con quello remoto e si fa merge.

---

## Funzionalità

### A. Preparazione asta (`/strategia`) — dal set "Tulasta" di FantaLab

- **Fasce configurabili** — default alla convenzione standard (Top ≥ 30 crediti, Semitop 15–29, Terza fascia 6–14, Scommesse 1–5), con soglie modificabili
- **Slot per reparto** — es. 3 P, 8 D, 8 C, 6 A; ogni slot ha un obiettivo principale + alternative ordinate
- **Budget per reparto** in crediti e in percentuale, con **ricalcolo automatico**: se sposto crediti sull'attacco, le percentuali degli altri reparti si aggiornano e segnalo lo sforamento
- **Prezzo massimo personale** per ogni giocatore, sovrascrivibile a mano, con default calcolato
- **Simula rosa** — costruisco la rosa ideale, verifico il vincolo di budget e ricevo un rating 1–5 su copertura slot, concentrazione della spesa e rischio (titolarità/infortuni)
- **Template di strategia** — preset tipo "corazzata difensiva", "attacco stellare", "budget diffuso" che precompilano ripartizione e fasce

### B. Tracker d'asta (`/asta`) — la schermata principale

Il cuore dell'app. Layout denso, tutto raggiungibile da tastiera.

- **Barra comando** (shadcn `Command`): cerco il giocatore con match fuzzy, digito il prezzo, scelgo la squadra, `Invio`. Nessun uso del mouse richiesto.
- **Pannello sinistro — giocatori liberi**: filtro per ruolo/squadra/fascia, con il *mio* prezzo max, la fascia e le stat chiave in colonna. Gli assegnati spariscono automaticamente.
- **Pannello destro — griglia squadre**, per ognuna:
  - crediti residui (può andare in negativo in modalità sforo)
  - slot residui per ruolo (`P 1/3 · D 5/8 · C 6/8 · A 4/6`)
  - **massima offerta possibile** = `crediti_residui − (slot_residui − 1)` ← *l'informazione più preziosa in un'asta a budget chiuso*: dice esattamente fin dove ogni avversario può spingersi
  - **sforo corrente in crediti e in euro** (solo in modalità sforo — vedi sotto)
  - alert quando un avversario è **obbligato** a comprare un ruolo (slot residui = giocatori liberi necessari)
- **Prezzo reattivo**: il mio prezzo max si ricalcola dinamicamente sull'inflazione corrente della lega. Due formule, a seconda del regolamento (vedi § Modalità sforo).
- **Log eventi** con undo e modifica di qualsiasi assegnazione passata
- **Rose avversarie** in tab dedicate, con spesa per reparto

### C. Data center (`/listone`)

- Tabella virtualizzata: quotazione iniziale/attuale, FVM, fascia, e da scraping media voto, fantamedia, presenze, gol, assist, ammonizioni, espulsioni, rigori
- Filtri combinabili, ordinamento multi-colonna, colonne mostra/nascondi
- **Scheda giocatore**: trend per giornata, xG/xA, punti di forza/debolezza derivati dalle metriche, alternative simili per ruolo e fascia di prezzo
- **Confronto** fino a 4 giocatori affiancati

### D. Post-asta (`/riepilogo`)

Rosa finale, spesa per reparto, scostamento dalla strategia pianificata, confronto delle rose di tutta la lega, export JSON/CSV. In modalità sforo, anche il conto finale in euro per ogni partecipante.

---

## Modalità sforo

Una delle due leghe si gioca **a sforo**: i crediti oltre il budget base si comprano con soldi veri, senza penalità di gioco. Questo non è una variante marginale — **inverte la logica del tracker**.

### Cosa cambia

In un'asta a budget chiuso il vincolo che conta è `crediti_residui − (slot_residui − 1)`: sai con certezza matematica fin dove ogni avversario può spingersi. **A sforo quel tetto non esiste**: chiunque può offrire qualunque cifra, basta che paghi. Il vincolo tecnico sparisce e resta solo un vincolo economico, che non è osservabile ma è *inferibile*.

Quindi il pannello squadre cambia colonna principale. Al posto di "quanto può ancora offrire" (che diventa infinito, quindi inutile) mostra **quanto sta già pagando**:

```
sforoCrediti = max(0, spesa − budgetBase)
sforoEuro    = sforoCrediti × euroPerCredito
```

Chi ha già sforato 150 crediti sta pagando 15 € di tasca sua: è il dato che predice il suo comportamento nei prossimi rilanci molto meglio di qualsiasi conteggio di crediti. Accanto a ogni rilancio in corso, la UI mostra il **costo marginale reale**: *"se la Roma arriva a 60, va a 180 di sforo = 18 €"*.

**Un vincolo rigido sopravvive**: gli slot. Ogni squadra deve comunque completare la rosa, quindi gli alert su chi è *obbligato* a comprare un ruolo restano validi e diventano l'unica certezza rimasta.

### Il prezzo reattivo va ricalcolato diversamente

La formula per il budget chiuso — `crediti_residui_lega / somma_quotazioni_giocatori_liberi` — **si rompe a sforo**, perché il numeratore è illimitato: i crediti in circolazione non sono più una quantità fissa da spartirsi.

Al suo posto, inflazione **osservata** invece che dedotta: la media di `prezzo_pagato / quotazione` sugli acquisti già conclusi, pesata verso i più recenti (l'asta si scalda col passare dei minuti). È una misura di quanto sta effettivamente spendendo la lega, e funziona in entrambe le modalità — nel budget chiuso è una conferma incrociata della formula teorica.

### Configurazione e budget personale

```ts
type RegoleSforo =
  | { tipo: 'nessuno' }
  | { tipo: 'a-pagamento'; euroPerCredito: number }
```

Con lo sforo attivo, la mia strategia acquisisce una seconda valuta: oltre al budget in crediti definisco un **tetto di spesa reale in euro**. Il prezzo massimo per ogni giocatore viene vincolato da entrambi, e la UI avvisa quando un rilancio mi porterebbe oltre il tetto che mi sono dato — la protezione che in un'asta a soldi veri serve davvero.

---

## Import listone e scraping

### Import listone multi-piattaforma (`/impostazioni/listone`)

Servono due listoni diversi: quello ufficiale di [Fantacalcio.it](https://www.fantacalcio.it/quotazioni-fantacalcio) e quello di [Fanta Club](https://www.fantaclub.it/), che **non coincidono**. Fanta Club lascia a ogni lega la possibilità di modificare ruoli e quotazioni — offset fissi, percentuali per ruolo — e attinge a fonti redazionali diverse. Un listone hardcodato su un solo formato non regge.

Quindi il listone è un'entità con una `fonte`, e ogni asta punta al proprio listone. Un unico importer con **rilevamento del formato + mapping colonne guidato**:

1. Carichi il file (`.xlsx` o `.csv`, qualunque origine)
2. Il parser cerca la riga di intestazione (quella che contiene qualcosa di riconducibile a *nome* e *squadra*) e propone una mappatura automatica delle colonne
3. **Confermi o correggi la mappatura in UI**, una volta sola per fonte: la mappatura si salva come profilo riutilizzabile
4. Anteprima con diff rispetto alla versione precedente — nuovi, ceduti, quotazioni variate — prima di scrivere

Per il file ufficiale la mappatura automatica va a segno da sola (colonne attese: `Id`, `R`, `RM`, `Nome`, `Squadra`, `Qt.A`, `Qt.I`, `Diff.`, `FVM`; di Mantra si tiene solo `FVM M` come segnale, i ruoli si ignorano). Per Fanta Club il mapping guidato copre qualunque formato esca dall'export, **senza che serva conoscerlo in anticipo** — che è il punto: è l'unico approccio che non richiede di indovinare oggi il formato di una piattaforma che non documenta il proprio export, e che continua a funzionare su una terza piattaforma domani.

Il matching dei giocatori tra listoni diversi riusa la stessa pipeline di normalizzazione e fuzzy matching dello scraping (vedi sotto), così statistiche e dossier generati una volta valgono per entrambe le aste.

### Scraping statistiche

Job separato, **mai a runtime durante l'asta**. Architettura ad adapter in `scripts/scrape/`:

```ts
interface StatsSource {
  id: string
  fetch(): Promise<RawRow[]>
  normalize(rows: RawRow[]): PlayerStats[]
}
```

Fonti: statistiche base (mv, fm, presenze, bonus/malus) dai portali fantacalcistici; metriche avanzate (xG, xA) da [FBref](https://fbref.com) / [Understat](https://understat.com).

**Il problema vero è il name matching**, non il fetch: FBref scrive `Lautaro Martínez`, il listone scrive `MARTINEZ LAUTARO`. Pipeline: normalizzazione (lowercase, rimozione diacritici, ordinamento token) → match esatto → match fuzzy Jaro-Winkler con soglia → i residui finiscono in una **coda di revisione manuale** in UI, e le decisioni si sedimentano in `stats/aliases.json`. Senza questo passaggio metà delle statistiche resta orfana.

**Note oneste sui limiti:**
- Lo scraping è la parte più fragile del progetto: le fonti cambiano markup senza preavviso. Gli adapter sono isolati proprio perché se una fonte cade **l'app resta pienamente usabile** con l'ultima versione buona, e la UI segnala i dati come stantii con la data dell'ultimo aggiornamento.
- FBref/Sports Reference applica rate limit stretti (bloccano sopra ~20 richieste/minuto) e i ToS limitano l'uso automatizzato. Si va a 1 richiesta ogni 3 secondi, con User-Agent identificabile e cache locale in `.cache/` per non rifare fetch inutili. È uso personale a volume bassissimo, ma è giusto sapere che è una zona grigia.
- I "prezzi medi d'asta nazionali" di FantaLab **non sono replicabili**: sono un dato proprietario aggregato dalle loro leghe. Sostituiti dal prezzo consigliato calcolato su quotazione × fascia × inflazione, che per l'uso personale è funzionalmente equivalente.

Esecuzione: da CLI (`npm run scrape`, autenticato con `BLOB_READ_WRITE_TOKEN`) e via Vercel Cron su `/api/cron/stats` protetta da `CRON_SECRET`.

---

## Analisi IA delle decisioni

**L'approccio primario non è l'API: è un ponte manuale.** L'app genera un prompt completo, tu lo incolli in una chat Claude sul tuo abbonamento, e riporti la risposta nell'app che la valida e la applica. Costo zero, e per la strategia è **qualitativamente migliore** dell'API — perché puoi discutere il piano invece di subire una risposta secca.

### Il ponte: come funziona

```
App: compili le impostazioni
  → genera il prompt (incluso lo schema JSON atteso)  → [Copia]
     → incolli in claude.ai, Claude cerca sul web e risponde
        → copi il blocco JSON  → [Incolla nell'app]
           → validazione zod → atterra nella strategia
```

**Il dettaglio ingegneristico che rende il tutto affidabile**: lo schema JSON incluso nel prompt è **derivato a runtime dallo stesso schema zod che valida la risposta** (via `zod-to-json-schema`). Un'unica fonte di verità: prompt e validatore non possono divergere. Senza questo, il ponte si rompe alla prima modifica di un campo.

Se la validazione fallisce, l'errore è puntuale (*"manca `fasce[2].soglia`"*) e lo rigiri in chat: Claude corregge e reincolli. In pratica funziona al primo colpo quasi sempre, perché lo schema è nel prompt.

Contro l'API si perde la **garanzia** di JSON valido che dà `output_config.format`. Si guadagna: costo zero, controllo visivo sull'output prima di importarlo, e la possibilità di iterare in conversazione.

### 1. Generatore di strategia — via ponte manuale

Questa funzione è **migliore in chat che via API**, e non solo per il costo: la strategia è una decisione da discutere. Puoi rispondere *"no, con questo budget la difesa non regge, rifammi la ripartizione"*, chiedere di confrontare due impostazioni, spingere su un'intuizione. Una singola chiamata API ti dà una risposta e basta.

Il punto di partenza della preparazione: invece di compilare fasce e budget a mano, imposti i parametri e l'IA costruisce la strategia completa facendo ricerca sul web.

**Input** (le impostazioni che scegli all'inizio):
- **Regole lega e budget** — numero squadre, crediti, slot per ruolo, modalità sforo con relativo cambio €, regole di punteggio (portiere imbattuto, modificatore difesa, assist…)
- **Stile e rischio** — corazzata difensiva / attacco stellare / budget diffuso, e propensione al rischio: quante scommesse ad alto potenziale accettare contro certezze care
- **Vincoli personali** — giocatori o squadre da evitare o da prendere a ogni costo, tetto massimo su singolo giocatore, numero massimo di scommesse

**Cosa produce**, con ricerca web sullo stato attuale della Serie A (mercato, infortuni, cambi di allenatore, gerarchie nei rigori):
- soglie delle fasce, calibrate sul budget reale della lega e non sulla convenzione standard
- ripartizione del budget per reparto, in crediti e percentuale, con la motivazione della scelta
- prezzo massimo per ogni giocatore rilevante
- obiettivi primari e alternative ordinate per ogni slot
- una sintesi in prosa del piano: cosa stiamo facendo e perché

L'output **atterra nella pagina strategia come valori precompilati**, tutti modificabili a mano, con un flag di provenienza che distingue i valori generati da quelli che hai corretto tu. Salvato su `aste/{astaId}/strategy.json`.

Le regole di punteggio della lega contano più di quanto sembri — una lega col modificatore di difesa cambia completamente quanto vale un difensore, ed è esattamente la personalizzazione che le guide generiche non fanno.

### 2. Dossier giocatori — via ponte manuale, a blocchi

Per i ~250 giocatori rilevanti: punti di forza e debolezza dalle statistiche, rischio infortuni e titolarità, notizie recenti (mercato, ballottaggi, cambi di allenatore), prezzo consigliato motivato, alternative comparabili.

**Il vincolo qui è la lunghezza della risposta**: 250 dossier non entrano in un singolo messaggio di chat. Il generatore produce quindi **N prompt numerati da ~25 giocatori** ciascuno, con una barra di avanzamento (`3/10 importati`) e la possibilità di reincollare un blocco per rigenerarlo. Dieci cicli copia-incolla, una volta a stagione.

Due accorgimenti perché i blocchi restino coerenti tra loro: la **rubrica di valutazione esplicita** è ripetuta in ogni prompt (altrimenti il blocco 8 usa una scala diversa dal blocco 1), e ogni prompt porta un id che viene incluso nel JSON di risposta, così l'app rifiuta un blocco incollato nello slot sbagliato.

Se dieci cicli sono troppi, la versione corta funziona bene: **solo i ~60 giocatori che decidono davvero l'asta**, in 2-3 blocchi.

I dossier si generano **una volta e servono entrambe le leghe** — i giocatori di Serie A sono gli stessi, cambiano solo quotazioni e regole. Salvati su `dossier/{stagione}/`.

### 3. Debrief post-asta — via ponte manuale

Valutazione della rosa finale, punti deboli per reparto, scostamento dalla strategia, indicazioni per il mercato di riparazione. L'app genera il prompt con rosa e storico; la risposta è prosa da leggere, non serve nemmeno importarla.

### 4. Analisi decisione live — l'unica che richiede l'API

*"Bonny è a 45, conviene rilanciare?"* durante l'asta. **Qui il ponte manuale non funziona**: copiare un prompt, aspettare, copiare il JSON e reincollarlo è un ciclo da 30–60 secondi, e un giocatore in asta si aggiudica in venti. È l'unica funzione dove la latenza è il requisito.

Due strade, entrambe valide:

- **Con API** — Route Handler con `@anthropic-ai/sdk`, output breve in streaming, **prompt caching TTL 1h** sul prefisso stabile (regole lega + strategia + dossier rilevanti). Il TTL default di 5 minuti non sopravvive alle pause di un'asta; l'ora sì. Costo: **~$1,40–3,60 per asta**, l'unica spesa API del progetto.
- **Senza API** — si rinuncia alla funzione. Il tracker resta pienamente utile: prezzi max, sforo in euro, slot obbligati e inflazione osservata sono tutti calcoli deterministici che non passano da un modello.

**Consiglio: costruisci prima tutto il resto, poi decidi.** Con la strategia e i dossier già in mano, il valore marginale dell'analisi live è più basso di quanto sembri ora — le decisioni difficili le hai già preparate. Se poi la vuoi, sono due euro ad asta.

### Implementazione

- Nessuna dipendenza da `@anthropic-ai/sdk`, nessuna `ANTHROPIC_API_KEY`, nessun contatore di spesa: **le fasi 0–7b non richiedono un account API**. L'SDK entra solo se attivi l'analisi live (fase 8).
- `src/lib/ai/schemas.ts` — schemi zod, unica fonte di verità per validazione *e* generazione del JSON Schema nel prompt
- `src/lib/ai/prompts/` — template dei prompt, uno per funzione, con i placeholder riempiti dai dati reali
- Ogni pagina di generazione: bottone **Copia prompt**, textarea **Incolla risposta**, esito di validazione con errore puntuale
- Le risposte incollate si archiviano grezze accanto al JSON validato — se cambi lo schema puoi rivalidare senza rifare le chat

---

## Autenticazione

**Nessuna.** L'app è aperta a chiunque conosca l'URL del deploy: niente password, niente cookie di sessione, niente `proxy.ts`. Rimossa il 18 agosto 2026 perché il login a password bloccava il deploy Vercel.

Conseguenza da tenere presente: strategia, prezzi massimi e rose sono leggibili **e scrivibili** da chiunque arrivi all'indirizzo. Lo store Blob resta privato — non è indicizzabile e non si raggiunge indovinando un URL di blob — ma le pagine e le Route Handler dell'app lo espongono senza filtri. Se serve richiudere: Vercel Authentication (Settings → Deployment Protection) protegge il deploy senza rimettere codice nell'app.

---

## Costi IA

**Con il ponte manuale il costo è zero.** L'abbonamento Claude non è utilizzabile *da un'app* — Pro e Max coprono claude.ai, l'API è un binario di fatturazione separato via [console.anthropic.com](https://console.anthropic.com) — ma nulla vieta che sia *tu* a usare la chat, con l'app che prepara il prompt e riceve la risposta. Strategia, dossier e debrief passano tutti da lì: **nessuna chiave API, nessun ricarico, nessun contatore di spesa da costruire**.

L'unica voce a pagamento resta l'**analisi decisione live**, opzionale, dove il ciclo copia-incolla è troppo lento. Prezzi verificati al 18 agosto 2026: Opus 5 $5/$25 per milione di token, Sonnet 5 $3/$15 (introduttivo $2/$10 fino al 31 agosto), lettura da cache ~0,1× l'input, scrittura cache 1h a 2×.

Con prefisso di ~12.000 token in cache 1h, ~1.500 token volatili e ~300 di output per domanda:

| Modello | Per domanda | 150 domande (un'asta) | Due aste |
|---|---|---|---|
| Sonnet 5 | ~$0,008 | ~$1,40 | **~$2,80** |
| Opus 5 | ~$0,021 | ~$3,60 | **~$7,20** |

**Totale stagione: $0 senza analisi live, $3–7 con.** Un ricarico minimo da $5 copre l'intera stagione con margine.

Il prezzo introduttivo di Sonnet 5 scade il 31 agosto 2026 — dopo, le cifre Sonnet vanno moltiplicate per 1,5.

---

## Fasi di lavoro

Ordinate per percorso critico: l'app deve essere **utilizzabile a un'asta reale già alla fase 4**, il resto è arricchimento.

| # | Fase | Contenuto |
|---|---|---|
| 0 | Setup | `create-next-app`, shadcn init (`base-nova`/neutral), Tailwind 4, Vitest `.mts`, Playwright, ESLint, store Blob privato, `AGENTS.md` di progetto |
| 1 | Data layer | Schemi zod di tutti i documenti, `src/lib/blob/repository.ts` (read con `useCache:false`, write con `ifMatch` + retry), tipi dominio |
| 2 | Import listone | Importer multi-formato con rilevamento intestazioni e mapping guidato, profili per fonte, anteprima diff, versioning |
| 3 | Listone base | Tabella virtualizzata, filtri, ordinamento, fasce calcolate |
| 4 | **Tracker asta** | Reducer event-sourced, setup lega/squadre, **regole sforo**, barra comando, griglia squadre (max offerta o sforo in € secondo modalità), undo, persistenza Zustand→IndexedDB→Blob con debounce |
| 5 | Strategia | Fasce configurabili, slot con obiettivi e alternative, budget per reparto con ricalcolo %, prezzi max, tetto di spesa reale, simula rosa con rating |
| 6 | Prezzo reattivo | Inflazione teorica (budget chiuso) e osservata (sforo), integrate nella schermata d'asta |
| 7 | Scraping | Adapter fonti, pipeline name-matching, coda revisione alias, cron, indicatore freshness |
| 7b | **Ponte IA** | Schemi zod → JSON Schema nel prompt, generatore di strategia, dossier a blocchi con avanzamento, debrief. Copia prompt / incolla risposta / validazione. **Nessuna API** |
| 8 | Data center | Scheda giocatore, trend, xG/xA, alternative simili, confronto |
| 9 | Post-asta | Riepilogo, scostamento da strategia, export |
| 10 | *(opzionale)* Analisi live | Solo se la vuoi: `@anthropic-ai/sdk`, Route Handler in streaming, prompt caching 1h, chiave API. È l'unica fase che introduce un costo |

---

## File principali

```
src/
  app/
    (app)/asta/[id]/page.tsx        ← schermata critica
    (app)/listone/page.tsx
    (app)/strategia/[id]/page.tsx
    (app)/strategia/[id]/genera/page.tsx   copia prompt / incolla risposta
    (app)/riepilogo/[id]/page.tsx
    (app)/impostazioni/listone/page.tsx
    api/aste/[id]/board/route.ts    POST event log (ifMatch + merge su 412)
    api/listone/import/route.ts     upload + parse + versioning
    api/cron/stats/route.ts         trigger scraping
    api/ai/decisione/route.ts       fase 10 opzionale — analisi live
  lib/
    ai/schemas.ts                   ← schemi zod: validano E generano il JSON Schema del prompt
    ai/prompts/strategia.ts         template prompt + riempimento dai dati reali
    ai/prompts/dossier.ts           template + suddivisione in blocchi da 25
    ai/prompts/debrief.ts
    ai/importa.ts                   parse del blocco incollato, validazione, errori puntuali
    blob/repository.ts              accesso tipizzato ai documenti
    blob/schemas.ts                 schemi zod
    asta/reducer.ts                 ← puro, event log → stato
    asta/derive.ts                  crediti/slot/max-offerta/sforo per squadra
    pricing.ts                      inflazione teorica + osservata, fasce
    listone/parser.ts               xlsx|csv → Player[], mapping colonne
    matching.ts                     normalizzazione + fuzzy name matching
  stores/asta-store.ts              Zustand + persistenza IndexedDB
  components/asta/                  command-bar, teams-grid, event-log
  components/listone/               data-table, player-sheet, compare
scripts/scrape/                     adapter per fonte, eseguiti con tsx
scripts/dossier/                    generazione batch dossier → Blob
```

---

## Verifica

**Test unitari (Vitest)** — la logica che conta è tutta pura e testabile senza rete:

- `asta/reducer` — assegnazione, undo, edit, doppia assegnazione dello stesso giocatore (deve fallire), superamento budget, superamento slot
- `asta/derive` — max offerta con slot residui a 1 (caso limite: `crediti - 0`), squadra a budget esaurito, squadra con rosa completa; **in modalità sforo**: crediti residui negativi, calcolo sforo in crediti e euro, sforo a zero quando la spesa eguaglia esattamente il budget
- `pricing` — inflazione teorica a inizio asta (nessun acquisto), a fine asta (denominatore → 0, non deve dividere per zero); inflazione osservata con zero acquisti e con un solo acquisto; assegnazione fasce ai bordi (29/30, 14/15, 5/6)
- `listone/parser` — fixture xlsx ufficiale e fixture csv Fanta Club, intestazione non alla prima riga, colonna mancante, righe vuote, foglio `Ceduti`, riuso di un profilo di mapping salvato
- `matching` — accenti, ordine invertito nome/cognome, omonimi, nessun match
- `ai/importa` — **il test che conta di più del ponte**: risposta valida; JSON avvolto in prosa e in un fence markdown (il caso normale in chat); campo obbligatorio mancante → errore che nomina il campo; blocco incollato nello slot sbagliato → rifiutato per id non corrispondente; JSON troncato a metà
- `ai/schemas` — il JSON Schema generato dallo zod contiene tutti i campi obbligatori (è la garanzia che prompt e validatore non divergano)

**E2E (Playwright)** — un flusso che replica l'uso reale:

1. import listone di fixture con mapping guidato → verifica conteggio giocatori
2. crea asta a 8 squadre, 500 crediti, 25 slot, **budget chiuso**
3. assegna 5 giocatori a squadre diverse → verifica crediti residui e max offerta calcolati
4. undo dell'ultimo → verifica che il giocatore torni tra i liberi
5. ricarica la pagina → verifica che lo stato sia integro (merge locale/remoto)
6. simula offline (route blob bloccate) → verifica che le assegnazioni continuino a funzionare e l'indicatore mostri `offline`
7. crea una seconda asta **a sforo** su un listone diverso → porta una squadra oltre il budget → verifica che i crediti vadano in negativo, che lo sforo in euro sia corretto e che scatti l'alert sul tetto di spesa personale
8. apri il generatore di strategia → verifica che il prompt copiato contenga lo schema JSON → incolla una risposta di fixture → verifica che fasce, budget e prezzi max atterrino nella strategia marcati come generati

**Comandi**, come nel progetto esistente:

```bash
npx tsc --noEmit && npm run lint && npm test
npm run build
npm run e2e
```

**Verifica manuale obbligatoria prima dell'asta vera**: simulare 30 assegnazioni consecutive a cronometro. Se una singola assegnazione richiede più di ~2 secondi end-to-end, la schermata d'asta va rivista — è il requisito che determina se lo strumento è davvero usabile sul campo.

---

## Assunzioni da validare

1. **Formato dei listoni.** Le colonne esatte del file `.xlsx` 2026/27 non sono confermabili senza il file in mano, e il formato dell'export di Fanta Club non è documentato pubblicamente. Il mapping guidato in UI è progettato proprio per non doverlo sapere in anticipo, ma **servono entrambi i file come fixture di test** — quello ufficiale e quello che scarichi da Fanta Club.

2. **Tasso di cambio dello sforo.** Il piano assume che i crediti extra si paghino a un tasso fisso configurabile (€ per credito). Se la tua lega usa una formula diversa — scaglioni, quota fissa a prescindere dall'entità, tetto oltre il quale non si può andare — va detto prima della fase 4, perché è nel reducer.
