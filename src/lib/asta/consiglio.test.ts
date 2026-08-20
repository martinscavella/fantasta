import { describe, expect, it } from "vitest";
import { consigliaGiocatore, consigliaProssimo, type ContestoConsiglio } from "@/lib/asta/consiglio";
import type { StatoSquadraDerivato } from "@/lib/asta/derive";
import type { DossierEntry, Player, Ruolo, SetupDoc, StrategyDoc } from "@/lib/blob/schemas";

// creditiBase 500 = BUDGET_STANDARD_LISTONE, così prezzoMassimoDefault non
// scala la quotazione e i numeri dei test restano leggibili: un giocatore da
// quotazione 40 ha prezzo massimo 40 salvo override in strategy.
const SETUP: SetupDoc = {
  id: "asta-1",
  nome: "Lega di prova",
  stagione: "2026-27",
  listoneVersionId: "v1",
  modalita: "classic",
  creditiBase: 500,
  slot: { P: 3, D: 8, C: 8, A: 6 },
  squadre: [
    { id: "mia", nome: "La mia" },
    { id: "altra", nome: "L'altra" },
  ],
  miaSquadraId: "mia",
  sforo: { tipo: "nessuno" },
  createdAt: 0,
};

function player(id: number, ruolo: Ruolo, quotazioneAttuale: number): Player {
  return { id, nome: `Giocatore ${id}`, squadra: "Club", ruolo, quotazioneAttuale, quotazioneIniziale: quotazioneAttuale };
}

function squadra(over: Partial<StatoSquadraDerivato> = {}): StatoSquadraDerivato {
  return {
    teamId: "mia",
    nome: "La mia",
    creditiBase: 500,
    creditiSpesi: 0,
    creditiResidui: 500,
    slotBase: SETUP.slot,
    slotOccupati: { P: 0, D: 0, C: 0, A: 0 },
    slotResidui: { P: 3, D: 8, C: 8, A: 6 },
    slotResiduiTotali: 25,
    rosaCompleta: false,
    massimaOfferta: 476,
    sforoCrediti: 0,
    sforoEuro: null,
    obbligoPerRuolo: { P: false, D: false, C: false, A: false },
    ...over,
  };
}

const STRATEGY_VUOTA: StrategyDoc = {
  astaId: "asta-1",
  fasce: [],
  budgetReparto: { P: 40, D: 110, C: 150, A: 200 },
  slotObiettivi: [],
  prezziMassimi: [],
  tettoSpesaEuro: null,
  template: null,
  sintesiIA: null,
  updatedAt: 0,
};

function ctx(over: Partial<ContestoConsiglio> = {}): ContestoConsiglio {
  return {
    setup: SETUP,
    squadra: squadra(),
    strategy: STRATEGY_VUOTA,
    spesaPerRuolo: { P: 0, D: 0, C: 0, A: 0 },
    inflazione: null,
    dossierPerId: new Map(),
    ...over,
  };
}

function conObiettivo(playerId: number, ruolo: Ruolo, principale: boolean): StrategyDoc {
  return {
    ...STRATEGY_VUOTA,
    slotObiettivi: [
      {
        ruolo,
        indiceSlot: 1,
        obiettivoPrincipale: principale ? playerId : null,
        alternative: principale ? [] : [playerId],
      },
    ],
  };
}

