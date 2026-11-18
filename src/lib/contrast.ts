// WCAG 2 contrast between two colors, each written as #rrggbb. 1 is no contrast
// (the same color), 21 is black on white. Large text needs 3, body text 4.5.

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

// sRGB channel (0..255) to linear light.
const linear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

// Relative luminance, or undefined when the string isn't #rrggbb.
export function luminance(hex: string): number | undefined {
  const m = HEX.exec(hex);
  if (!m) return undefined;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => linear(parseInt(h, 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number | undefined {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === undefined || lb === undefined) return undefined;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
