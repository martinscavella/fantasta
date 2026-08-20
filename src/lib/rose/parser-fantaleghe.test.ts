import { describe, expect, it } from "vitest";
import { parseRoseFantaleghe } from "@/lib/rose/parser-fantaleghe";

const DUE_BLOCCHI = [
  "$,$,$",
  "Giovanni&Schizzo,133,18",
  "Giovanni&Schizzo,572,84",
  "Giovanni&Schizzo,2170,1",
  "$,$,$",
  "Mario&Giuseppe,6248,3",
  "Mario&Giuseppe,7332,20",
  "$,$,$",
].join("\n");

describe("parseRoseFantaleghe", () => {
  it("legge i blocchi separati da $,$,$ ignorando i separatori", () => {
    const rose = parseRoseFantaleghe(DUE_BLOCCHI);

    expect(rose.squadre).toEqual(["Giovanni&Schizzo", "Mario&Giuseppe"]);
    expect(rose.righe).toHaveLength(5);
    expect(rose.righeSaltate).toBe(0);
    expect(rose.righe[0]).toEqual({ squadra: "Giovanni&Schizzo", playerId: 133, prezzo: 18 });
    expect(rose.righe[4]).toEqual({ squadra: "Mario&Giuseppe", playerId: 7332, prezzo: 20 });
  });

  it("regge la variante col punto e virgola", () => {
    const rose = parseRoseFantaleghe("$;$;$\nSquadra A;133;18\nSquadra A;572;84\n$;$;$\n");

    expect(rose.squadre).toEqual(["Squadra A"]);
    expect(rose.righe).toHaveLength(2);
    expect(rose.righeSaltate).toBe(0);
  });

  it("funziona anche senza separatore finale", () => {
    const rose = parseRoseFantaleghe("$,$,$\nSquadra A,133,18");

    expect(rose.righe).toHaveLength(1);
  });

  it("salta le righe con prezzo o id non numerico", () => {
    const rose = parseRoseFantaleghe(
      ["$,$,$", "Squadra A,133,18", "Squadra A,572,n/d", "Squadra A,boh,4"].join("\n"),
    );

    expect(rose.righe).toHaveLength(1);
    expect(rose.righeSaltate).toBe(2);
  });

  it("salta le righe con meno di tre colonne o senza nome squadra", () => {
    const rose = parseRoseFantaleghe(["$,$,$", "Squadra A,133", ",572,84", "Squadra A,4,1"].join("\n"));

    expect(rose.righe).toEqual([{ squadra: "Squadra A", playerId: 4, prezzo: 1 }]);
    expect(rose.righeSaltate).toBe(2);
  });

  it("tollera BOM, CRLF e righe vuote", () => {
    const rose = parseRoseFantaleghe("\uFEFF$,$,$\r\nSquadra A,133,18\r\n\r\nSquadra A,572,84\r\n$,$,$\r\n");

    expect(rose.squadre).toEqual(["Squadra A"]);
    expect(rose.righe).toHaveLength(2);
    expect(rose.righeSaltate).toBe(0);
  });

  it("elenca le squadre in ordine di prima apparizione, senza duplicarle", () => {
    const rose = parseRoseFantaleghe(
      ["$,$,$", "Zeta,1,1", "Zeta,2,1", "$,$,$", "Alfa,3,1", "$,$,$", "Zeta,4,1"].join("\n"),
    );

    expect(rose.squadre).toEqual(["Zeta", "Alfa"]);
    expect(rose.righe).toHaveLength(4);
  });

  it("non produce nulla da un file vuoto", () => {
    expect(parseRoseFantaleghe("")).toEqual({ squadre: [], righe: [], righeSaltate: 0 });
  });
});
