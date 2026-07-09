import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";

const svg = readFileSync("app/icon.svg");

function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6 + 16 * count;
  let offset = headerSize;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(count, 4);

  const entries = [];
  for (const { size, buf } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bit count
    entry.writeUInt32LE(buf.length, 8); // bytes in resource
    entry.writeUInt32LE(offset, 12); // image offset
    offset += buf.length;
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.buf)]);
}

async function main() {
  const sizes = [16, 32, 48];
  const pngBuffers = await Promise.all(
    sizes.map(async (size) => ({ size, buf: await sharp(svg).resize(size, size).png().toBuffer() })),
  );
  writeFileSync("app/favicon.ico", buildIco(pngBuffers));
  console.log("wrote app/favicon.ico");

  const apple = await sharp(svg).resize(180, 180).png().toBuffer();
  writeFileSync("app/apple-icon.png", apple);
  console.log("wrote app/apple-icon.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
