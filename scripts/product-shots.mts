// Renders the product photos on /preorder and the homepage from the two renders in
// assets/products/. Run it after changing either render, then commit the outputs:
//   npm run product-shots
// Needs Google Chrome (set CHROME_PATH if it isn't in /Applications).
//
// Three steps, all in Chrome, so nothing beyond Chrome is needed:
//   1. The carton is touched up on a canvas: its records take the can's peach (the
//      printed carton is peach; the render is black and white), and the "for
//      position only" boxes on its side panel are painted out.
//   2. Each shot is laid out in HTML on the peach stage and screenshotted.
//   3. Each screenshot is encoded to webp, with a jpeg behind it for old browsers.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { SHOT_SIZE, STAGE } from "../src/content/catalog.ts";

const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const CARTON = resolve("assets/products/carton-render.png");
const CAN = resolve("assets/products/miami-can.png");
const OUT_DIR = resolve("public/products");

// ---------- Pure: the touch-up and the shots ----------

// Measured on carton-render.png (1628×1399): each record is an ellipse in the render.
// The peach is laid over it with multiply, so white rings and label turn peach and
// black stays black. Each is a few pixels inside the disc's black rim.
const RECORDS = [
  { cx: 811, cy: 198.8, rx: 347, ry: 93.5, deg: 0 },
  { cx: 1299.5, cy: 680.2, rx: 301.5, ry: 195.5, deg: 116 },
] as const;
// The printed peach: the rings on the Miami can, sampled.
const PEACH = [247, 218, 186] as const;
// The side panel's own grey (it is flat to within 2 levels), and the area holding the
// placeholder boxes. Darker pixels there are the boxes' lines and labels.
const SIDE = { grey: 205, x0: 40, x1: 536, y0: 440, y1: 1380 } as const;

const dataUrl = (path: string) => `data:image/png;base64,${readFileSync(path).toString("base64")}`;

const touchUpPage = (carton: string) => `<!doctype html><meta charset="utf-8"><body><script>
const RECORDS = ${JSON.stringify(RECORDS)}, PEACH = ${JSON.stringify(PEACH)}, SIDE = ${JSON.stringify(SIDE)};
const img = new Image();
img.onload = () => {
  const w = img.width, h = img.height;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, w, h), p = d.data;
  const at = (x, y) => (y * w + x) * 4;
  const opaque = (x, y) => x >= 0 && y >= 0 && x < w && y < h && p[at(x, y) + 3] === 255;
  // Placeholder boxes: every darker pixel on the side panel, plus a pixel of halo,
  // becomes the panel's grey. The panel's edges (within 5px of clear) are kept.
  const lum = (i) => p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114;
  const mark = new Uint8Array(w * h);
  for (let y = SIDE.y0; y < SIDE.y1; y++) for (let x = SIDE.x0; x < SIDE.x1; x++) {
    const i = at(x, y);
    if (lum(i) < SIDE.grey - 5 && [[5,0],[-5,0],[0,5],[0,-5]].every(([dx, dy]) => opaque(x + dx, y + dy)))
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) mark[(y + dy) * w + x + dx] = 1;
  }
  for (let k = 0; k < mark.length; k++) if (mark[k]) {
    const x = k % w, y = (k - x) / w;
    if (x >= SIDE.x1 || !opaque(x, y)) continue;
    p[k * 4] = p[k * 4 + 1] = p[k * 4 + 2] = SIDE.grey;
  }
  // Records: multiply by peach inside each ellipse, feathered over its last 2px.
  for (const r of RECORDS) {
    const t = r.deg * Math.PI / 180, cos = Math.cos(t), sin = Math.sin(t), m = Math.max(r.rx, r.ry);
    for (let y = Math.floor(r.cy - m); y <= r.cy + m; y++) for (let x = Math.floor(r.cx - m); x <= r.cx + m; x++) {
      const u = ((x - r.cx) * cos + (y - r.cy) * sin) / r.rx, v = (-(x - r.cx) * sin + (y - r.cy) * cos) / r.ry;
      const e = Math.sqrt(u * u + v * v);
      if (e >= 1) continue;
      const a = Math.min(1, (1 - e) * Math.min(r.rx, r.ry) / 2), i = at(x, y);
      for (let ch = 0; ch < 3; ch++) p[i + ch] = Math.round(p[i + ch] * (1 - a + a * PEACH[ch] / 255));
    }
  }
  g.putImageData(d, 0, 0);
  const out = document.createElement("pre");
  out.id = "out";
  out.textContent = c.toDataURL("image/png");
  document.body.append(out);
};
img.src = "${carton}";
</script></body>`;

// The carton is 1628×1399 and the can 900×2501. Shots are SHOT_SIZE, 4:5. The stage
// is a peach wash, lit from above; every shot shares it, so the gallery never jumps.
type Shot = { readonly name: string; readonly body: (src: { carton: string; can: string }) => string };

const stage = `background:
  radial-gradient(ellipse 70% 55% at 50% 40%, ${STAGE.light}, transparent 70%),
  linear-gradient(${STAGE.light}, ${STAGE.base} 62%, ${STAGE.floor})`;

