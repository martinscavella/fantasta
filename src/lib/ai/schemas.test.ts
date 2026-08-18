import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DossierBloccoGeneratoSchema, StrategiaGeneratasSchema } from "@/lib/ai/schemas";

// Il punto di questo test (§ Ponte IA nel piano): il JSON Schema incluso nel
// prompt è generato dallo stesso schema zod che valida la risposta, quindi non
// può mai divergere dai campi davvero obbligatori — se un domani un campo
// diventa opzionale o cambia nome, questo test lo segnala.

describe("StrategiaGeneratasSchema -> JSON Schema", () => {
  it("elenca tutti i campi di primo livello come obbligatori", () => {
    const jsonSchema = z.toJSONSchema(StrategiaGeneratasSchema) as { required?: string[] };
    expect(jsonSchema.required).toEqual(
      expect.arrayContaining(["fasce", "budgetReparto", "slotObiettivi", "prezziMassimi", "sintesi"]),
    );
  });
});

describe("DossierBloccoGeneratoSchema -> JSON Schema", () => {
  it("elenca blockId e giocatori come obbligatori", () => {
    const jsonSchema = z.toJSONSchema(DossierBloccoGeneratoSchema) as { required?: string[] };
    expect(jsonSchema.required).toEqual(expect.arrayContaining(["blockId", "giocatori"]));
  });

  it("elenca tutti i campi di ogni giocatore come obbligatori nell'item dell'array", () => {
    const jsonSchema = z.toJSONSchema(DossierBloccoGeneratoSchema) as unknown as {
      properties: { giocatori: { items: { required?: string[] } } };
    };
    expect(jsonSchema.properties.giocatori.items.required).toEqual(
      expect.arrayContaining([
        "playerId",
        "puntiForza",
        "puntiDebolezza",
        "rischioInfortuni",
        "rischioTitolarita",
        "noteRecenti",
        "prezzoConsigliato",
        "motivazionePrezzo",
        "alternative",
      ]),
    );
  });
});
