import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { encodeIco, type IcoImage } from "../ico";

// Read the directory back out of an encoded file.
function decode(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint16(4, true);
  return {
    type: view.getUint16(2, true),
    images: Array.from({ length: count }, (_, i) => {
      const at = 6 + 16 * i;
      const length = view.getUint32(at + 8, true);
      const offset = view.getUint32(at + 12, true);
      return {
        size: view.getUint8(at) || 256,
        png: bytes.slice(offset, offset + length),
      };
    }),
  };
}

const image = fc.record({
  size: fc.integer({ min: 1, max: 256 }),
  png: fc.uint8Array({ minLength: 1, maxLength: 64 }),
});

describe("encodeIco", () => {
  it("round-trips every image and its size", () => {
    fc.assert(
      fc.property(fc.array(image, { minLength: 1, maxLength: 6 }), (images: IcoImage[]) => {
        const result = encodeIco(images);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const decoded = decode(result.value);
        expect(decoded.type).toBe(1);
        expect(decoded.images).toEqual(images.map(({ size, png }) => ({ size, png })));
      }),
    );
  });

  it("has no bytes beyond the images", () => {
    fc.assert(
      fc.property(fc.array(image, { minLength: 1, maxLength: 6 }), (images) => {
        const result = encodeIco(images);
        if (!result.ok) throw new Error("expected ok");
        const payload = images.reduce((n, { png }) => n + png.length, 0);
        expect(result.value.length).toBe(6 + 16 * images.length + payload);
      }),
    );
  });

  it("rejects an empty list and out-of-range sizes", () => {
    expect(encodeIco([])).toEqual({ ok: false, error: { kind: "empty" } });
    expect(encodeIco([{ size: 300, png: new Uint8Array([1]) }])).toEqual({
      ok: false,
      error: { kind: "bad-size", size: 300 },
    });
  });
});
