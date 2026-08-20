import { z } from "zod";
import { RUOLI, type MetricheCalcolate, type RegistroGiocatori } from "@/lib/analisi-live/motore";
import { AnalisiAstaLiveSchema, type RuoloAsta, type StatoAsta } from "@/lib/analisi-live/schemas";

// [C] Prompt al modello, via Ponte IA manuale (§ Analisi decisione live nel
// PLAN.md, non l'API): un'unica stringa da copiare in una chat come Claude —
// stessa convenzione di src/lib/ai/prompts/strategia.ts e dossier.ts. Lo
// schema JSON incluso è derivato a runtime da AnalisiAstaLiveSchema (via
// z.toJSONSchema), la stessa fonte di verità che valida la risposta incollata
// in src/lib/actions/analisi-live.ts — vedi DECISIONI.md.

export const ISTRUZIONI_ANALISTA = `Sei un analista d'asta per il fantacalcio italiano (Serie A, modalità Classic).
Ricevi lo stato di un'asta in corso e un insieme di METRICHE GIÀ CALCOLATE. Cerca sul
web tutto ciò che ti serve (notizie di mercato, infortuni, probabili formazioni,
gerarchie sui rigori, prezzi pagati in altre aste) prima di rispondere: non hai altro
modo per sapere cosa è successo in Serie A oltre a questo prompt.

REGOLE ASSOLUTE
1. Le METRICHE fornite sono esatte e verificate. Riportale invariate. Non ricalcolarle,
   non correggerle, non arrotondarle diversamente. Se un numero ti sembra sbagliato,
   segnalalo in \`alert\` ma NON modificarlo.
2. Il tuo valore aggiunto è il GIUDIZIO: profilare gli avversari, stimare cosa vogliono
   comprare, decidere se rilanciare o lasciare, ricalibrare i tetti.
3. Non inventare giocatori. Usa solo playerId presenti nei dati che ricevi.
4. Non inventare URL. Cita solo fonti che hai davvero trovato cercando sul web.
5. Se un dato ti manca, dillo in \`alert\` invece di riempire il vuoto con una supposizione.
6. Sii concreto e brutale nelle raccomandazioni: l'utente ha 15 secondi per decidere.
   "Rilancia fino a 62, poi lascia" è utile. "Valuta attentamente" non lo è.
7. SII BREVISSIMO OVUNQUE — questo output si legge in asta, con il tempo di un rilancio,
   non a mente fresca. \`sintesi\`: massimo 2 frasi, ~40 parole in tutto. Ogni
   \`note\`/\`motivo\`/\`descrizioneProfilo\`: una riga secca, massimo 15 parole, zero
   subordinate. Non ripetere in \`sintesi\` cose già dette altrove: la sintesi è il
   titolo, il resto è il dettaglio, non un secondo riassunto.
8. Dai priorità, non completezza: restituisci al massimo 5 \`alert\` e al massimo 5
   \`consigliChiamata\`, i più urgenti/azionabili adesso. Se ce ne sarebbero di più,
   scegli e ometti il resto — non è un report, è un pannello di controllo.

SVOLGIMENTO DELL'ASTA (vedi \`lega.svolgimento\` nei dati)
- \`chiamata\`: ogni squadra, a turno, chiama liberamente il giocatore che vuole. I tuoi
  \`consigliChiamata\` dicono cosa dovrei chiamare IO quando arriva il mio turno, per
  anticipare gli avversari o smaltire budget su un reparto favorevole.
- \`ordine\`: il listone scorre in ordine alfabetico a partire dalla lettera indicata,
  senza scelta libera di chi chiamare. I \`consigliChiamata\` qui non sono una scelta
  mia: dicono a quali giocatori del mio piano prepararmi perché stanno per uscire a
  breve nello scorrimento (in base all'ordine alfabetico dei nomi ancora disponibili).
- Se \`lega.svolgimento\` è assente, non è stato specificato: non dare per scontata
  nessuna delle due modalità, resta neutro.

COME PROFILARE UN AVVERSARIO
- \`modificatore-difesa\`: ha speso sopra la media in P+D, oppure ha ≥3 difensori dello
  stesso club o di club di vertice.
- \`attacco-pesante\`: >35% del budget iniziale già speso in attaccanti.
- \`centrocampo-pesante\`: >38% già speso a centrocampo.
- \`risparmiatore\`: creditiPerSlotResiduo nettamente sopra la media di lega — sarà
  pericoloso nel finale, quando gli altri sono a secco.
- \`bruciato\`: potereAcquistoMax basso rispetto ai suoi slot residui di valore. Non è più
  un rivale sui top: sui suoi slot rimasti prenderà solo scarti.
- \`equilibrato\` / \`indeterminato\`: quando i segnali non convergono o i dati sono pochi.
- "NOTE PERSONALI SUGLI AVVERSARI" (se presente per una squadra) è un segnale
  comportamentale in più, non sostitutivo dei dati derivati sopra: un "tifoso di" un
  club è un candidato a sovrapagare i giocatori di quel club (specialmente
  scommesse/panchinari dove il prezzo di mercato è più debole), a prescindere da
  cosa direbbe il suo profilo di spesa da solo. Usalo per \`descrizioneProfilo\` e
  \`obiettiviProbabili\` quando è rilevante — non forzarlo se il resto dei dati lo
  contraddice chiaramente.

LIVELLO DI MINACCIA (per avversario, rispetto ai MIEI obiettivi residui)
- \`critico\`: ha slot liberi sui miei stessi ruoli, potere d'acquisto superiore al mio, e
  un profilo che punta agli stessi giocatori.
- \`alto\`: due delle tre condizioni sopra.
- \`medio\`: una.
- \`basso\`: nessuna ma ha ancora slot aperti.
- \`nullo\`: reparto chiuso o potere d'acquisto insufficiente.

VERDETTO PER SLOT
- \`rilancia-deciso\`: il giocatore vale il tetto e ho margine di budget.
- \`rilancia-con-cautela\`: rilancia ma fermati sotto il tetto; esiste un'alternativa valida.
- \`lascia\`: il prezzo di mercato ha superato quello che questo giocatore vale per il mio piano.
- \`attendi-fine-asta\`: giocatore che si sgonfierà negli ultimi giri, non esporsi ora.
- \`gia-perso\`: già acquistato da un avversario.`;

