import { describe, expect, it } from "vitest";
import esempioInput from "@/lib/analisi-live/fixtures/esempio-input.json";
import esempioOutput from "@/lib/analisi-live/fixtures/esempio-output.json";
import { AnalisiAstaLiveSchema, StatoAstaSchema } from "@/lib/analisi-live/schemas";

// I due fixture sono gli esempi normativi forniti insieme a input.schema.json
// e output.schema.json (§3 della spec): se non parsano più, il contratto si è
// rotto senza che nessuno se ne accorgesse — è il test più economico che
// esista per un modulo con due contratti JSON espliciti.

describe("StatoAstaSchema", () => {
  it("valida l'esempio-input.json normativo", () => {
    const risultato = StatoAstaSchema.safeParse(esempioInput);
    expect(risultato.success, risultato.success ? "" : JSON.stringify(risultato.error.issues, null, 2)).toBe(true);
  });

  it("rifiuta un input con un campo extra (additionalProperties: false)", () => {
    const risultato = StatoAstaSchema.safeParse({ ...esempioInput, campoInventato: true });
    expect(risultato.success).toBe(false);
  });

  it("rifiuta un input senza i campi obbligatori", () => {
    const { lega: _lega, ...senzaLega } = esempioInput as Record<string, unknown>;
    void _lega;
    expect(StatoAstaSchema.safeParse(senzaLega).success).toBe(false);
  });
});

describe("AnalisiAstaLiveSchema", () => {
  it("valida l'esempio-output.json normativo", () => {
    const risultato = AnalisiAstaLiveSchema.safeParse(esempioOutput);
    expect(risultato.success, risultato.success ? "" : JSON.stringify(risultato.error.issues, null, 2)).toBe(true);
  });

  it("rifiuta un output con un campo extra", () => {
    const risultato = AnalisiAstaLiveSchema.safeParse({ ...esempioOutput, campoInventato: true });
    expect(risultato.success).toBe(false);
  });

  it("rifiuta un verdetto fuori enum", () => {
    const rotto = structuredClone(esempioOutput) as Record<string, unknown>;
    (rotto.minaccePerSlot as { verdetto: string }[])[0].verdetto = "chissà";
    expect(AnalisiAstaLiveSchema.safeParse(rotto).success).toBe(false);
  });
});
