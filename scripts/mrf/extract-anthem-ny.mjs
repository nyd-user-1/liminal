#!/usr/bin/env node
// Anthem/Elevance ToC miner — stream the gunzipped 10.5GB index on stdin,
// extract every `"location":"…"` value, keep the FIRST signed URL per unique
// basename for New York (anthembcbsny host, or the antm S3 bucket with an
// _NY_ path marker). Root-files-only discipline: the ToC repeats each file
// under thousands of plans with differing query params; basename = identity.
//
//   curl -sL <toc.gz> | gunzip -c | node scripts/mrf/extract-anthem-ny.mjs > anthem-ny-files.txt
//   (progress on stderr; output lines: basename|first-signed-url)

const NEEDLE = Buffer.from('"location":"');
const QUOTE = 0x22;

// host substring to keep (NY commercial = empirebcbs.mrf.bcbs.com; the
// "anthembcbsny" guess was wrong — always check the host tally in the log)
const matchArg = process.argv.find((a) => a.startsWith("--match="));
const MATCH = matchArg ? matchArg.slice(8) : "empirebcbs";

const nyFiles = new Map(); // basename -> first full URL
const hostCounts = new Map();
let locations = 0;
let bytes = 0;
const start = Date.now();

const tick = setInterval(() => {
  console.error(
    `[${((Date.now() - start) / 60000).toFixed(1)}m] ${(bytes / 1e9).toFixed(1)} GB | locations ${locations} | ny-unique ${nyFiles.size}`
  );
}, 15000);

let carry = Buffer.alloc(0);
for await (const chunk of process.stdin) {
  bytes += chunk.length;
  const data = carry.length ? Buffer.concat([carry, chunk]) : chunk;
  let pos = 0;
  let lastSafe = 0;
  for (;;) {
    const at = data.indexOf(NEEDLE, pos);
    if (at === -1) {
      lastSafe = Math.max(lastSafe, data.length - NEEDLE.length + 1);
      break;
    }
    const vStart = at + NEEDLE.length;
    const vEnd = data.indexOf(QUOTE, vStart);
    if (vEnd === -1) {
      lastSafe = at; // value straddles the boundary — reprocess next chunk
      break;
    }
    locations++;
    const url = data.toString("utf8", vStart, vEnd);
    const host = url.slice(8, url.indexOf("/", 8));
    hostCounts.set(host, (hostCounts.get(host) ?? 0) + 1);
    const isNy = host.includes(MATCH);
    if (isNy) {
      const path = url.split("?")[0];
      const base = path.slice(path.lastIndexOf("/") + 1);
      if (!nyFiles.has(base)) nyFiles.set(base, url);
    }
    pos = vEnd + 1;
    lastSafe = pos;
  }
  carry = Buffer.from(data.subarray(lastSafe));
}
clearInterval(tick);

for (const [base, url] of [...nyFiles].sort()) process.stdout.write(`${base}|${url}\n`);
console.error(`DONE locations=${locations} ny-unique=${nyFiles.size} bytes=${bytes}`);
console.error("top hosts:");
for (const [h, c] of [...hostCounts].sort((a, b) => b[1] - a[1]).slice(0, 15))
  console.error(`  ${c}\t${h}`);
