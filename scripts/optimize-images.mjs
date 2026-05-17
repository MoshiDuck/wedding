import { existsSync } from "node:fs";
import { copyFile, mkdir, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = join(ROOT, "assets");
const OUT_DIR = join(ROOT, "public", "assets");
const FORCE = process.env.FORCE_OPTIMIZE === "1";

/** Fonds plein écran : originaux non redimensionnés */
const BACKGROUND_ORIGINALS = [
  "background_phone.png",
  "background_computer.png",
];

/** @type {{ file: string; maxWidth: number; quality?: number }[]} */
const ASSETS = [
  { file: "homepage_phone.png", maxWidth: 1080 },
  { file: "homepage_computer.png", maxWidth: 1536 },
  { file: "button_ourfuturehome.png", maxWidth: 800, quality: 88 },
  { file: "location.jpg", maxWidth: 1040, quality: 85 },
];

async function isCacheFresh(srcPath, outPath) {
  if (!existsSync(outPath)) return false;
  const [src, out] = await Promise.all([stat(srcPath), stat(outPath)]);
  return out.mtimeMs >= src.mtimeMs;
}

await mkdir(OUT_DIR, { recursive: true });

const manifest = {};
let converted = 0;
let skipped = 0;
let copied = 0;

for (const file of BACKGROUND_ORIGINALS) {
  const srcPath = join(SRC_DIR, file);
  const outPath = join(OUT_DIR, file);
  const webpPath = join(OUT_DIR, `${basename(file, extname(file))}.webp`);

  if (existsSync(webpPath)) await unlink(webpPath);

  if (!FORCE && (await isCacheFresh(srcPath, outPath))) {
    skipped++;
    console.log(`  skip ${file} (original, à jour)`);
    continue;
  }

  await copyFile(srcPath, outPath);
  copied++;
  console.log(`  copy ${file} (original)`);
}

for (const { file, maxWidth, quality = 82 } of ASSETS) {
  const srcPath = join(SRC_DIR, file);
  const stem = basename(file, extname(file));
  const outName = `${stem}.webp`;
  const outPath = join(OUT_DIR, outName);

  if (!FORCE && (await isCacheFresh(srcPath, outPath))) {
    const meta = await sharp(outPath).metadata();
    const outStat = await stat(outPath);
    manifest[stem] = {
      webp: `assets/${outName}`,
      width: meta.width,
      height: meta.height,
      bytes: outStat.size,
    };
    skipped++;
    console.log(`  skip ${outName} (à jour)`);
    continue;
  }

  const pipeline = sharp(srcPath).rotate().resize({
    width: maxWidth,
    withoutEnlargement: true,
  });

  const { data, info } = await pipeline
    .webp({ quality, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  await writeFile(outPath, data);

  const kb = (data.length / 1024).toFixed(0);
  manifest[stem] = {
    webp: `assets/${outName}`,
    width: info.width,
    height: info.height,
    bytes: data.length,
  };
  converted++;
  console.log(`  ${file} → ${outName} (${info.width}×${info.height}, ${kb} KB)`);
}

await writeFile(
  join(ROOT, "public", "assets-manifest.json"),
  JSON.stringify(manifest, null, 2),
);

console.log(
  `Images: ${copied} original(aux), ${converted} convertie(s), ${skipped} en cache${FORCE ? " (FORCE_OPTIMIZE=1)" : ""}`,
);
