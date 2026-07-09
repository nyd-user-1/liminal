/**
 * Compress the new dusk/dawn/maya illustration PNGs to AVIF and upload them to
 * the PUBLIC Vercel Blob store under illustrations/ (the `ILLO` path the home
 * page + 404 read from).
 *
 * Usage:
 *   node --env-file=.env.local scripts/ingest-dusk-dawn.mjs
 */

import { put } from "@vercel/blob";
import sharp from "sharp";
import { readFileSync, statSync } from "fs";
import { join } from "path";

const PUBLIC = "public";
const PREFIX = "illustrations/";
const QUALITY = 60;
const NAMES = ["dawn10", "dusk10", "dusk11", "dusk20", "dusk21", "dusk22", "dusk23", "maya10", "maya11"];

async function main() {
  const token = process.env.PUBLIC_BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error("Missing PUBLIC_BLOB_READ_WRITE_TOKEN. Run with:");
    console.error("  node --env-file=.env.local scripts/ingest-dusk-dawn.mjs");
    process.exit(1);
  }

  const results = [];
  let srcTotal = 0;
  let outTotal = 0;

  for (const name of NAMES) {
    const src = join(PUBLIC, `${name}.png`);
    let srcBytes;
    try {
      srcBytes = statSync(src).size;
    } catch {
      console.warn(`  ⚠ ${name}.png not found — skipping`);
      continue;
    }

    const avif = await sharp(readFileSync(src)).avif({ quality: QUALITY, effort: 4 }).toBuffer();
    const pathname = `${PREFIX}${name}.avif`;
    const blob = await put(pathname, avif, {
      access: "public",
      contentType: "image/avif",
      addRandomSuffix: false,
      allowOverwrite: true,
      token,
    });

    srcTotal += srcBytes;
    outTotal += avif.length;
    const kb = (n) => (n / 1024).toFixed(0).padStart(5);
    console.log(`  ✓ ${name.padEnd(8)} ${kb(srcBytes)} KB → ${kb(avif.length)} KB avif   ${blob.url}`);
    results.push({ name, url: blob.url });
  }

  console.log(
    `\nDone. ${results.length} images  ${(srcTotal / 1024 / 1024).toFixed(1)} MB → ${(outTotal / 1024 / 1024).toFixed(2)} MB` +
      `  (${(100 - (outTotal / srcTotal) * 100).toFixed(1)}% smaller)`,
  );
  results.forEach((r) => console.log(`  ${r.name}: ${r.url}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
