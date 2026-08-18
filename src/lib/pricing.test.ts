import { describe, expect, it } from "vitest";
import { fasciaStandard } from "@/lib/pricing";

describe("fasciaStandard", () => {
  it.each([
    [30, "Top"],
    [29, "Semitop"],
    [15, "Semitop"],
    [14, "Terza fascia"],
    [6, "Terza fascia"],
    [5, "Scommesse"],
    [1, "Scommesse"],
    [0, null],
  ] as const)("quotazione %i -> %s", (quotazione, atteso) => {
    expect(fasciaStandard(quotazione)).toBe(atteso);
  });
});
