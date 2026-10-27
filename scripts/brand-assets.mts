// Renders every icon and the share card from the record art in src/lib/record-art.ts.
// Run after changing the record or the homepage copy, then commit the outputs:
//   npm run brand-assets
// Needs Google Chrome (set CHROME_PATH if it isn't in /Applications).

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { SITE } from "../src/content/site.ts";
import { encodeIco } from "../src/lib/ico.ts";
import { BRAND_COLORS, markSvg, recordSvg } from "../src/lib/record-art.ts";

const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// Next ships Geist Mono with its dev overlay; it's the same face next/font serves the site.
const FONT = resolve("node_modules/next/dist/next-devtools/server/font/geist-mono-latin.woff2");

type Asset = {
  readonly out: string;
  readonly width: number;
  readonly height: number;
  readonly body: string;
  readonly transparent?: boolean;
};

// ---------- Pure: what each asset looks like ----------

const page = (asset: Asset) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Geist Mono"; src: url("${pathToFileURL(FONT)}") format("woff2"); font-weight: 100 900; }
html, body { margin: 0; width: ${asset.width}px; height: ${asset.height}px; overflow: hidden;
  background: ${asset.transparent ? "transparent" : BRAND_COLORS.paper}; color: ${BRAND_COLORS.ink};
  font-family: "Geist Mono", monospace; -webkit-font-smoothing: antialiased; }
svg { display: block; }
</style></head><body>${asset.body}</body></html>`;

// The art centred on white with a margin; `scale` is the record's share of the canvas.
const centred = (svg: string, size: number, scale: number) => {
  const d = Math.round(size * scale);
  const m = (size - d) / 2;
  return `<div style="padding:${m}px">${svg.replace("<svg ", `<svg width="${d}" height="${d}" `)}</div>`;
};

const mark = (size: number): Asset => ({
  out: `mark-${size}.png`,
  width: size,
  height: size,
  transparent: true,
  body: markSvg().replace("<svg ", `<svg width="${size}" height="${size}" `),
});

// Printed on the card; people type the bare domain.
const host = new URL(SITE.url).host.replace(/^www\./, "");

const shareCard: Asset = {
  out: "src/app/opengraph-image.png",
  width: 1200,
  height: 630,
  body: `<div style="display:grid;grid-template-columns:1fr 470px;gap:64px;align-items:center;height:100%;padding:0 80px;box-sizing:border-box">
    <div style="display:flex;flex-direction:column;justify-content:space-between;height:470px">
      <div style="font-size:26px;font-weight:500;letter-spacing:-0.03em">${SITE.name}</div>
      <div>
        <div style="font-size:68px;line-height:1.02;letter-spacing:-0.055em;font-weight:500">${SITE.tagline}</div>
        <div style="margin-top:24px;font-size:22px;line-height:1.5;color:rgb(0 0 0/.55);max-width:30ch">${SITE.description}</div>
      </div>
      <div style="font-size:16px;letter-spacing:0.08em;text-transform:uppercase;color:rgb(0 0 0/.55)">${host} · ${SITE.status}</div>
    </div>
    ${recordSvg().replace("<svg ", `<svg width="470" height="470" `)}
  </div>`,
};

const ASSETS: readonly Asset[] = [
  mark(16),
  mark(32),
  mark(48),
  { out: "src/app/apple-icon.png", width: 180, height: 180, body: centred(recordSvg(), 180, 0.9) },
  { out: "public/icon-192.png", width: 192, height: 192, body: centred(recordSvg(), 192, 0.94) },
  { out: "public/icon-512.png", width: 512, height: 512, body: centred(recordSvg(), 512, 0.94) },
  // Android crops maskable icons to as little as the middle 80%; keep the disc inside it.
  { out: "public/icon-maskable-512.png", width: 512, height: 512, body: centred(recordSvg(), 512, 0.78) },
  shareCard,
];

const SHARE_ALT = `The groove record beside the line “${SITE.tagline}”`;

// ---------- Effects ----------

function render(asset: Asset, dir: string, outPath: string) {
  const html = join(dir, `${asset.out.replaceAll("/", "_")}.html`);
  writeFileSync(html, page(asset));
  execFileSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--window-size=${asset.width},${asset.height}`,
      "--default-background-color=00000000",
      "--virtual-time-budget=2000",
      `--screenshot=${outPath}`,
      pathToFileURL(html).href,
    ],
    { stdio: "ignore" },
  );
}

function main() {
  for (const [what, path] of [["Chrome", CHROME], ["Geist Mono", FONT]]) {
    if (!existsSync(path)) throw new Error(`${what} not found at ${path}`);
  }
  const dir = mkdtempSync(join(tmpdir(), "groove-brand-"));
  try {
    for (const asset of ASSETS) {
      const outPath = asset.out.startsWith("mark-") ? join(dir, asset.out) : resolve(asset.out);
      render(asset, dir, outPath);
      console.log(`rendered ${asset.out} (${asset.width}×${asset.height})`);
    }
    const ico = encodeIco(
      [16, 32, 48].map((size) => ({ size, png: readFileSync(join(dir, `mark-${size}.png`)) })),
    );
    if (!ico.ok) throw new Error(`favicon.ico: ${JSON.stringify(ico.error)}`);
    writeFileSync("src/app/favicon.ico", ico.value);
    writeFileSync("src/app/icon.svg", markSvg() + "\n");
    writeFileSync("src/app/opengraph-image.alt.txt", SHARE_ALT);
    console.log("wrote src/app/favicon.ico, src/app/icon.svg, src/app/opengraph-image.alt.txt");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main();
