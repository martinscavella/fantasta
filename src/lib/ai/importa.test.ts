import { describe, expect, it } from "vitest";
import { z } from "zod";
import { estraiJson, importaRisposta } from "@/lib/ai/importa";

const SCHEMA = z.object({ nome: z.string().min(1), valore: z.number() });

describe("estraiJson", () => {
  it("estrae un JSON puro", () => {
    expect(estraiJson('{"a":1}')).toBe('{"a":1}');
  });

  it("estrae da un fence markdown ```json", () => {
    const testo = 'Ecco il risultato:\n```json\n{"a":1}\n```\nFammi sapere se serve altro.';
    expect(estraiJson(testo)).toBe('{"a":1}');
  });

  it("estrae da un fence markdown senza linguaggio", () => {
    const testo = '```\n{"a":1}\n```';
    expect(estraiJson(testo)).toBe('{"a":1}');
  });

  it("estrae dalla prima { all'ultima } quando non c'è un fence", () => {
    const testo = 'Ecco la risposta: {"a":1} — questo è il JSON richiesto.';
    expect(estraiJson(testo)).toBe('{"a":1}');
  });

  it("ritorna null senza nessuna graffa", () => {
    expect(estraiJson("nessun JSON qui")).toBeNull();
  });
});

describe("importaRisposta", () => {
  it("valida una risposta corretta", () => {
    const risultato = importaRisposta('{"nome":"Lautaro","valore":35}', SCHEMA);
    expect(risultato).toEqual({ ok: true, data: { nome: "Lautaro", valore: 35 } });
  });

  it("valida un JSON avvolto in prosa e in un fence markdown", () => {
    const testo = 'Ecco quanto richiesto:\n\n```json\n{"nome":"Lautaro","valore":35}\n```\n\nSpero sia utile!';
    const risultato = importaRisposta(testo, SCHEMA);
    expect(risultato).toEqual({ ok: true, data: { nome: "Lautaro", valore: 35 } });
  });

  it("segnala un campo obbligatorio mancante nominandolo", () => {
    const risultato = importaRisposta('{"valore":35}', SCHEMA);
    expect(risultato.ok).toBe(false);
    if (!risultato.ok) expect(risultato.errore).toContain("nome");
  });

  it("segnala un JSON troncato a metà", () => {
    // Troncato dopo aver chiuso un oggetto annidato ("valore":{}) ma prima
    // della graffa finale: c'è ancora una "}" da cui estraiJson può tagliare,
    // ma il risultato non è JSON valido — il caso realistico di una copia
    // interrotta a metà, non l'assenza totale di graffe.
    const risultato = importaRisposta('{"nome":"Lautaro","valore":{}', SCHEMA);
    expect(risultato).toEqual({ ok: false, errore: expect.stringContaining("troncato") });
  });

  it("segnala l'assenza di qualunque blocco JSON", () => {
    const risultato = importaRisposta("mi scuso ma non sono riuscito a produrre un risultato", SCHEMA);
    expect(risultato).toEqual({ ok: false, errore: expect.stringContaining("Nessun blocco JSON") });
  });
});