// A soft contact shadow: a blurred ellipse at an object's foot.
const shadow = (x: number, y: number, w: number, h: number, alpha: number) =>
  `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:50%;
    background:rgb(80 50 20/${alpha});filter:blur(${Math.round(h / 2.2)}px)"></div>`;

const img = (src: string, x: number, y: number, w: number) =>
  `<img src="${src}" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;display:block">`;

const SHOTS: readonly Shot[] = [
  {
    // The hero: the carton square-ish to us, the can standing in front of its left side.
    name: "miami-pack",
    body: ({ carton, can }) => {
      const cw = 1300, ch = Math.round((cw * 1399) / 1628);
      const cx = 250, cy = 1500 - ch;
      const sw = 350, sh = Math.round((sw * 2501) / 900);
      const sx = 110, sy = 1640 - sh;
      return [
        shadow(cx + 120, cy + ch - 120, cw - 180, 110, 0.32),
        img(carton, cx, cy, cw),
        shadow(sx - 10, sy + sh - 34, sw + 20, 60, 0.4),
        img(can, sx, sy, sw),
      ].join("");
    },
  },
  {
    name: "miami-can",
    body: ({ can }) => {
      const w = 560, h = Math.round((w * 2501) / 900);
      const x = (SHOT_SIZE.width - w) / 2, y = 1800 - h;
      return [shadow(x + 10, y + h - 46, w - 20, 80, 0.38), img(can, x, y, w)].join("");
    },
  },
  {
    // The record up close: the can's top half fills the frame.
    name: "miami-label",
    body: ({ can }) => {
      const w = 1180, scale = w / 900;
      // The record's centre on the can render is about (450, 1000); the frame runs
      // from the lid's shine down to "Sparkling energy drink".
      const x = SHOT_SIZE.width / 2 - 450 * scale, y = SHOT_SIZE.height * 0.38 - 1000 * scale;
      return img(can, x, y, w);
    },
  },
];

const shotPage = (body: string) => `<!doctype html><html><head><meta charset="utf-8"><style>
html, body { margin: 0; width: ${SHOT_SIZE.width}px; height: ${SHOT_SIZE.height}px; overflow: hidden; }
body { position: relative; ${stage}; }
</style></head><body>${body}</body></html>`;

const encodePage = (png: string) => `<!doctype html><meta charset="utf-8"><body><script>
const img = new Image();
img.onload = () => {
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  c.getContext("2d").drawImage(img, 0, 0);
  for (const [id, type, q] of [["webp", "image/webp", 0.86], ["jpg", "image/jpeg", 0.88]]) {
    const out = document.createElement("pre");
    out.id = id;
    out.textContent = c.toDataURL(type, q);
    document.body.append(out);
  }
};
img.src = "${png}";
</script></body>`;

// ---------- Effects ----------

const chrome = (args: readonly string[]) =>
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", ...args], {
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  }).toString("utf8");

// Runs a page and returns the base64 payload of each <pre id> it writes.
function dump(dir: string, name: string, html: string, ids: readonly string[]) {
  const file = join(dir, `${name}.html`);
  writeFileSync(file, html);
  const dom = chrome(["--virtual-time-budget=15000", "--dump-dom", pathToFileURL(file).href]);
  return ids.map((id) => {
    const m = new RegExp(`<pre id="${id}">data:image/[a-z]+;base64,([^<]+)</pre>`).exec(dom);
    if (!m) throw new Error(`${name}: no ${id} output`);
    return Buffer.from(m[1], "base64");
  });
}

function main() {
  for (const [what, path] of [["Chrome", CHROME], ["carton render", CARTON], ["can render", CAN]]) {
    if (!existsSync(path)) throw new Error(`${what} not found at ${path}`);
  }
  const dir = mkdtempSync(join(tmpdir(), "groove-shots-"));
  try {
    const [carton] = dump(dir, "touch-up", touchUpPage(dataUrl(CARTON)), ["out"]);
    const cartonPath = join(dir, "carton.png");
    writeFileSync(cartonPath, carton);
    console.log("touched up the carton: peach records, placeholder boxes painted out");

    const src = { carton: pathToFileURL(cartonPath).href, can: pathToFileURL(CAN).href };
    for (const shot of SHOTS) {
      const html = join(dir, `${shot.name}.html`);
      const png = join(dir, `${shot.name}.png`);
      writeFileSync(html, shotPage(shot.body(src)));
      chrome([
        "--force-device-scale-factor=1",
        `--window-size=${SHOT_SIZE.width},${SHOT_SIZE.height}`,
        "--virtual-time-budget=5000",
        `--screenshot=${png}`,
        pathToFileURL(html).href,
      ]);
      const [webp, jpg] = dump(dir, `${shot.name}-encode`, encodePage(dataUrl(png)), ["webp", "jpg"]);
      writeFileSync(join(OUT_DIR, `${shot.name}.webp`), webp);
      writeFileSync(join(OUT_DIR, `${shot.name}.jpg`), jpg);
      console.log(`rendered public/products/${shot.name}.{webp,jpg} (${SHOT_SIZE.width}×${SHOT_SIZE.height})`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main();
