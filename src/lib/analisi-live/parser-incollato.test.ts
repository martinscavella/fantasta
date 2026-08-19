import { describe, expect, it } from "vitest";
import { parsaRigheIncollate } from "@/lib/analisi-live/parser-incollato";

const candidati = [
  { id: 1, nome: "Lautaro Martinez" },
  { id: 2, nome: "Marco Sportiello" },
  { id: 3, nome: "Marco Carnesecchi" },
];

describe("parsaRigheIncollate", () => {
  it("riconosce una riga ben formata con match esatto", () => {
    const [riga] = parsaRigheIncollate("Rossi FC | Lautaro Martinez | 45", candidati);
    expect(riga).toEqual({ ok: true, riga: "Rossi FC | Lautaro Martinez | 45", squadra: "Rossi FC", playerId: 1, prezzo: 45 });
  });

  it("tollera accenti e ordine invertito grazie al matching fuzzy esistente", () => {
    const [riga] = parsaRigheIncollate("Bianchi Team | Martinez Lautaro | 40", candidati);
    expect(riga.ok).toBe(true);
    if (riga.ok) expect(riga.playerId).toBe(1);
  });

  it("segnala una riga malformata senza bloccare le altre", () => {
    const righe = parsaRigheIncollate("riga senza separatori\nRossi FC | Lautaro Martinez | 45", candidati);
    expect(righe[0]).toMatchObject({ ok: false, ambiguo: false });
    expect(righe[1]).toMatchObject({ ok: true, playerId: 1 });
  });

  it("segnala l'ambiguità sugli omonimi invece di indovinare", () => {
    const [riga] = parsaRigheIncollate("Verdi United | Marco S. | 10", candidati);
    // "Marco S." non supera la soglia fuzzy verso nessuno dei due Marco — nessun match, non ambiguo.
    expect(riga.ok).toBe(false);
  });

  it("ignora righe vuote e spazi", () => {
    const righe = parsaRigheIncollate("\n\n  Rossi FC | Lautaro Martinez | 45  \n\n", candidati);
    expect(righe).toHaveLength(1);
  });

  it("rifiuta un prezzo non numerico", () => {
    const [riga] = parsaRigheIncollate("Rossi FC | Lautaro Martinez | non-un-numero", candidati);
    expect(riga).toMatchObject({ ok: false, ambiguo: false });
  });
});
