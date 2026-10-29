import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { formatUsd, packPriceCents, parseCheckoutUrl } from "../preorder";

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

describe("parseCheckoutUrl", () => {
  it.each([
    "https://buy.stripe.com/abc123",
    "https://buy.stripe.com/test_abc123",
    "  https://buy.stripe.com/abc123\n",
  ])("accepts %j", (raw) => {
    const parsed = parseCheckoutUrl(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value).toBe(raw.trim());
  });

  it.each([
    ["", "missing"],
    ["   ", "missing"],
    [undefined, "missing"],
    ["http://buy.stripe.com/abc", "not-stripe"],
    ["https://buy.stripe.com.evil.com/abc", "not-stripe"],
    ["https://stripe.com/abc", "not-stripe"],
    ["https://buy.stripe.com", "not-stripe"],
    ["https://buy.stripe.com/", "not-stripe"],
    ["not a url", "not-stripe"],
  ] as const)("rejects %j as %s", (raw, error) => {
    expect(parseCheckoutUrl(raw)).toEqual({ ok: false, error });
  });
});