describe("consigliaGiocatore", () => {
  it("lascia quando gli slot del ruolo sono già pieni", () => {
    const c = consigliaGiocatore(
      player(1, "D", 20),
      10,
      ctx({ squadra: squadra({ slotResidui: { P: 3, D: 0, C: 8, A: 6 } }) }),
    );

    expect(c.verdetto).toBe("lascia");
    expect(c.motivi[0]).toContain("slot D");
  });

  it("lo slot pieno vince anche se il giocatore è un obiettivo principale", () => {
    const c = consigliaGiocatore(
      player(1, "D", 20),
      10,
      ctx({
        strategy: conObiettivo(1, "D", true),
        squadra: squadra({ slotResidui: { P: 3, D: 0, C: 8, A: 6 } }),
      }),
    );

    // Il vincolo strutturale batte il desiderio: quel giocatore non lo si può
    // comprare comunque, per quanto fosse in cima alla lista.
    expect(c.verdetto).toBe("lascia");
  });

  it("lascia quando il prezzo supera la mia offerta massima", () => {
    const c = consigliaGiocatore(player(1, "A", 200), 120, ctx({ squadra: squadra({ massimaOfferta: 100 }) }));

    expect(c.verdetto).toBe("lascia");
    expect(c.motivi[0]).toContain("offerta massima");
  });

  it("a sforo non applica il vincolo di offerta massima (massimaOfferta null)", () => {
    const c = consigliaGiocatore(
      player(1, "A", 200),
      120,
      ctx({
        strategy: conObiettivo(1, "A", true),
        squadra: squadra({ massimaOfferta: null }),
      }),
    );

    expect(c.verdetto).toBe("punta");
  });

  it("lascia quando il prezzo supera il prezzo massimo personale", () => {
    const c = consigliaGiocatore(
      player(1, "C", 30),
      45,
      ctx({ strategy: { ...STRATEGY_VUOTA, prezziMassimi: [{ playerId: 1, valore: 40, origine: "manuale" }] } }),
    );

    expect(c.verdetto).toBe("lascia");
    expect(c.motivi[0]).toContain("prezzo massimo (40)");
  });

  it("punta su un obiettivo principale di uno slot scoperto", () => {
    const c = consigliaGiocatore(player(7, "C", 50), 30, ctx({ strategy: conObiettivo(7, "C", true) }));

    expect(c.verdetto).toBe("punta");
    expect(c.motivi[0]).toBe("Obiettivo principale slot C2");
    expect(c.slotTarget).toEqual({ indiceSlot: 1, principale: true });
  });

  it("punta su un'alternativa, con motivo diverso dall'obiettivo principale", () => {
    const c = consigliaGiocatore(player(7, "C", 50), 30, ctx({ strategy: conObiettivo(7, "C", false) }));

    expect(c.verdetto).toBe("punta");
    expect(c.motivi[0]).toBe("Alternativa per lo slot C2");
    expect(c.slotTarget).toEqual({ indiceSlot: 1, principale: false });
  });

  it("segnala un'occasione sotto il 70% del prezzo massimo", () => {
    // Quotazione 40 -> prezzo massimo 40 a creditiBase 500. 27 < 28 = 70%.
    const c = consigliaGiocatore(player(1, "A", 40), 27, ctx());

    expect(c.verdetto).toBe("occasione");
  });

  it("segnala il limite dal 90% del prezzo massimo in su", () => {
    const c = consigliaGiocatore(player(1, "A", 40), 36, ctx());

    expect(c.verdetto).toBe("limite");
  });

  it("resta neutro tra le due soglie, se non è un obiettivo", () => {
    const c = consigliaGiocatore(player(1, "A", 40), 32, ctx());

    expect(c.verdetto).toBe("neutro");
  });

  it("scala il prezzo massimo sull'inflazione corrente", () => {
    // Quotazione 40, inflazione 1.5 -> tetto 60: a 50 non è più "sopra il max".
    const sopra = consigliaGiocatore(player(1, "A", 40), 50, ctx({ inflazione: null }));
    const conInflazione = consigliaGiocatore(player(1, "A", 40), 50, ctx({ inflazione: 1.5 }));

    expect(sopra.verdetto).toBe("lascia");
    expect(conInflazione.prezzoMax).toBe(60);
    expect(conInflazione.verdetto).not.toBe("lascia");
  });

  it("non va in crisi senza strategia: nessun obiettivo, nessun prezzo massimo", () => {
    const c = consigliaGiocatore(player(1, "D", 12), 8, ctx({ strategy: null }));

    expect(c.slotTarget).toBeNull();
    expect(c.prezzoMax).toBe(12);
    expect(c.motivi.length).toBeGreaterThan(0);
  });

  it("aggiunge i segnali di rischio del dossier senza cambiare il verdetto", () => {
    const dossier: DossierEntry = {
      playerId: 7,
      puntiForza: [],
      puntiDebolezza: [],
      rischioInfortuni: "alto",
      rischioTitolarita: "alto",
      noteRecenti: "",
      prezzoConsigliato: 30,
      motivazionePrezzo: "",
      alternative: [],
      generatoAt: 0,
    };
    const senza = consigliaGiocatore(player(7, "C", 50), 30, ctx({ strategy: conObiettivo(7, "C", true) }));
    const con = consigliaGiocatore(
      player(7, "C", 50),
      30,
      ctx({ strategy: conObiettivo(7, "C", true), dossierPerId: new Map([[7, dossier]]) }),
    );

    expect(con.verdetto).toBe(senza.verdetto);
    expect(con.motivi).toContain("titolarità a rischio");
    expect(con.motivi.length).toBeLessThanOrEqual(3);
  });
});