function annoStagioneCorrente(ora = new Date()): string {
  const anno = ora.getUTCFullYear();
  const primo = ora.getUTCMonth() >= 6 ? anno : anno - 1; // da luglio in poi si e' gia' nella nuova stagione
  return `${primo}/${String((primo + 1) % 100).padStart(2, "0")}`;
}

const REGOLA_LABEL: Record<string, string> = {
  modificatoreDifesa: "modificatore difesa",
  portiereImbattuto: "portiere imbattuto",
  golVittoria: "gol vittoria",
};

function descrizioneSvolgimento(svolgimento: StatoAsta["lega"]["svolgimento"]): string {
  if (!svolgimento) return "non specificato";
  if (svolgimento.tipo === "chiamata") return "a chiamata libera (ogni squadra chiama a turno chi vuole)";
  return `a scorrimento alfabetico, si parte dalla lettera ${svolgimento.letteraIniziale.toUpperCase()}`;
}

function regoleAttive(regole: StatoAsta["lega"]["regolePunteggio"]): string {
  const attive: string[] = [];
  if (regole.modificatoreDifesa) attive.push(REGOLA_LABEL.modificatoreDifesa);
  if (regole.portiereImbattuto) attive.push(REGOLA_LABEL.portiereImbattuto);
  if (regole.golVittoria) attive.push(REGOLA_LABEL.golVittoria);
  if (regole.altro) attive.push(regole.altro);
  return attive.length > 0 ? attive.join(", ") : "nessuna regola speciale segnalata";
}

function nomeGiocatore(id: number, registro: RegistroGiocatori): string {
  return registro.get(id)?.nome ?? `#${id}`;
}

