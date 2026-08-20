import type { StatoSquadraDerivato } from "@/lib/asta/derive";
import { prezzoMassimoDefault } from "@/lib/pricing";
import { RUOLI } from "@/lib/ruoli";
import type { DossierEntry, Player, Ruolo, SetupDoc, StrategyDoc } from "@/lib/blob/schemas";

// Suggerimenti per il tracker, § C del piano di semplificazione UX. Tutto
// deterministico: nessuna chiamata IA, nessun ciclo copia-incolla — gli
// ingressi (strategia, stato derivato della mia squadra, dossier) sono già in
// memoria nella schermata d'asta. Il dossier, quando esiste, arricchisce i
// motivi ma non è un prerequisito.

export type Verdetto = "punta" | "occasione" | "limite" | "lascia" | "neutro";

export type SlotTarget = { indiceSlot: number; principale: boolean };

export type ConsiglioGiocatore = {
  verdetto: Verdetto;
  // 1-3 frasi brevi: la striscia in UI ha una riga sola, non un paragrafo.
  motivi: string[];
  prezzoMax: number;
  slotTarget: SlotTarget | null;
};

export type ScostamentoReparto = {
  ruolo: Ruolo;
  pianificato: number;
  speso: number;
  slotResidui: number;
};

export type ConsiglioProssimo = {
  ruoloPrioritario: Ruolo | null;
  motivo: string;
  scostamentoReparto: ScostamentoReparto[];
};

/**
 * Contesto della MIA squadra: tutto ciò che serve per giudicare un giocatore
 * senza rileggere il board. `squadra` è la voce di derivaSquadre relativa a
 * setup.miaSquadraId — porta già crediti residui, slot residui, massima
 * offerta e obblighi per ruolo.
 */
export type ContestoConsiglio = {
  setup: SetupDoc;
  squadra: StatoSquadraDerivato;
  strategy: StrategyDoc | null;
  // Spesa già sostenuta per reparto dalla mia rosa.
  spesaPerRuolo: Record<Ruolo, number>;
  // Moltiplicatore di inflazione corrente, per portare il prezzo massimo
  // personale al livello reale della lega (null = non ancora calcolabile).
  inflazione: number | null;
  dossierPerId: Map<number, DossierEntry>;
};

// Sotto questa quota del prezzo massimo personale un giocatore è un affare:
// si prende anche se non era un obiettivo, purché lo slot sia libero.
const SOGLIA_OCCASIONE = 0.7;
// Sopra questa quota si è al limite: ancora sostenibile, ma senza margine.
const SOGLIA_LIMITE = 0.9;

function prezzoMassimoPersonale(giocatore: Player, ctx: ContestoConsiglio): number {
  const impostato = ctx.strategy?.prezziMassimi.find((p) => p.playerId === giocatore.id)?.valore;
  const base = impostato ?? prezzoMassimoDefault(giocatore.quotazioneAttuale, ctx.setup.creditiBase);
  // Stessa correzione applicata dal tracker (prezzoReattivo in pricing.ts): il
  // tetto personale vale al livello di prezzi corrente, non a quello teorico.
  return ctx.inflazione === null ? base : Math.round(base * ctx.inflazione);
}

/**
 * Lo slot della mia strategia che questo giocatore andrebbe a coprire, se ce
 * n'è uno. Non distingue quali slot siano già riempiti — quel controllo passa
 * dagli slot residui per ruolo, che sono l'informazione affidabile.
 */
function trovaSlotTarget(giocatore: Player, strategy: StrategyDoc | null): SlotTarget | null {
  if (!strategy) return null;
  for (const obiettivo of strategy.slotObiettivi) {
    if (obiettivo.ruolo !== giocatore.ruolo) continue;
    if (obiettivo.obiettivoPrincipale === giocatore.id) {
      return { indiceSlot: obiettivo.indiceSlot, principale: true };
    }
    if (obiettivo.alternative.includes(giocatore.id)) {
      return { indiceSlot: obiettivo.indiceSlot, principale: false };
    }
  }
  return null;
}

// Segnali di rischio dal dossier generato via Ponte IA: non cambiano mai il
// verdetto (che resta una funzione di slot, budget e prezzo), lo annotano.
function motiviDossier(dossier: DossierEntry | undefined): string[] {
  if (!dossier) return [];
  const motivi: string[] = [];
  if (dossier.rischioTitolarita === "alto") motivi.push("titolarità a rischio");
  if (dossier.rischioInfortuni === "alto") motivi.push("fragile agli infortuni");
  return motivi;
}

/**
 * Verdetto sul giocatore attualmente in asta, al prezzo corrente. L'ordine dei
 * controlli è una precedenza vera, non una serie di if intercambiabili: un
 * vincolo strutturale (slot pieno, crediti insufficienti) batte sempre il
 * desiderio di prendere un obiettivo, perché quel giocatore non lo si può
 * comprare a prescindere da quanto lo si volesse.
 */
