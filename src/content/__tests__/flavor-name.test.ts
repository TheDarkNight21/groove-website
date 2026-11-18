import { describe, expect, it } from "vitest";
import { CATALOG, nameParts, type Product } from "../catalog";

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
  it("is colored with a #rrggbb color", () => {
    for (const p of CATALOG) expect(p.accent, p.sku).toMatch(/^#[0-9a-f]{6}$/);
  });
});
