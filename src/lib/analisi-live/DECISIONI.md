# Decisioni — Analisi Asta Live

Questo file documenta le scelte prese dove la spec (`analisi-asta-live-spec.zip`)
lasciava spazio, come richiesto dalla spec stessa ("Se qualcosa non è
specificato, scegli tu e documenta la scelta in un `DECISIONI.md`").

## Pivot: Ponte IA manuale invece dell'API (deciso dall'utente, non dalla spec)

La spec originale del modulo era esplicita: l'analisi decisione live è "l'unica
funzione che richiede l'API" perché il ciclo copia-incolla (30-60s) non regge
i ~20s di una chiamata d'asta (§5 della spec, §Analisi decisione live nel
PLAN.md). La prima versione di questo modulo implementava esattamente questo:
`client.ts` chiamava `messages.parse` con output strutturato, `ricerca.ts`
usava il tool `web_search` di Claude con cache/timeout/budget dedicati,
`pipeline.ts` orchestrava tutto con fallback su un output solo-deterministico
in caso di doppio fallimento.

L'utente ha esplicitamente richiesto il contrario: **nessuna chiamata API**,
lo stesso Ponte IA manuale (genera prompt → copia in chat → incolla risposta →
valida) già usato da tutto il resto dell'app per strategia e dossier. Ho
rimosso `client.ts`, `ricerca.ts`, `pipeline.ts`, `output-deterministico.ts` e
la route `src/app/api/analisi-live/route.ts` (con la dipendenza
`@anthropic-ai/sdk`, rimasta altrimenti inutilizzata), e ho rifatto `prompt.ts`
per produrre un'unica stringa (istruzioni + dati + schema JSON atteso, come
`src/lib/ai/prompts/strategia.ts`) invece di un system+user prompt pensato per
una chiamata API. La ricerca web non è più pre-fetchata da questo modulo: è la
chat in cui l'utente incolla il prompt a cercare sul web da sé (stessa
convenzione di `buildPromptStrategia`), quindi anche il filtro §5.5 sulle
fonti citate ("scarta gli URL non presenti nei risultati di ricerca grezzi")
non ha più un insieme di risultati grezzi con cui confrontarsi — vedi la voce
dedicata più sotto.

Il resto del modulo (motore deterministico, schemi, riconciliazione,
validazione) non cambia: la garanzia "l'aritmetica la fa il codice" vale
identica sia che il JSON arrivi da una chiamata API sia che arrivi incollato
da una chat — è per questo che il pivot ha toccato solo il layer di
generazione/raccolta della risposta, non il cuore del modulo.

## Confini del modulo e integrazione UI

Il motore/schemi/riconciliazione restano "autonomi" nel senso letterale: vivono
in `src/lib/analisi-live/`, non importano nulla da `src/lib/blob/*` e non
conoscono `astaId`/`SetupDoc`/Blob. Ricevono `StatoAsta` (il contratto di
`input.schema.json`) e restituiscono `AnalisiAstaLive` (`output.schema.json`).

