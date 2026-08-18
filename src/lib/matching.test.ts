import { describe, expect, it } from "vitest";
import { abbinaGiocatore, jaroWinkler, normalizzaNome, type CandidatoMatch } from "@/lib/matching";

describe("normalizzaNome", () => {
  it("rimuove i diacritici", () => {
    expect(normalizzaNome("Lautaro Martínez")).toBe("lautaro martinez");
  });

  it("ordina i token, così l'ordine nome/cognome non conta", () => {
    expect(normalizzaNome("Rossi Mario")).toBe(normalizzaNome("Mario Rossi"));
  });

  it("ignora maiuscole e spazi ripetuti", () => {
    expect(normalizzaNome("MARIO   ROSSI")).toBe(normalizzaNome("mario rossi"));
  });
});

describe("abbinaGiocatore — match esatto", () => {
  const candidati: CandidatoMatch[] = [
    { id: 1, nome: "Lautaro Martinez" },
    { id: 2, nome: "Nicolo Barella" },
  ];

  it("abbina nonostante accenti diversi (fonte esterna vs listone)", () => {
    const risultato = abbinaGiocatore("Lautaro Martínez", candidati);
    expect(risultato).toEqual({ metodo: "esatto", playerId: 1 });
  });

  it("abbina nonostante l'ordine nome/cognome invertito", () => {
    const risultato = abbinaGiocatore("MARTINEZ LAUTARO", candidati);
    expect(risultato).toEqual({ metodo: "esatto", playerId: 1 });
  });
});

describe("abbinaGiocatore — omonimi", () => {
  it("due candidati con lo stesso nome normalizzato -> ambiguo, non un abbinamento a caso", () => {
    const candidati: CandidatoMatch[] = [
      { id: 1, nome: "Mario Rossi" },
      { id: 2, nome: "Mario Rossi" },
    ];
    const risultato = abbinaGiocatore("Mario Rossi", candidati);
    expect(risultato.metodo).toBe("ambiguo");
    if (risultato.metodo === "ambiguo") {
      expect(risultato.candidati.sort()).toEqual([1, 2]);
    }
  });
});

describe("abbinaGiocatore — nessun match", () => {
  it("un nome senza candidati abbastanza simili ritorna nessuno", () => {
    const candidati: CandidatoMatch[] = [
      { id: 1, nome: "Lautaro Martinez" },
      { id: 2, nome: "Nicolo Barella" },
    ];
    const risultato = abbinaGiocatore("Zzyzx Qwerty", candidati);
    expect(risultato).toEqual({ metodo: "nessuno" });
  });

  it("lista di candidati vuota ritorna nessuno", () => {
    expect(abbinaGiocatore("Chiunque", [])).toEqual({ metodo: "nessuno" });
  });
});

describe("abbinaGiocatore — match fuzzy", () => {
  it("una piccola differenza di battitura resta sopra soglia", () => {
    const candidati: CandidatoMatch[] = [{ id: 1, nome: "Kristjan Asllani" }];
    const risultato = abbinaGiocatore("Kristjan Aslani", candidati); // una sola "l"
    expect(risultato.metodo).toBe("fuzzy");
    if (risultato.metodo === "fuzzy") expect(risultato.playerId).toBe(1);
  });
});

describe("abbinaGiocatore — alias salvato", () => {
  const candidati: CandidatoMatch[] = [{ id: 1, nome: "Lautaro Martinez" }];

  it("un alias con playerId numerico ha priorità su qualunque calcolo", () => {
    const risultato = abbinaGiocatore("Nome Qualsiasi", candidati, 1);
    expect(risultato).toEqual({ metodo: "alias", playerId: 1 });
  });

  it("un alias null (deciso a mano 'non rilevante') vince anche su un match esatto", () => {
    const risultato = abbinaGiocatore("Lautaro Martinez", candidati, null);
    expect(risultato).toEqual({ metodo: "nessuno" });
  });
});

describe("jaroWinkler", () => {
  it("è 1 per stringhe identiche", () => {
    expect(jaroWinkler("abc", "abc")).toBe(1);
  });

  it("è 0 per stringhe completamente diverse", () => {
    expect(jaroWinkler("abc", "xyz")).toBe(0);
  });

  it("premia i prefissi comuni", () => {
    const conPrefissoComune = jaroWinkler("martinez", "martinov");
    const senzaPrefissoComune = jaroWinkler("martinez", "zmartino");
    expect(conPrefissoComune).toBeGreaterThan(senzaPrefissoComune);
  });
});
