import type { MetricheCalcolate, RegistroGiocatori } from "@/lib/analisi-live/motore";
import type { Alert, AnalisiAstaLive, AvversarioAnalizzato, MinacciaPerSlot, PianoAggiornato, StatoAsta } from "@/lib/analisi-live/schemas";

// [D] Validazione e riconciliazione (§7 della spec). L'output del modello è
// già passato attraverso lo schema (AnalisiAstaLiveSchema) prima di arrivare
// qui — questo modulo si occupa solo del passo successivo: sovrascrivere ogni
// campo aritmetico con i valori esatti di [A], clampare i tetti, e far
// rispettare gli invarianti §7.1 correggendo in codice + alert quando violati.

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Chi è già stato aggiudicato, a chiunque: le rose avversarie E la mia. Il
 * filtro guardava solo gli avversari, quindi un giocatore che avevo già
 * comprato io restava un bersaglio valido e tornava nei consigli di chiamata
 * e nei prezzi massimi come se fosse ancora all'asta.
 */
function giocatoriAssegnati(stato: StatoAsta): Map<number, "mia" | "avversario"> {
  const assegnati = new Map<number, "mia" | "avversario">();
  for (const s of stato.avversari) {
    for (const r of s.rosa) assegnati.set(r.playerId, "avversario");
  }
  // La mia rosa per ultima: se un id comparisse in entrambe (input incoerente)
  // vince "mia", che è il messaggio più utile da leggere.
  for (const r of stato.miaSquadra.rosa) assegnati.set(r.playerId, "mia");
  return assegnati;
}

function motivoAssegnato(dove: "mia" | "avversario"): string {
  return dove === "mia" ? "già nella tua rosa" : "già acquistato da un avversario";
}

function scartatoAlert(playerId: number, motivo: string): Alert {
  return {
    gravita: "attenzione",
    messaggio: `Il modello aveva indicato il giocatore ${playerId}, ma è ${motivo}: scartato dal piano aggiornato.`,
    azione: "Nessuna correzione necessaria — non è un obiettivo valido.",
  };
}

function riconciliaMercato(mercato: AnalisiAstaLive["mercato"], metriche: MetricheCalcolate): AnalisiAstaLive["mercato"] {
  return {
    ...mercato,
    // §4.2: null internamente quando non c'e' ancora nessun acquisto concluso,
    // ma lo schema di output non ammette null qui — sostituito con 0 (vedi
    // DECISIONI.md). L'alert corrispondente e' aggiunto dal chiamante.
    moltiplicatoreMedio: metriche.mercato.moltiplicatoreMedio ?? 0,
    moltiplicatorePerFascia: metriche.mercato.moltiplicatorePerFascia.map(({ fascia, quotMin, quotMax, moltiplicatore, campione }) => ({
      fascia,
      quotMin,
      quotMax,
      moltiplicatore,
      campione,
    })),
    creditiResiduiLega: metriche.mercato.creditiResiduiLega,
    slotResiduiLega: metriche.mercato.slotResiduiLega,
    prezzoMedioResiduo: metriche.mercato.prezzoMedioResiduo,
    indicePressione: metriche.mercato.indicePressione,
    // scostamentoVsPiano resta il giudizio del modello.
  };
}

function riconciliaAvversari(
  modello: AvversarioAnalizzato[],
  stato: StatoAsta,
  metriche: MetricheCalcolate,
  registro: RegistroGiocatori,
  alert: Alert[],
): AvversarioAnalizzato[] {
  const daModello = new Map(modello.map((a) => [a.squadra, a]));
  const idDisponibili = new Set((stato.listoneDisponibili ?? []).map((g) => g.id));

  // I7: un elemento per ogni squadra avversaria in input, esattamente — si
  // ricostruisce l'array dalla lega (metriche.avversari rispecchia
  // 1:1 stato.avversari), non da quello restituito dal modello.
  return metriche.avversari.map(({ nome, derivata }) => {
    const m = daModello.get(nome);
    if (!m) {
      alert.push({
        gravita: "attenzione",
        messaggio: `Il modello non ha profilato l'avversario "${nome}": sostituito con un profilo neutro.`,
        azione: "Rilancia l'analisi se questo avversario è rilevante per i tuoi obiettivi residui.",
      });
    }

    const obiettiviProbabili = (m?.obiettiviProbabili ?? []).filter((o) => {
      if (!registro.has(o.playerId)) return false;
      if (!idDisponibili.has(o.playerId)) return false;
      return true;
    });

    return {
      squadra: nome,
      creditiResidui: derivata.creditiResidui,
      slotResidui: derivata.slotResidui,
      potereAcquistoMax: derivata.potereAcquistoMax,
      creditiPerSlotResiduo: derivata.creditiPerSlotResiduo,
      repartiChiusi: derivata.repartiChiusi,
      blocchiClub: derivata.blocchiClub,
      profilo: m?.profilo ?? "indeterminato",
      descrizioneProfilo: m?.descrizioneProfilo ?? "Dati insufficienti per un profilo affidabile.",
      livelloMinaccia: m?.livelloMinaccia ?? (derivata.slotResiduiTotali === 0 ? "nullo" : "basso"),
      obiettiviProbabili,
    };
  });
}