function tabellaRosa(rosa: StatoAsta["miaSquadra"]["rosa"], registro: RegistroGiocatori): string {
  if (rosa.length === 0) return "(nessun acquisto ancora)";
  const righe = rosa.map((r) => {
    const info = registro.get(r.playerId);
    return `| ${info?.ruolo ?? "?"} | ${info?.nome ?? `#${r.playerId}`} | ${info?.club ?? "?"} | ${info?.quotazione ?? "?"} | ${r.prezzoPagato} |`;
  });
  return ["| ruolo | nome | club | quotazione | prezzoPagato |", "|---|---|---|---|---|", ...righe].join("\n");
}

function elencoCompattoRosa(rosa: StatoAsta["miaSquadra"]["rosa"], registro: RegistroGiocatori): string {
  if (rosa.length === 0) return "(nessun acquisto)";
  return rosa
    .map((r) => {
      const info = registro.get(r.playerId);
      return `${info?.nome ?? `#${r.playerId}`}(${info?.ruolo ?? "?"}, ${info?.club ?? "?"}) @${r.prezzoPagato}`;
    })
    .join(", ");
}

/** Ruoli chiusi per TUTTE le squadre in gioco — si omettono dalla sezione "altri disponibili". */
function ruoliChiusiPerTutti(metriche: MetricheCalcolate): Set<RuoloAsta> {
  const chiusi = new Set<RuoloAsta>();
  for (const ruolo of RUOLI) {
    const mieChiuso = metriche.mia.slotResidui[ruolo] === 0;
    const tuttiAvversariChiusi = metriche.avversari.every((a) => a.derivata.slotResidui[ruolo] === 0);
    if (mieChiuso && tuttiAvversariChiusi) chiusi.add(ruolo);
  }
  return chiusi;
}

function costruisciAltriDisponibili(stato: StatoAsta, metriche: MetricheCalcolate, limitePerRuolo: number): string {
  const disponibili = stato.listoneDisponibili ?? [];
  if (disponibili.length === 0) return "(nessun giocatore disponibile fornito)";

  const omessi = ruoliChiusiPerTutti(metriche);
  const stimePerId = new Map(metriche.stimeGiocatori.map((s) => [s.playerId, s]));

  const idCitatiNelPiano = new Set<number>();
  for (const so of stato.pianoIniziale.slotObiettivi ?? []) {
    if (so.obiettivoPrincipale != null) idCitatiNelPiano.add(so.obiettivoPrincipale);
    for (const alt of so.alternative ?? []) idCitatiNelPiano.add(alt);
  }
  for (const pm of stato.pianoIniziale.prezziMassimi ?? []) idCitatiNelPiano.add(pm.playerId);

  const righe: string[] = ["| ruolo | nome | club | quotazione | prezzoStimatoMercato |", "|---|---|---|---|---|"];
  for (const ruolo of RUOLI) {
    if (omessi.has(ruolo)) continue;
    const delRuolo = disponibili.filter((g) => g.ruolo === ruolo).sort((a, b) => b.quotazione - a.quotazione);
    const top = delRuolo.slice(0, limitePerRuolo);
    const citatiFuoriTop = delRuolo.filter((g) => idCitatiNelPiano.has(g.id) && !top.includes(g));
    for (const g of [...top, ...citatiFuoriTop]) {
      const stima = stimePerId.get(g.id);
      righe.push(`| ${g.ruolo} | ${g.nome} | ${g.club} | ${g.quotazione} | ${stima?.prezzoStimato ?? "?"} |`);
    }
  }
  return righe.join("\n");
}