export function consigliaGiocatore(
  giocatore: Player,
  prezzoCorrente: number,
  ctx: ContestoConsiglio,
): ConsiglioGiocatore {
  const prezzoMax = prezzoMassimoPersonale(giocatore, ctx);
  const slotTarget = trovaSlotTarget(giocatore, ctx.strategy);
  const slotResidui = ctx.squadra.slotResidui[giocatore.ruolo];
  const extra = motiviDossier(ctx.dossierPerId.get(giocatore.id));

  const esito = (verdetto: Verdetto, motivi: string[]): ConsiglioGiocatore => ({
    verdetto,
    motivi: [...motivi, ...extra].slice(0, 3),
    prezzoMax,
    slotTarget,
  });

  if (slotResidui <= 0) {
    return esito("lascia", [`Hai già coperto tutti gli slot ${giocatore.ruolo}`]);
  }

  // massimaOfferta è null a sforo: lì il tetto in crediti non esiste (§ Modalità
  // sforo nel PLAN.md), quindi questo vincolo semplicemente non si applica.
  if (ctx.squadra.massimaOfferta !== null && prezzoCorrente > ctx.squadra.massimaOfferta) {
    return esito("lascia", [
      `Oltre la tua offerta massima (${ctx.squadra.massimaOfferta}): resteresti senza crediti per gli slot mancanti`,
    ]);
  }

  if (prezzoCorrente > prezzoMax) {
    return esito("lascia", [`Sopra il tuo prezzo massimo (${prezzoMax})`]);
  }

  if (slotTarget) {
    const etichettaSlot = `${giocatore.ruolo}${slotTarget.indiceSlot + 1}`;
    const motivo = slotTarget.principale
      ? `Obiettivo principale slot ${etichettaSlot}`
      : `Alternativa per lo slot ${etichettaSlot}`;
    return esito("punta", [motivo, `entro il tuo max (${prezzoMax})`]);
  }

  if (prezzoMax > 0 && prezzoCorrente <= prezzoMax * SOGLIA_OCCASIONE) {
    return esito("occasione", [`Ben sotto il tuo max (${prezzoMax}) e hai ancora ${slotResidui} slot ${giocatore.ruolo}`]);
  }

  if (prezzoMax > 0 && prezzoCorrente >= prezzoMax * SOGLIA_LIMITE) {
    return esito("limite", [`Al limite del tuo max (${prezzoMax}), nessun margine`]);
  }

  return esito("neutro", [`Non è tra i tuoi obiettivi ${giocatore.ruolo}`]);
}

/**
 * Su quale reparto conviene concentrarsi adesso, dato ciò che ho già comprato.
 * Un obbligo di ruolo vince su tutto: a rosa incompleta è l'unico vincolo che
 * sopravvive anche in modalità sforo (§ Modalità sforo nel PLAN.md), quindi è
 * l'unica certezza su cui basare una priorità.
 */
export function consigliaProssimo(ctx: ContestoConsiglio): ConsiglioProssimo {
  const scostamentoReparto: ScostamentoReparto[] = RUOLI.map((ruolo) => ({
    ruolo,
    pianificato: ctx.strategy?.budgetReparto[ruolo] ?? 0,
    speso: ctx.spesaPerRuolo[ruolo] ?? 0,
    slotResidui: ctx.squadra.slotResidui[ruolo],
  }));

  const obbligato = RUOLI.find((r) => ctx.squadra.obbligoPerRuolo[r]);
  if (obbligato) {
    const residui = ctx.squadra.slotResidui[obbligato];
    return {
      ruoloPrioritario: obbligato,
      motivo: `Obbligato sui ${obbligato}: ${residui} slot da riempire e non restano abbastanza liberi`,
      scostamentoReparto,
    };
  }

  const daRiempire = scostamentoReparto.filter((s) => s.slotResidui > 0);
  if (daRiempire.length === 0) {
    return { ruoloPrioritario: null, motivo: "Rosa completa.", scostamentoReparto };
  }

  // Il reparto più indietro rispetto al piano: quello con più crediti
  // pianificati ancora da spendere per slot rimasto. A parità, tocca a chi ha
  // più slot scoperti — è lì che il rischio di restare scoperti è maggiore.
  const prioritario = daRiempire.reduce((peggiore, s) => {
    const residuoPerSlot = (s.pianificato - s.speso) / s.slotResidui;
    const residuoPerSlotPeggiore = (peggiore.pianificato - peggiore.speso) / peggiore.slotResidui;
    if (residuoPerSlot !== residuoPerSlotPeggiore) return residuoPerSlot > residuoPerSlotPeggiore ? s : peggiore;
    return s.slotResidui > peggiore.slotResidui ? s : peggiore;
  });

  const residuoPianificato = prioritario.pianificato - prioritario.speso;
  const motivo =
    residuoPianificato > 0
      ? `Mancano ${prioritario.slotResidui} ${prioritario.ruolo} e hai ancora ${residuoPianificato} crediti pianificati sul reparto`
      : `Mancano ${prioritario.slotResidui} ${prioritario.ruolo} e il budget del reparto è già esaurito`;

  return { ruoloPrioritario: prioritario.ruolo, motivo, scostamentoReparto };
}
