import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../contrast";

const hex = fc
  .tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }))
  .map(([r, g, b]) => `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`);

describe("contrastRatio", () => {
  it("is 21 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 9);
  });
  it("reads upper and lower case the same", () => {
    expect(contrastRatio("#B26C41", "#FFFFFF")).toBe(contrastRatio("#b26c41", "#ffffff"));
  });
  it("is undefined for anything that isn't #rrggbb", () => {
    for (const bad of ["", "b26c41", "#fff", "#gggggg", "orange"]) {
      expect(contrastRatio(bad, "#ffffff"), bad).toBeUndefined();
      expect(contrastRatio("#ffffff", bad), bad).toBeUndefined();
    }
  });
  it("is 1 for a color against itself", () => {
    fc.assert(fc.property(hex, (c) => contrastRatio(c, c) === 1));
  });
  it("is the same either way round, and between 1 and 21", () => {
    fc.assert(
      fc.property(hex, hex, (a, b) => {
        const ab = contrastRatio(a, b);
        return ab !== undefined && ab === contrastRatio(b, a) && ab >= 1 && ab <= 21 + 1e-9;
      }),
    );
  });
});