`src/lib/analisi-live/adapter-blob.ts` è l'unico file che conosce ENTRAMBI i
mondi: traduce `SetupDoc`/`AstaState`/`Player`/`StrategyDoc` (Blob) in
`StatoAsta` + `GiocatoreInfo[]`. `src/lib/actions/analisi-live.ts` (server
actions `generaPromptAnalisiLive`/`applicaAnalisiLive`, Ponte IA manuale) e
`src/components/asta/analisi-live-dialog.tsx` (dialog dal tab Listone
dell'asta, `AnalisiLiveButton`) sono il layer di prodotto sopra l'adapter.

Le regole di punteggio di lega (modificatore difesa, portiere imbattuto...)
non sono ancora persistite in nessun documento Blob esistente: `lega.regolePunteggio`
arriva sempre `{}` dall'adapter. È un gap di modellazione dati preesistente
nel progetto, non qualcosa che questo modulo doveva risolvere.

## Il registro giocatori non è nel contratto JSON

`input.schema.json` porta `ruolo`/`club`/`quotazione` solo per
`listoneDisponibili` (i giocatori ancora liberi, già potati). Le rose (mia e
avversari) hanno solo `{playerId, prezzoPagato}` — niente ruolo. Ma il motore
deterministico (§4.1) deve sapere il ruolo di OGNI giocatore assegnato per
calcolare `slotOccupati` e `blocchiClub`.

Ho risolto passando un secondo parametro esplicito a ogni funzione del motore:
`RegistroGiocatori` (`Map<number, {id, ruolo, nome, club, quotazione}>`), che il
chiamante costruisce a partire dal proprio listone completo (Blob, nel caso
dell'app) prima di invocare `analizza()`. `valida.ts` rifiuta con 400 se un
`playerId` di una rosa non è nel registro. Alternative scartate: (a) richiedere
che `StatoAsta` porti un listone completo — contraddice esplicitamente "il
parser cerca... non passare 600 giocatori al modello" (§3.1); (b) far lavorare
il motore "alla cieca" sui soli id — impossibile calcolare `slotOccupati` per
ruolo.

## `mercato.moltiplicatoreMedio`: `null` internamente, `0` in output

§4.2 dice esplicitamente "con denominatore 0, restituisci `null`". Ma
`output.schema.json` tipizza `moltiplicatoreMedio` come `number` (non
nullable) — un contrasto letterale tra il testo della spec e il JSON Schema
normativo che la accompagna. Ho risolto tenendo `null` internamente
(`MercatoDerivato.moltiplicatoreMedio: number | null`, usato per la catena di
fallback in §4.4) e sostituendolo con `0` solo nel passo di riconciliazione
[D], con un `alert` `info` che spiega perché. Stessa logica per
`moltiplicatorePerFascia[].moltiplicatore` quando il bucket è vuoto (già `0` di
suo, nessun conflitto lì).

## §4.4 — `moltiplicatoreDiPiano`, ultimo anello della catena di fallback

La spec dice solo "budget/Σquot dei target del piano". Ho interpretato "target
del piano" come l'unione di `pianoIniziale.slotObiettivi[].obiettivoPrincipale`
+ `.alternative` + tutti i `pianoIniziale.prezziMassimi[].playerId`, e "budget"
come la somma di `pianoIniziale.budgetReparto` sui 4 ruoli. Se questo insieme è
vuoto o non risolvibile nel registro (piano iniziale senza target, o giocatori
di piano già scomparsi dal registro), il fallback finale è `1` (moltiplicatore
neutro) — non c'è nessun altro segnale osservato a cui aggrapparsi.

## §4.5 — un reparto chiuso non riceve budget residuo

La formula di §4.5 (`residuoTeorico(r) = max(0, pesoIniziale(r) - spesoDaMe(r))`)
non menziona esplicitamente i reparti chiusi, ma la frase introduttiva dice
"ripartizione del residuo **sui reparti ancora aperti**". Ho forzato
`residuoTeorico(r) = 0` quando `slotResidui(mia, r) === 0`, anche se
`pesoIniziale(r) - spesoDaMe(r)` sarebbe positivo (es. ho chiuso un reparto
spendendo meno del preventivato): non ha senso allocare altro budget a un
reparto dove non posso più comprare nulla.

## §7.1 I4/I5 — "non-chiamare" su un giocatore escluso/già preso è l'uso corretto

L'esempio normativo (`esempio-output.json`) include
`{"playerId": 4312, "tipo": "non-chiamare", "motivo": "Già acquistato da Verdi
United, ed è comunque nei tuoi esclusi."}` — cioè un `consiglioChiamata` che
cita ESPLICITAMENTE un giocatore che I4/I5 vorrebbero scartare. Applicare gli
invarianti alla lettera avrebbe rotto l'esempio fornito dalla spec stessa.

Ho quindi interpretato I4/I5 come applicabili solo alle raccomandazioni
**azionabili** (`chiama-ora`, `brucia-crediti`, `aspetta-fine`) e a
`slotObiettivi`/`prezziMassimi` (dove non esiste un tipo "non-chiamare" — sono
sempre target da perseguire, quindi lì il filtro resta incondizionato). Un
`consiglioChiamata` di tipo `non-chiamare` su un giocatore escluso o già preso
non viene mai scartato: è esattamente il segnale utile che deve arrivare
all'utente.

## Budget chiuso vs. sforo: il contratto non porta il tasso €/credito

`lega.budgetChiuso` è nello schema, ma nessun campo €/credito lo accompagna
(a differenza di `RegoleSforo` nei documenti Blob del progetto, vedi PLAN.md §
Modalità sforo). Ho trattato questo come intenzionale: il modulo lavora
**solo in crediti**, mai in euro — coerente col fatto che nessun campo
`sforoEuro` compare in `output.schema.json`. La validazione di §8 ("Somma
prezzi > budget → errore") si applica quindi solo quando `lega.budgetChiuso ===
true`; se `false` (sforo) o assente, lo sforamento è ammesso senza errore,
esattamente come nel resto dell'app (vedi `PLAN.md` § Modalità sforo).

## Ricerca web: fatta dalla chat, non da questo modulo

Dopo il pivot al Ponte IA manuale (vedi sopra), §5 della spec (query template,
cache, budget, prefetch, degradazione) non si applica più: non è questo
modulo a cercare sul web, è la chat in cui l'utente incolla il prompt — la
stessa cosa che già fa `buildPromptStrategia`. `costruisciPromptAnalisiLive`
si limita a istruire il modello a cercare da sé e a citare solo URL trovati
davvero (regola 4 del prompt), niente di più. Di conseguenza `meta.fonti` non
viene più filtrato contro un insieme di risultati grezzi noti (vedi la voce
successiva): non esiste più un insieme del genere da questo lato.

## `riconcilia()`: `urlRicercaGrezzi` nullable, non più un `Set` obbligatorio

§5.5/§7 chiedono di scartare dall'output le fonti citate dal modello ma non
presenti nei risultati di ricerca grezzi — sensato quando è il codice a
lanciare le query. Nel Ponte IA manuale non esiste un insieme di risultati
grezzi da controllare: la risposta arriva incollata da una chat che un umano
ha già letto prima di riportarla nell'app. `riconcilia()` accetta quindi
`urlRicercaGrezzi: Set<string> | null` — `null` (il caso reale, usato da
`applicaAnalisiLive`) salta il filtro e si fida delle fonti citate; un `Set`
esplicito (usato solo nei test, a documentare il comportamento originale)
filtra come da spec. Tutto il resto della riconciliazione (§7: sovrascrittura
numeri, clamp tetti, invarianti I1-I10) resta identico indipendentemente da
come è arrivata la risposta.

## Persistenza storico e `scripts/analisi-live/calibra.ts`

`registraStatoAsta()` scrive ogni `StatoAsta` costruito dall'adapter + il
registro su `.data/analisi-live/storico/` (fire-and-forget, non awaited),
chiamata da `generaPromptAnalisiLive` ogni volta che si genera un prompt —
resta il momento in cui il modulo ha in mano lo snapshot più fresco, a
prescindere dal fatto che la risposta arrivi via API o incollata. `calibra.ts` è un
**punto di partenza**, non un tuner automatico: aggrega i moltiplicatori per
fascia sull'ultimo snapshot di ogni asta distinta e li stampa a confronto con
`FASCE_QUOTAZIONE` in `config.ts`. Non tocca `config.ts` da solo — la
spec chiede di "proporre", non di applicare in automatico coefficienti che
un'unica sessione di calibrazione potrebbe sballare. La calibrazione dei
coefficienti di scarsità (`SCARSITA_COEFF_*`) richiederebbe di confrontare
`prezzoStimato` con il prezzo realmente pagato sugli stessi giocatori in aste
successive — non automatizzata in questa prima versione, segnalato a fine
script.

## Test coverage

Ho dato priorità a `motore.ts` (§10: "deve essere corretto al 100%, è il
cuore del valore") con test su tutti gli 8 casi di §9 più alcuni aggiuntivi
(blocchi club, playerId mancanti dal registro). Su `riconciliazione.ts` ho
coperto i 5 casi più specifici e a più alto rischio di regressione silenziosa
(9-13) più il pass-through con `urlRicercaGrezzi: null` introdotto dal pivot.
`schemas.ts` è testato contro i due fixture normativi
(`esempio-input.json`/`esempio-output.json`) invece che con dati sintetici,
così un drift tra `schemas.ts` e i JSON Schema forniti si vede subito.
`adapter-blob.ts` ha test propri (mia squadra/avversari, potatura dei
disponibili, registro completo, budgetChiuso da `sforo.tipo`). Non ho scritto
golden test end-to-end (15-18 della spec originale, pensati per una pipeline
API con modello mockato) né test sul dialog React: il flusso copia/incolla si
verifica più realisticamente a mano nell'app, come per `GeneraStrategiaClient`,
che non ha nemmeno lui test end-to-end.
