import { describe, expect, it } from "vitest";
import { applicaTemplate, TEMPLATE_STRATEGIA } from "@/lib/strategia/template";
import { totaleBudget } from "@/lib/strategia/budget";

describe("applicaTemplate", () => {
  it.each(TEMPLATE_STRATEGIA)("%s: il totale risultante è sempre ancorato ai crediti base", (template) => {
    const budget = applicaTemplate(template, 500);
    expect(totaleBudget(budget)).toBe(500);
  });

  it("corazzata difensiva pesa la difesa più del budget diffuso", () => {
    const diffuso = applicaTemplate("budget-diffuso", 500);
    const difensiva = applicaTemplate("corazzata-difensiva", 500);
    expect(difensiva.D).toBeGreaterThan(diffuso.D);
  });

  it("attacco stellare pesa l'attacco più degli altri template", () => {
    const diffuso = applicaTemplate("budget-diffuso", 500);
    const stellare = applicaTemplate("attacco-stellare", 500);
    expect(stellare.A).toBeGreaterThan(diffuso.A);
  });

  it("resta ancorato ai crediti base anche con cifre che generano arrotondamenti", () => {
    const budget = applicaTemplate("budget-diffuso", 333);
    expect(totaleBudget(budget)).toBe(333);
  });
});
