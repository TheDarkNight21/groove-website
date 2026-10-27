import { describe, expect, it } from "vitest";
import { RECORD, RINGS, markSvg, recordSvg } from "../record-art";

describe("record art", () => {
  it("keeps every ring on the vinyl, outside the label, and clear of the track gaps", () => {
    for (const { r } of RINGS) {
      expect(r).toBeGreaterThan(RECORD.labelRadius);
      expect(r).toBeLessThan(RECORD.rimRadius);
      for (const gap of [52, 66, 80]) expect(Math.abs(r - gap)).toBeGreaterThan(1.2);
    }
  });

  it("draws the label text and name in the full record, and no text in the small mark", () => {
    expect(recordSvg()).toContain(RECORD.labelText);
    expect(recordSvg()).toContain(`>${RECORD.name}</text>`);
    expect(markSvg()).not.toContain("<text");
  });
});
