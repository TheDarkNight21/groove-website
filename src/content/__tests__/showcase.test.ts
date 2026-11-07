import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG, type StagePhoto } from "../catalog";
import { encodes } from "../../../scripts/stage-photos.mts";

const publicFile = (url: string) => join(process.cwd(), "public", url);
const photos = (): readonly StagePhoto[] => CATALOG.flatMap((p) => [p.showcase, ...p.gallery]);

describe("stage photos", () => {
  it("point at encoded files in public/ and a committed source render, both formats", () => {
    for (const s of photos()) {
      expect(existsSync(publicFile(s.webp)), s.webp).toBe(true);
      expect(existsSync(publicFile(s.jpg)), s.jpg).toBe(true);
      expect(existsSync(join(process.cwd(), "assets/products", s.source)), s.source).toBe(true);
    }
  });
  it("are 4:5, the shape of the tiles they fill", () => {
    for (const s of photos()) expect(s.width / s.height, s.name).toBeCloseTo(4 / 5, 9);
  });
  it("lead the gallery with the homepage photo, and no photo twice", () => {
    for (const p of CATALOG) {
      expect(p.gallery[0]).toBe(p.showcase);
      expect(new Set(p.gallery.map((g) => g.name)).size, p.sku).toBe(p.gallery.length);
    }
  });
  it("are each encoded once, even when the homepage and the gallery share one", () => {
    const e = encodes(photos(), "src", "out", "tmp");
    expect(e.map((x) => x.webp)).toEqual([...new Set(photos().map((s) => `out/${s.name}.webp`))]);
  });
});
