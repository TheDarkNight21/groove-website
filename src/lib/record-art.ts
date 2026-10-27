// The record is the brand mark. Its geometry lives here so the homepage disc and
// every generated icon draw the same thing. Coordinates are in a 200×200 box.

export const RECORD = {
  radius: 99,
  rimRadius: 98.2,
  labelRadius: 34,
  textRadius: 26,
  spindleRadius: 2.4,
  labelText: "GROOVE · ENERGY FOR THE FLOW STATE · ",
  name: "groove",
} as const;

// Groove rings between the label and the lead-in, with gaps between "tracks".
const TRACK_GAPS = [52, 66, 80] as const;

export type Ring = { readonly r: number; readonly opacity: number };

export const RINGS: readonly Ring[] = Array.from({ length: 42 }, (_, i) => 37 + i * 1.45)
  .filter((r) => TRACK_GAPS.every((g) => Math.abs(r - g) > 1.2))
  .map((r, i) => ({ r, opacity: i % 3 === 0 ? 0.09 : 0.045 }));

// A circle drawn as two arcs, starting at 9 o'clock, for the label text to run along.
export const labelPath = (r: number) =>
  `M100,100 m-${r},0 a${r},${r} 0 1,1 ${r * 2},0 a${r},${r} 0 1,1 -${r * 2},0`;

// Stretch the text to exactly one lap so the phrase meets itself with no seam.
export const labelTextLength = (r: number) => 2 * Math.PI * r - 0.5;

type Colors = { readonly vinyl: string; readonly paper: string; readonly ink: string };

export const BRAND_COLORS: Colors = { vinyl: "#0b0b0b", paper: "#ffffff", ink: "#000000" };

// The full record as an SVG document, label text included. Needs Geist Mono to render.
export function recordSvg(colors: Colors = BRAND_COLORS): string {
  const rings = RINGS.map(
    ({ r, opacity }) =>
      `<circle cx="100" cy="100" r="${r}" fill="none" stroke="#fff" stroke-opacity="${opacity}" stroke-width="0.35"/>`,
  ).join("");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">`,
    `<defs><path id="label-path" d="${labelPath(RECORD.textRadius)}"/></defs>`,
    `<circle cx="100" cy="100" r="${RECORD.radius}" fill="${colors.vinyl}"/>`,
    rings,
    `<circle cx="100" cy="100" r="${RECORD.rimRadius}" fill="none" stroke="#fff" stroke-opacity="0.14" stroke-width="0.6"/>`,
    `<circle cx="100" cy="100" r="${RECORD.labelRadius}" fill="${colors.paper}"/>`,
    `<text font-family="Geist Mono" font-size="5.2" letter-spacing="0.3" fill="${colors.ink}">`,
    `<textPath href="#label-path" textLength="${labelTextLength(RECORD.textRadius)}" lengthAdjust="spacing">${RECORD.labelText}</textPath>`,
    `</text>`,
    `<text x="100" y="91" text-anchor="middle" font-family="Geist Mono" font-weight="500" font-size="9" letter-spacing="-0.4" fill="${colors.ink}">${RECORD.name}</text>`,
    `<circle cx="100" cy="100" r="${RECORD.spindleRadius}" fill="${colors.vinyl}"/>`,
    `</svg>`,
  ].join("");
}

// The record reduced to what survives at 16px: disc, three rings, label, spindle.
// No text, so it renders the same everywhere without a font.
export function markSvg(colors: Colors = BRAND_COLORS): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">`,
    `<circle cx="16" cy="16" r="16" fill="${colors.vinyl}"/>`,
    `<circle cx="16" cy="16" r="15.4" fill="none" stroke="#fff" stroke-opacity="0.22" stroke-width="0.8"/>`,
    `<circle cx="16" cy="16" r="12.6" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="0.6"/>`,
    `<circle cx="16" cy="16" r="10" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="0.6"/>`,
    `<circle cx="16" cy="16" r="6.4" fill="${colors.paper}"/>`,
    `<circle cx="16" cy="16" r="1.4" fill="${colors.vinyl}"/>`,
    `</svg>`,
  ].join("");
}