function sezioneObiettivi(stato: StatoAsta, metriche: MetricheCalcolate, registro: RegistroGiocatori): string {
  const slotObiettivi = stato.pianoIniziale.slotObiettivi ?? [];
  if (slotObiettivi.length === 0) return "(nessuno slot obiettivo nel piano iniziale)";

  const prezziMassimi = new Map((stato.pianoIniziale.prezziMassimi ?? []).map((p) => [p.playerId, p.valore]));
  const stimePerId = new Map(metriche.stimeGiocatori.map((s) => [s.playerId, s]));
  const idDisponibili = new Set((stato.listoneDisponibili ?? []).map((g) => g.id));

  return slotObiettivi
    .map((so) => {
      const obiettivo = so.obiettivoPrincipale;
      const tetto = obiettivo != null ? (prezziMassimi.get(obiettivo) ?? "n/d") : "n/d";
      const stima = obiettivo != null ? stimePerId.get(obiettivo) : undefined;
      const nomeObiettivo = obiettivo != null ? nomeGiocatore(obiettivo, registro) : "nessuno";
      const disponibile = obiettivo != null ? idDisponibili.has(obiettivo) : false;
      const alternative = (so.alternative ?? []).map((id) => nomeGiocatore(id, registro)).join(", ") || "nessuna";
      return `- ${so.ruolo} slot #${so.indiceSlot}: obiettivo ${nomeObiettivo} (id ${obiettivo ?? "-"}, ${disponibile ? "ACQUISTABILE" : "GIA PRESO — fuori dall asta"}), tetto attuale ${tetto}, prezzoStimatoMercato ${stima?.prezzoStimato ?? "?"}, nRivaliAttivi ${stima?.nRivaliAttivi ?? "?"}, alternative: ${alternative}`;
    })
    .join("\n");
}

/**
 * Solo gli avversari con almeno un campo compilato (§ Impostazioni asta nel
 * piano) — la maggior parte delle leghe non arriva a compilarli tutti, e non
 * ha senso riempire il prompt di righe vuote "nessuna nota".
 */
function sezioneNotePersonali(stato: StatoAsta): string {
  const righe = stato.avversari
    .filter((a) => a.allenatore || a.squadraDelCuore || a.note)
    .map((a) => {
      const dettagli: string[] = [];
      if (a.allenatore) dettagli.push(`allenatore: ${a.allenatore}`);
      if (a.squadraDelCuore) dettagli.push(`tifoso di: ${a.squadraDelCuore}`);
      if (a.note) dettagli.push(`note: ${a.note}`);
      return `- ${a.nome} — ${dettagli.join(" · ")}`;
    });
  return righe.length > 0 ? righe.join("\n") : "(nessuna nota personale compilata su nessun avversario)";
}

function sezioneAvversari(metriche: MetricheCalcolate): string {
  const righe = metriche.avversari.map((a) => {
    const d = a.derivata;
    const slot = `P${d.slotResidui.P}/D${d.slotResidui.D}/C${d.slotResidui.C}/A${d.slotResidui.A}`;
    const chiusi = d.repartiChiusi.join(",") || "nessuno";
    const blocchi = d.blocchiClub.map((b) => `${b.club}×${b.conteggio}`).join(", ") || "nessuno";
    return `| ${a.nome} | ${d.creditiResidui} | ${d.potereAcquistoMax} | ${d.creditiPerSlotResiduo.toFixed(1)} | ${slot} | ${chiusi} | ${blocchi} |`;
  });
  return [
    "| squadra | creditiResidui | potereAcquistoMax | creditiPerSlotResiduo | slotResidui P/D/C/A | repartiChiusi | blocchiClub |",
    "|---|---|---|---|---|---|---|",
    ...righe,
  ].join("\n");
}

const LIMITE_CARATTERI_PROMPT_LUNGO = 240_000; // ~60k token euristici (4 char/token)

/**
 * Prompt unico da copiare in una chat (§ Analisi decisione live nel PLAN.md —
 * Ponte IA manuale, non l'API): istruzioni + dati + schema JSON atteso, tutto
 * in una stringa, esattamente come buildPromptStrategia/buildPromptDossier.
 */
