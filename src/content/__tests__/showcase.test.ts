import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG, stagePhotosOf, type StagePhoto } from "../catalog";
import { encodes } from "../../../scripts/stage-photos.mts";

const publicFile = (url: string) => join(process.cwd(), "public", url);
const photos = (): readonly StagePhoto[] => CATALOG.flatMap(stagePhotosOf);

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
  it("show no photo twice in the gallery, and not the homepage's, which the buyer has just seen", () => {
    for (const p of CATALOG) {
      expect(p.gallery.map((g) => g.name), p.sku).not.toContain(p.showcase.name);
      expect(new Set(p.gallery.map((g) => g.name)).size, p.sku).toBe(p.gallery.length);
    }
  });
  it("keep the thanks page's photo out of the gallery, so it is new to the buyer", () => {
    for (const p of CATALOG) expect(p.gallery.map((g) => g.name), p.sku).not.toContain(p.thanks.name);
  });
  it("are each encoded once, even when two pages share one", () => {
    const e = encodes(photos(), "src", "out", "tmp");
    expect(e.map((x) => x.webp)).toEqual([...new Set(photos().map((s) => `out/${s.name}.webp`))]);
  });
});