describe("consigliaProssimo", () => {
  it("l'obbligo di ruolo vince su qualunque scostamento di budget", () => {
    const c = consigliaProssimo(
      ctx({
        squadra: squadra({
          obbligoPerRuolo: { P: true, D: false, C: false, A: false },
          slotResidui: { P: 2, D: 8, C: 8, A: 6 },
        }),
      }),
    );

    expect(c.ruoloPrioritario).toBe("P");
    expect(c.motivo).toContain("Obbligato");
  });

  it("senza obblighi sceglie il reparto più indietro rispetto al piano", () => {
    // A: 200 pianificati, 0 spesi, 6 slot -> 33/slot. C: 150 su 8 -> 18/slot.
    const c = consigliaProssimo(ctx());

    expect(c.ruoloPrioritario).toBe("A");
    expect(c.motivo).toContain("crediti pianificati");
  });

  it("tiene conto di quanto ho già speso per reparto", () => {
    const c = consigliaProssimo(
      ctx({
        spesaPerRuolo: { P: 0, D: 0, C: 0, A: 190 },
        squadra: squadra({ slotResidui: { P: 3, D: 8, C: 8, A: 1 } }),
      }),
    );

    // L'attacco è quasi fatto (190 di 200 spesi): la priorità passa altrove.
    expect(c.ruoloPrioritario).not.toBe("A");
  });

  it("segnala il budget di reparto esaurito invece di un residuo negativo", () => {
    const c = consigliaProssimo(
      ctx({
        strategy: { ...STRATEGY_VUOTA, budgetReparto: { P: 0, D: 0, C: 0, A: 0 } },
        squadra: squadra({ slotResidui: { P: 0, D: 0, C: 0, A: 2 } }),
      }),
    );

    expect(c.ruoloPrioritario).toBe("A");
    expect(c.motivo).toContain("già esaurito");
  });

  it("a rosa completa non indica nessun reparto", () => {
    const c = consigliaProssimo(
      ctx({ squadra: squadra({ slotResidui: { P: 0, D: 0, C: 0, A: 0 }, rosaCompleta: true }) }),
    );

    expect(c.ruoloPrioritario).toBeNull();
    expect(c.motivo).toBe("Rosa completa.");
  });

  it("riporta sempre lo scostamento di tutti e quattro i reparti", () => {
    const c = consigliaProssimo(ctx({ spesaPerRuolo: { P: 10, D: 20, C: 30, A: 40 } }));

    expect(c.scostamentoReparto).toHaveLength(4);
    expect(c.scostamentoReparto.map((s) => s.ruolo)).toEqual(["P", "D", "C", "A"]);
    expect(c.scostamentoReparto.find((s) => s.ruolo === "C")).toMatchObject({ pianificato: 150, speso: 30 });
  });
});
