import { describe, expect, it } from "vitest";
import { CATALOG, nameParts, type Product } from "../catalog";
import { contrastRatio } from "../../lib/contrast";

// Large text (the product name is a heading) needs 3:1 against the page.
const PAGE = "#ffffff";
const LARGE_TEXT_MIN = 3;

describe("the flavor's city in the product name", () => {
  it("is a word in every product's name, and the parts put the name back together", () => {
    for (const p of CATALOG) {
      const parts = nameParts(p);
      expect(parts, p.sku).toBeDefined();
      if (!parts) continue;
      expect(parts.city, p.sku).toBe(p.city);
      expect(parts.before + parts.city + parts.after, p.sku).toBe(p.name);
    }
  });
  it("has no parts when the name doesn't contain the city", () => {
    const stray: Pick<Product, "name" | "city"> = { name: "The Miami Groove", city: "Boston" };
    expect(nameParts(stray)).toBeUndefined();
    expect(nameParts({ name: "The Miami Groove", city: "" })).toBeUndefined();
  });
  it("is colored so it reads on the white page at heading size", () => {
    for (const p of CATALOG) {
      const ratio = contrastRatio(p.accent, PAGE);
      expect(ratio, `${p.sku} accent ${p.accent}`).toBeDefined();
      expect(ratio ?? 0, `${p.sku} accent ${p.accent}`).toBeGreaterThanOrEqual(LARGE_TEXT_MIN);
    }
  });
});
