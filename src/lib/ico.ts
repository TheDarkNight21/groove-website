// Packs PNG images into one .ico file. Every browser since IE9 reads PNG entries.

export type IcoImage = { readonly size: number; readonly png: Uint8Array };

export type IcoError = { readonly kind: "empty" } | { readonly kind: "bad-size"; readonly size: number };

export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

const HEADER = 6;
const ENTRY = 16;

export function encodeIco(images: readonly IcoImage[]): Result<Uint8Array, IcoError> {
  if (images.length === 0) return { ok: false, error: { kind: "empty" } };
  const bad = images.find(({ size }) => !Number.isInteger(size) || size < 1 || size > 256);
  if (bad) return { ok: false, error: { kind: "bad-size", size: bad.size } };

  const dataStart = HEADER + ENTRY * images.length;
  const offsets = images.reduce<readonly number[]>(
    (acc, img, i) => [...acc, acc[i] + img.png.length],
    [dataStart],
  );
  const out = new Uint8Array(offsets[images.length]);
  const view = new DataView(out.buffer);

  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, images.length, true);
  images.forEach(({ size, png }, i) => {
    const at = HEADER + ENTRY * i;
    view.setUint8(at, size % 256); // 0 means 256
    view.setUint8(at + 1, size % 256);
    view.setUint16(at + 4, 1, true); // colour planes
    view.setUint16(at + 6, 32, true); // bits per pixel
    view.setUint32(at + 8, png.length, true);
    view.setUint32(at + 12, offsets[i], true);
    out.set(png, offsets[i]);
  });
  return { ok: true, value: out };
}