function filtraObiettivo(
  id: number | null,
  registro: RegistroGiocatori,
  esclusi: Set<number>,
  assegnati: Map<number, "mia" | "avversario">,
  alert: Alert[],
): number | null {
  if (id === null) return null;
  if (!registro.has(id)) {
    alert.push(scartatoAlert(id, "non presente nel listone"));
    return null;
  }
  if (esclusi.has(id)) {
    alert.push(scartatoAlert(id, "nei tuoi esclusi (vincoli.esclusi)"));
    return null;
  }
  const dove = assegnati.get(id);
  if (dove) {
    alert.push(scartatoAlert(id, motivoAssegnato(dove)));
    return null;
  }
  return id;
}

function riconciliaPiano(
  piano: PianoAggiornato,
  metriche: MetricheCalcolate,
  registro: RegistroGiocatori,
  stato: StatoAsta,
  alert: Alert[],
): PianoAggiornato {
  const { creditiResiduiMiei, budgetResiduoReparto, slotResidui, riservaMinima } = metriche.pianoRicalibrato;
  // §7 step 3: nessun tetto puo' superare creditiResiduiMiei - riservaMinima + 1.
  // Il Math.max(0, ...) qui garantisce tettoMassimo >= 0 sempre, cosi' il clamp
  // sotto non puo' mai produrre un valore negativo (violerebbe lo schema).
  const tettoMassimo = Math.max(0, creditiResiduiMiei - riservaMinima + 1);

  const esclusi = new Set(stato.vincoli?.esclusi ?? []);
  const assegnati = giocatoriAssegnati(stato);

  const prezziMassimiAggiornati = piano.prezziMassimiAggiornati
    .filter((p) => filtraObiettivo(p.playerId, registro, esclusi, assegnati, alert) !== null)
    .map((p) => {
      const valore = clamp(p.valore, 0, tettoMassimo);
      return { ...p, valore, delta: valore - (p.valorePrecedente ?? 0) };
    });

  const slotObiettiviAggiornati = piano.slotObiettiviAggiornati.map((so) => ({
    ...so,
    obiettivoPrincipale: filtraObiettivo(so.obiettivoPrincipale, registro, esclusi, assegnati, alert),
    alternative: so.alternative.filter((id) => registro.has(id) && !esclusi.has(id) && !assegnati.has(id)),
  }));

  return { creditiResiduiMiei, budgetResiduoReparto, slotResidui, riservaMinima, prezziMassimiAggiornati, slotObiettiviAggiornati };
}

function riconciliaMinacce(
  minacce: MinacciaPerSlot[],
  stato: StatoAsta,
  metriche: MetricheCalcolate,
  piano: PianoAggiornato,
  alert: Alert[],
): MinacciaPerSlot[] {
  const slotObiettivi = stato.pianoIniziale.slotObiettivi ?? [];
  const idDisponibili = new Set((stato.listoneDisponibili ?? []).map((g) => g.id));
  const stimePerId = new Map(metriche.stimeGiocatori.map((s) => [s.playerId, s]));
  const tettoMassimo = Math.max(0, piano.creditiResiduiMiei - piano.riservaMinima + 1);
  const daModello = new Map(minacce.map((m) => [`${m.ruolo}#${m.indiceSlot}`, m]));

  // I8: minaccePerSlot deve coprire tutti i miei slot ancora vuoti — si
  // ricostruisce dagli slotObiettivi del piano iniziale (la fonte di verità
  // su "quali sono i miei slot"), non dall'array restituito dal modello.
  return slotObiettivi.map((so) => {
    const chiave = `${so.ruolo}#${so.indiceSlot}`;
    const m = daModello.get(chiave);
    const playerId = so.obiettivoPrincipale ?? null;
    const disponibile = playerId != null && idDisponibili.has(playerId);
    const stima = playerId != null ? stimePerId.get(playerId) : undefined;
    const nRivaliAttivi = stima?.nRivaliAttivi ?? 0;
    const prezzoStimatoMercato = stima?.prezzoStimato ?? 0;

    if (!m) {
      alert.push({
        gravita: "info",
        messaggio: `Nessuna valutazione del modello per lo slot ${chiave}: aggiunta una minaccia neutra.`,
        azione: "Nessuna correzione necessaria.",
      });
    }

    return {
      ruolo: so.ruolo,
      indiceSlot: so.indiceSlot,
      playerId,
      disponibile,
      nRivaliAttivi,
      rivaliPrincipali: m?.rivaliPrincipali ?? [],
      prezzoStimatoMercato,
      mioTettoAggiornato: clamp(m?.mioTettoAggiornato ?? prezzoStimatoMercato, 0, tettoMassimo),
      verdetto: m?.verdetto ?? (disponibile ? "rilancia-con-cautela" : "gia-perso"),
      note: m?.note ?? "Valutazione automatica: nessun giudizio del modello disponibile per questo slot.",
    };
  });
}

