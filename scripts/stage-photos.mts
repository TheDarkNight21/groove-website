// The stage photos (the homepage can and the /preorder gallery), from the renders in
// assets/products/: each source is scaled to STAGE_PHOTO_SIZE and encoded to webp
// with a jpeg behind it. Run it after a source changes, then commit the outputs:
//   npm run stage-photos
// Needs ffmpeg and cwebp (brew install ffmpeg webp). Scaling and encoding only:
// nothing here crops, tints or composites.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { CATALOG, STAGE_PHOTO_SIZE, type StagePhoto } from "../src/content/catalog.ts";

const SRC_DIR = resolve("assets/products");
const OUT_DIR = resolve("public/products");
const WEBP_QUALITY = 86;
// ffmpeg's mjpeg quality scale: 2 is near the top of its range.
const JPEG_QSCALE = 2;

// ---------- Pure ----------

export type Encode = { readonly source: string; readonly png: string; readonly webp: string; readonly jpg: string };

// Every distinct photo once (the homepage can is also the gallery's first).
export const encodes = (photos: readonly StagePhoto[], srcDir: string, outDir: string, tmp: string): readonly Encode[] =>
  [...new Map(photos.map((p) => [p.name, p])).values()].map((p) => ({
    source: join(srcDir, p.source),
    png: join(tmp, `${p.name}.png`),
    webp: join(outDir, `${p.name}.webp`),
    jpg: join(outDir, `${p.name}.jpg`),
  }));

export const scaleArgs = (source: string, png: string): readonly string[] => [
  "-v", "error", "-y", "-i", source,
  "-vf", `scale=${STAGE_PHOTO_SIZE.width}:${STAGE_PHOTO_SIZE.height}:flags=lanczos+accurate_rnd+full_chroma_int`,
  "-pix_fmt", "rgb24", png,
];

// ---------- Effects ----------

function main() {
  for (const tool of ["ffmpeg", "cwebp"]) {
    try {
      execFileSync("which", [tool], { stdio: "ignore" });
    } catch {
      throw new Error(`${tool} not found (brew install ffmpeg webp)`);
    }
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const tmp = mkdtempSync(join(tmpdir(), "groove-stage-"));
  try {
    for (const e of encodes(CATALOG.flatMap((p) => [p.showcase, ...p.gallery]), SRC_DIR, OUT_DIR, tmp)) {
      if (!existsSync(e.source)) throw new Error(`no source render at ${e.source}`);
      execFileSync("ffmpeg", [...scaleArgs(e.source, e.png)], { stdio: "inherit" });
      execFileSync("cwebp", ["-quiet", "-q", String(WEBP_QUALITY), "-m", "6", "-sharp_yuv", e.png, "-o", e.webp], { stdio: "inherit" });
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", e.png, "-q:v", String(JPEG_QSCALE), e.jpg], { stdio: "inherit" });
      console.log(`${e.webp.split("/").pop()} and .jpg from ${e.source.split("/").pop()}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) main();
