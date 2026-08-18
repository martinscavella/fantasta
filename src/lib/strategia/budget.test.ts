import { describe, expect, it } from "vitest";
import { percentuali, ricalcolaBudget, sforamento, totaleBudget } from "@/lib/strategia/budget";
import type { BudgetPerRuolo } from "@/lib/blob/schemas";

describe("percentuali", () => {
  it("calcola la percentuale di ogni reparto sul totale crediti", () => {
    const budget: BudgetPerRuolo = { P: 25, D: 100, C: 150, A: 225 };
    expect(percentuali(budget, 500)).toEqual({ P: 5, D: 20, C: 30, A: 45 });
  });
});

describe("sforamento", () => {
  it("è 0 quando il budget eguaglia esattamente i crediti base", () => {
    const budget: BudgetPerRuolo = { P: 25, D: 100, C: 150, A: 225 };
    expect(sforamento(budget, 500)).toBe(0);
  });

  it("è positivo quando il budget supera i crediti base", () => {
    const budget: BudgetPerRuolo = { P: 25, D: 100, C: 150, A: 300 };
    expect(sforamento(budget, 500)).toBe(75);
  });
});

describe("ricalcolaBudget", () => {
  it("alzando un reparto, il totale resta ancorato ai crediti base", () => {
    const budget: BudgetPerRuolo = { P: 25, D: 100, C: 150, A: 225 };
    const risultato = ricalcolaBudget(budget, 500, "A", 300);
    expect(totaleBudget(risultato)).toBe(500);
    expect(risultato.A).toBe(300);
  });

  it("ridistribuisce la diminuzione proporzionalmente al peso attuale degli altri reparti", () => {
    // D:C:P prima erano 100:150:25 (peso 275) — devono restare nella stessa proporzione sul nuovo residuo.
    const budget: BudgetPerRuolo = { P: 25, D: 100, C: 150, A: 225 };
    const risultato = ricalcolaBudget(budget, 500, "A", 400); // residuo per gli altri: 100 (invece di 275)
    expect(totaleBudget(risultato)).toBe(500);
    // C aveva il peso maggiore (150/275) e deve restare il più alto tra i tre.
    expect(risultato.C).toBeGreaterThan(risultato.D);
    expect(risultato.D).toBeGreaterThan(risultato.P);
  });

  it("non va mai sotto zero", () => {
    const budget: BudgetPerRuolo = { P: 0, D: 0, C: 0, A: 0 };
    const risultato = ricalcolaBudget(budget, 500, "A", 500);
    expect(risultato.P).toBeGreaterThanOrEqual(0);
    expect(risultato.D).toBeGreaterThanOrEqual(0);
    expect(risultato.C).toBeGreaterThanOrEqual(0);
  });

  it("con tutti gli altri reparti a zero, divide il residuo in parti uguali", () => {
    const budget: BudgetPerRuolo = { P: 0, D: 0, C: 0, A: 500 };
    const risultato = ricalcolaBudget(budget, 500, "A", 200);
    expect(totaleBudget(risultato)).toBe(500);
    expect(risultato.P).toBe(100);
    expect(risultato.D).toBe(100);
    expect(risultato.C).toBe(100);
  });

  it("clampa un valore superiore ai crediti base", () => {
    const budget: BudgetPerRuolo = { P: 25, D: 100, C: 150, A: 225 };
    const risultato = ricalcolaBudget(budget, 500, "A", 9999);
    expect(risultato.A).toBe(500);
    expect(totaleBudget(risultato)).toBe(500);
  });
});
