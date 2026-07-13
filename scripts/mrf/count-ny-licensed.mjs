#!/usr/bin/env node
// Telehealth-gap blast radius (docs/TASK-TELEHEALTH-GAP.md): stream the NPPES
// monthly CSV on stdin and count individual providers holding a NY license on
// a behavioral taxonomy — regardless of practice address. COUNTS ONLY; no DB
// writes (ingestion is a separate, reported decision).
//
//   curl -sL <monthly zip> | bsdtar -xOf - '*npidata_pfile*[0-9].csv' \
//     | node scripts/mrf/count-ny-licensed.mjs --npis=.harvest/mrf/npis.txt \
//         --out-npis=.harvest/mrf/ny-licensed-oos.txt
//
// Taxonomy include-set mirrors scripts/ingest-directory.mjs (MH_TAXONOMY +
// 103T/103G prefixes) — keep in lockstep.

import fs from "node:fs";
import readline from "node:readline";

const arg = (n, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : d;
};
const ourNpis = new Set(
  fs.readFileSync(arg("npis"), "utf8").split("\n").map((s) => s.trim()).filter(Boolean)
);
const OUT_NPIS = arg("out-npis", "");

const MH_EXACT = new Set([
  "2084P0800X", "2084P0804X", "2084P0805X", "2084P0802X", "2084F0202X",
  "2084P0015X", "1041C0700X", "101YM0800X", "106H00000X", "102L00000X",
  "103K00000X", "363LP0808X",
]);
const isMh = (t) => MH_EXACT.has(t) || t.startsWith("103T") || t.startsWith("103G");

// minimal CSV splitter (NPPES quotes every field; values may contain commas)
function splitCsv(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

let header = null;
let idx = null;
const stats = {
  rows: 0,
  individuals: 0,
  nyLicensedMh: 0,
  practiceNY: 0,
  practiceOutOfState: 0,
  inOurList: 0,
  notInOurList: 0,
  byState: new Map(),
  byTaxonomy: new Map(),
};
const oosOut = OUT_NPIS ? fs.createWriteStream(OUT_NPIS) : null;
const t0 = Date.now();
const tick = setInterval(() => {
  console.error(
    `[${((Date.now() - t0) / 60000).toFixed(1)}m] rows ${stats.rows} | NY-licensed MH ${stats.nyLicensedMh} (practice NY ${stats.practiceNY} / out-of-state ${stats.practiceOutOfState}) | not in our 99k ${stats.notInOurList}`
  );
}, 15000);

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of rl) {
  if (!header) {
    header = splitCsv(line);
    idx = {
      npi: header.indexOf("NPI"),
      entity: header.indexOf("Entity Type Code"),
      pracState: header.indexOf("Provider Business Practice Location Address State Name"),
      tax: [],
      lic: [],
    };
    for (let k = 1; k <= 15; k++) {
      idx.tax.push(header.indexOf(`Healthcare Provider Taxonomy Code_${k}`));
      idx.lic.push(header.indexOf(`Provider License Number State Code_${k}`));
    }
    continue;
  }
  if (!line) continue;
  stats.rows++;
  // cheap prefilter before the full CSV parse: NY must appear somewhere
  if (!line.includes('"NY"')) continue;
  const c = splitCsv(line);
  if (c[idx.entity] !== "1") continue;
  stats.individuals++;
  let hit = null;
  for (let k = 0; k < 15; k++) {
    const t = c[idx.tax[k]];
    if (t && isMh(t) && c[idx.lic[k]] === "NY") {
      hit = t;
      break;
    }
  }
  if (!hit) continue;
  stats.nyLicensedMh++;
  stats.byTaxonomy.set(hit, (stats.byTaxonomy.get(hit) ?? 0) + 1);
  const st = c[idx.pracState] || "??";
  if (st === "NY") stats.practiceNY++;
  else {
    stats.practiceOutOfState++;
    stats.byState.set(st, (stats.byState.get(st) ?? 0) + 1);
  }
  const npi = c[idx.npi];
  if (ourNpis.has(npi)) stats.inOurList++;
  else {
    stats.notInOurList++;
    if (oosOut) oosOut.write(`${npi}|${st}|${hit}\n`);
  }
}
clearInterval(tick);
console.error("DONE", JSON.stringify({
  rows: stats.rows,
  nyLicensedMh: stats.nyLicensedMh,
  practiceNY: stats.practiceNY,
  practiceOutOfState: stats.practiceOutOfState,
  inOur99k: stats.inOurList,
  notInOur99k: stats.notInOurList,
}));
console.error("top out-of-state practice states:",
  [...stats.byState].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([s, n]) => `${s}:${n}`).join(" "));
console.error("by taxonomy:",
  [...stats.byTaxonomy].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}:${n}`).join(" "));
if (oosOut) oosOut.end();
