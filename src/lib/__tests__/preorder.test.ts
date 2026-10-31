import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { formatUsd, packPriceCents } from "../preorder";

describe("packPriceCents", () => {
  it("multiplies cans by the per-can price", () => {
    expect(packPriceCents(12, 300)).toBe(3600);
  });
});

describe("formatUsd", () => {
  it.each([
    [3600, "$36"],
    [3650, "$36.50"],
    [5, "$0.05"],
    [0, "$0"],
    [123456, "$1,234.56"],
  ])("formats %i cents as %s", (cents, text) => {
    expect(formatUsd(cents)).toBe(text);
  });

  it("round-trips a pack price: the text parses back to cans × per-can", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 48 }), fc.integer({ min: 1, max: 1000 }), (cans, perCan) => {
        const text = formatUsd(packPriceCents(cans, perCan));
        expect(text.startsWith("$")).toBe(true);
        expect(Number(text.slice(1).replace(/,/g, ""))).toBeCloseTo((cans * perCan) / 100, 2);
      }),
    );
  });
});