function filtraConsigli(
  consigli: AnalisiAstaLive["consigliChiamata"],
  stato: StatoAsta,
  registro: RegistroGiocatori,
  alert: Alert[],
): AnalisiAstaLive["consigliChiamata"] {
  const esclusi = new Set(stato.vincoli?.esclusi ?? []);
  const assegnati = giocatoriAssegnati(stato);

  return consigli.filter((c) => {
    if (!registro.has(c.playerId)) {
      alert.push(scartatoAlert(c.playerId, "non presente nel listone"));
      return false;
    }
    // "non-chiamare" su un giocatore escluso o già preso da un avversario è
    // l'uso corretto del campo (vedi esempio-output.json, playerId 4312: "già
    // acquistato... ed è comunque nei tuoi esclusi") — I4/I5 scartano solo le
    // raccomandazioni AZIONABILI (chiama-ora / brucia-crediti / aspetta-fine)
    // su quei giocatori, non gli avvisi di "non chiamarlo". Vedi DECISIONI.md.
    if (c.tipo === "non-chiamare") return true;
    if (esclusi.has(c.playerId)) {
      alert.push(scartatoAlert(c.playerId, "nei tuoi esclusi (vincoli.esclusi)"));
      return false;
    }
    const dove = assegnati.get(c.playerId);
    if (dove) {
      alert.push(scartatoAlert(c.playerId, motivoAssegnato(dove)));
      return false;
    }
    return true;
  });
}

export function riconcilia(
  output: AnalisiAstaLive,
  stato: StatoAsta,
  metriche: MetricheCalcolate,
  registro: RegistroGiocatori,
  // Set di URL effettivamente visti in risultati di ricerca grezzi, quando
  // disponibili (§5.5: "filtra gli URL che non compaiono nei risultati di
  // ricerca grezzi"). null = nessun risultato grezzo da controllare — il caso
  // del Ponte IA manuale (§ Analisi decisione live nel PLAN.md): la risposta
  // arriva incollata da una chat dove un umano l'ha già letta prima di
  // riportarla qui, quindi le fonti citate si accettano così come sono.
  urlRicercaGrezzi: Set<string> | null,
): AnalisiAstaLive {
  const alert: Alert[] = [...output.alert];

  for (const d of metriche.discrepanzeCreditiDichiarati) {
    alert.push({
      gravita: "attenzione",
      messaggio: `"${d.nome}" aveva dichiarato ${d.dichiarati} crediti residui, il calcolo interno ne dà ${d.calcolati}: probabile acquisto dimenticato nell'input.`,
      azione: "Verifica la rosa dichiarata per questa squadra — usato il valore calcolato.",
    });
  }
  if (metriche.pianoRicalibrato.fallbackSforatoOvunque) {
    alert.push({
      gravita: "critico",
      messaggio: "Il budget pianificato per reparto è già interamente speso su ogni reparto ancora aperto: la ripartizione residua è stata fatta proporzionalmente agli slot rimasti, non al piano originale.",
      azione: "Rivedi manualmente le priorità residue: il piano iniziale non è più una guida affidabile qui.",
    });
  }
  if (metriche.mercato.moltiplicatoreMedio === null) {
    alert.push({
      gravita: "info",
      messaggio: "Nessun acquisto ancora concluso in lega: il moltiplicatore medio non è calcolabile, mostrato come 0.",
      azione: "Nessuna correzione necessaria — si aggiorna dopo i primi acquisti.",
    });
  }

  const mercato = riconciliaMercato(output.mercato, metriche);
  const avversari = riconciliaAvversari(output.avversari, stato, metriche, registro, alert);
  const pianoAggiornato = riconciliaPiano(output.pianoAggiornato, metriche, registro, stato, alert);
  const minaccePerSlot = riconciliaMinacce(output.minaccePerSlot, stato, metriche, pianoAggiornato, alert);
  const consigliChiamata = filtraConsigli(output.consigliChiamata, stato, registro, alert);

  const fonti = urlRicercaGrezzi ? output.meta.fonti.filter((f) => urlRicercaGrezzi.has(f.url)) : output.meta.fonti;
  if (urlRicercaGrezzi && fonti.length < output.meta.fonti.length) {
    alert.push({
      gravita: "info",
      messaggio: "Una o più fonti citate dal modello non comparivano nei risultati di ricerca forniti: rimosse (§5.5).",
      azione: "Nessuna correzione necessaria.",
    });
  }

  return {
    meta: { ...output.meta, fonti },
    mercato,
    avversari,
    minaccePerSlot,
    pianoAggiornato,
    consigliChiamata,
    alert,
    sintesi: output.sintesi,
  };
}