export function costruisciPromptAnalisiLive(stato: StatoAsta, metriche: MetricheCalcolate, registro: RegistroGiocatori): string {
  const lega = stato.lega;

  const corpo = `## LEGA
${lega.nSquadre} squadre · budget ${lega.budget} · slot P${lega.slot.P} D${lega.slot.D} C${lega.slot.C} A${lega.slot.A} · ${lega.modalita}
Svolgimento: ${descrizioneSvolgimento(lega.svolgimento)}
Regole rilevanti: ${regoleAttive(lega.regolePunteggio)}
Nota scala: la colonna "quotazione"/"quotazioneAttuale" nelle tabelle qui sotto è il valore di
listino (convenzione standard editoriale, in genere tarata su una lega da 500 crediti a
squadra) — NON è il prezzo in crediti di QUESTA lega, che ha un budget di ${lega.budget}. I
campi prezzoStimatoMercato/mioTettoAggiornato dentro METRICHE sono già ricalcolati sulla scala
reale di questa lega: usa quelli per ragionare sul prezzo vero, mai la quotazione grezza.
Fase corrente: ${stato.fase}
Stagione corrente per la ricerca web: ${annoStagioneCorrente()}

## IL MIO PIANO INIZIALE
${JSON.stringify(stato.pianoIniziale, null, 2)}

## LA MIA ROSA ATTUALE
${tabellaRosa(stato.miaSquadra.rosa, registro)}
Crediti residui: ${metriche.mia.creditiResidui} · Slot residui: P${metriche.mia.slotResidui.P} D${metriche.mia.slotResidui.D} C${metriche.mia.slotResidui.C} A${metriche.mia.slotResidui.A}

## METRICHE CALCOLATE — ESATTE, NON RICALCOLARE
### Mercato
moltiplicatoreMedio: ${metriche.mercato.moltiplicatoreMedio ?? "n/d (nessun acquisto concluso)"}
moltiplicatorePerFascia: ${metriche.mercato.moltiplicatorePerFascia
    .map((f) => `${f.fascia} ${f.moltiplicatore.toFixed(2)}x (campione ${f.campione}${f.affidabile ? "" : ", INAFFIDABILE"})`)
    .join(" · ")}
creditiResiduiLega: ${metriche.mercato.creditiResiduiLega} · slotResiduiLega: ${metriche.mercato.slotResiduiLega} · prezzoMedioResiduo: ${metriche.mercato.prezzoMedioResiduo.toFixed(1)}
pressione per ruolo: ${metriche.mercato.indicePressione.map((p) => `${p.ruolo} ${p.creditiPerSlot.toFixed(1)}/slot`).join(" · ")}

### Avversari
${sezioneAvversari(metriche)}

### Note personali sugli avversari
${sezioneNotePersonali(stato)}

### Rose avversarie
${stato.avversari.map((a) => `- ${a.nome}: ${elencoCompattoRosa(a.rosa, registro)}`).join("\n")}

## I MIEI SLOT E I LORO OBIETTIVI
Ogni riga dice se l obiettivo di quello slot e ancora acquistabile. Per gli slot marcati
GIA PRESO il giocatore non e piu in asta: non proporlo in consigliChiamata, non
aggiornargli il prezzo massimo, usa verdetto "gia-perso" e ragiona sulle alternative.
${sezioneObiettivi(stato, metriche, registro)}

## ALTRI DISPONIBILI RILEVANTI
${costruisciAltriDisponibili(stato, metriche, 25)}`;

  // Riduzione "altri disponibili" da 25 a 12 per ruolo se il prompt e' troppo lungo (§6.2 della spec originale).
  const corpoFinale =
    corpo.length <= LIMITE_CARATTERI_PROMPT_LUNGO
      ? corpo
      : corpo.replace(
          `## ALTRI DISPONIBILI RILEVANTI\n${costruisciAltriDisponibili(stato, metriche, 25)}`,
          `## ALTRI DISPONIBILI RILEVANTI\n${costruisciAltriDisponibili(stato, metriche, 12)}`,
        );

  return `${ISTRUZIONI_ANALISTA}

${corpoFinale}

## COMPITO
Rispondi SOLO con un blocco JSON conforme a questo schema (nessun testo prima o dopo il blocco):

\`\`\`json
${JSON.stringify(z.toJSONSchema(AnalisiAstaLiveSchema), null, 2)}
\`\`\`
`;
}
