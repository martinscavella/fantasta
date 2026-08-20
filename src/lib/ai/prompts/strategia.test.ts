import { describe, expect, it } from "vitest";
import {
  buildPromptStrategia,
  PREFERENZE,
  REGOLE_PUNTEGGIO,
  RISCHI,
  STILI,
  type InputGeneratoreStrategia,
} from "@/lib/ai/prompts/strategia";
import type { Player, SetupDoc } from "@/lib/blob/schemas";

const SETUP: SetupDoc = {
  id: "asta-1",
  nome: "Lega di prova",
  stagione: "2026-27",
  listoneVersionId: "v1",
  modalita: "classic",
  creditiBase: 500,
  slot: { P: 3, D: 8, C: 8, A: 6 },
  squadre: [
    { id: "a", nome: "A" },
    { id: "b", nome: "B" },
  ],
  miaSquadraId: "a",
  sforo: { tipo: "nessuno" },
  createdAt: 0,
};

const GIOCATORI: Player[] = [
  { id: 1, nome: "Bomber", squadra: "Inter", ruolo: "A", quotazioneAttuale: 40, quotazioneIniziale: 38 },
  { id: 2, nome: "Difensore", squadra: "Lazio", ruolo: "D", quotazioneAttuale: 12, quotazioneIniziale: 12 },
];

const VUOTO: InputGeneratoreStrategia = {
  stili: [],
  rischio: "equilibrato",
  regolePunteggio: [],
  preferenze: [],
  note: "",
};

function prompt(over: Partial<InputGeneratoreStrategia> = {}): string {
  return buildPromptStrategia(SETUP, GIOCATORI, { ...VUOTO, ...over });
}

describe("buildPromptStrategia", () => {
  it("riporta le regole della lega e i giocatori con i loro id", () => {
    const p = prompt();
    expect(p).toContain("Crediti base per squadra: 500");
    expect(p).toContain("P 3, D 8, C 8, A 6");
    expect(p).toContain("Budget chiuso");
    expect(p).toContain("1\tA\tBomber\tInter\t40");
  });

  it("descrive lo sforo col cambio configurato", () => {
    const p = buildPromptStrategia(
      { ...SETUP, sforo: { tipo: "a-pagamento", euroPerCredito: 0.1 } },
      GIOCATORI,
      VUOTO,
    );
    expect(p).toContain("0.1 € ciascuno");
  });

  it("include le etichette delle scelte selezionate, non i loro id", () => {
    const p = prompt({
      stili: ["corazzata-difensiva"],
      regolePunteggio: ["mod-difesa"],
      preferenze: ["rigoristi"],
    });

    expect(p).toContain("Corazzata difensiva");
    expect(p).toContain("Modificatore di difesa");
    expect(p).toContain("Privilegia i rigoristi designati");
    // Gli id sono un dettaglio interno della UI: nel prompt non devono comparire.
    expect(p).not.toContain("corazzata-difensiva");
    expect(p).not.toContain("mod-difesa");
  });

  it("non lascia sezioni vuote quando non si seleziona nulla", () => {
    const p = prompt();
    expect(p).toContain("usa le regole standard del fantacalcio classico");
    expect(p).toContain("scegli tu l'impostazione più sensata");
    expect(p).toContain("nessuna preferenza particolare");
  });

  it("riporta la propensione al rischio scelta con la sua descrizione", () => {
    expect(prompt({ rischio: "aggressivo" })).toContain("Aggressivo — molte scommesse");
    expect(prompt({ rischio: "prudente" })).toContain("Prudente — quasi solo certezze");
  });

  it("ripiega su 'equilibrata' se il rischio non è tra le opzioni note", () => {
    expect(prompt({ rischio: "inesistente" })).toContain("equilibrata");
  });

  it("riporta le note libere, o 'nessuna' se sono vuote", () => {
    expect(prompt({ note: "  Lautaro a ogni costo  " })).toContain("Lautaro a ogni costo");
    expect(prompt({ note: "   " })).toContain("## Note libere\nnessuna");
  });

  it("elenca più scelte dello stesso gruppo, una per riga", () => {
    const p = prompt({ preferenze: ["rigoristi", "evita-neopromosse"] });
    expect(p).toContain("- Privilegia i rigoristi designati");
    expect(p).toContain("- Evita i giocatori delle neopromosse");
  });

  it("include lo schema JSON della risposta attesa", () => {
    // È la garanzia che prompt e validatore non divergano (§ Ponte IA nel piano).
    const p = prompt();
    expect(p).toContain("budgetReparto");
    expect(p).toContain("slotObiettivi");
    expect(p).toContain("prezziMassimi");
    expect(p).toContain("sintesi");
  });
});

describe("cataloghi delle opzioni", () => {
  it("hanno id univoci in ogni gruppo", () => {
    for (const gruppo of [STILI, RISCHI, REGOLE_PUNTEGGIO, PREFERENZE]) {
      const ids = gruppo.map((o) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("il rischio di default della UI esiste tra le opzioni", () => {
    expect(RISCHI.map((r) => r.id)).toContain("equilibrato");
  });
});
