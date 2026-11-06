import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG } from "../catalog";

const publicFile = (url: string) => join(process.cwd(), "public", url);

describe("homepage photo", () => {
  it("points at files that are in public/, both formats", () => {
    for (const p of CATALOG) {
      expect(existsSync(publicFile(p.showcase.webp)), p.showcase.webp).toBe(true);
      expect(existsSync(publicFile(p.showcase.jpg)), p.showcase.jpg).toBe(true);
    }
  });
  it("is 4:5, the shape of the tile it fills", () => {
    for (const p of CATALOG) expect(p.showcase.width / p.showcase.height).toBeCloseTo(4 / 5, 9);
  });
});
