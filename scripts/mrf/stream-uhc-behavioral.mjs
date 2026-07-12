#!/usr/bin/env node
// MRF PoC — stream a CMS Transparency-in-Coverage in-network-rates file on
// stdin (already gunzipped), filter to our directory NPIs x five behavioral
// CPTs, emit CSV rows. Single forward pass, nothing large touches disk.
//
//   curl -sL <downloadUrl> | gunzip -c | node scripts/mrf/stream-uhc-behavioral.mjs \
//     --npis=.harvest/mrf/npis.txt --out=.harvest/mrf/uhc-behavioral-P3.csv \
//     --payer="UnitedHealthcare Insurance Company of New York" \
//     --network="Behavioral P3" --source-file=<name> --file-date=2026-07-01
//
// TiC schema (confirmed on a small sibling file): provider_references[] comes
// first ({provider_group_id, provider_groups:[{npi:[...], tin:{...}}]}), then
// in_network[] ({billing_code, negotiated_rates:[{provider_references:[ids],
// negotiated_prices:[{negotiated_rate, negotiated_type, billing_class,
// service_code, ...}]}]}). We retain only groups containing >=1 of our NPIs,
// so memory is bounded by our 99k list, not UHC's millions.

import fs from "node:fs";
import path from "node:path";
import chain from "stream-chain";
import { parser } from "stream-json";
import { pick } from "stream-json/filters/pick.js";
import { streamArray } from "stream-json/streamers/stream-array.js";

const arg = (name, dflt) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};

const NPIS_PATH = arg("npis");
const OUT_PATH = arg("out");
const PAYER = arg("payer", "UnitedHealthcare");
const NETWORK = arg("network", "");
const SOURCE_FILE = arg("source-file", "");
const FILE_DATE = arg("file-date", "");
const CPTS = new Set((arg("codes", "90791,90834,90837,99214,90853")).split(","));

if (!NPIS_PATH || !OUT_PATH) {
  console.error("Usage: ... --npis=<file> --out=<csv> [--codes=a,b,c]");
  process.exit(1);
}

// Our NPIs, normalized to strings (TiC files carry npi as JSON numbers).
const ourNpis = new Set(
  fs.readFileSync(NPIS_PATH, "utf8").split("\n").map((s) => s.trim()).filter(Boolean)
);

// group_id -> [{tin, npis:[matched only]}]
const retained = new Map();

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
const out = fs.createWriteStream(OUT_PATH);
out.write(
  "npi,payer,plan_or_network,billing_code,negotiated_rate,negotiated_type,billing_class,place_of_service,tin,source_file,file_date\n"
);

const csv = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const stats = {
  bytes: 0,
  refsSeen: 0,
  refsRetained: 0,
  itemsSeen: 0,
  itemsMatchedCode: 0,
  rows: 0,
  byCode: Object.fromEntries([...CPTS].map((c) => [c, 0])),
  start: Date.now(),
};

const logStatus = () => {
  const mb = (stats.bytes / 1e6).toFixed(0);
  const mins = ((Date.now() - stats.start) / 60000).toFixed(1);
  console.error(
    `[${mins}m] ${mb} MB uncompressed | refs ${stats.refsSeen} (retained ${stats.refsRetained}) | items ${stats.itemsSeen} (cpt-hit ${stats.itemsMatchedCode}) | rows ${stats.rows}`
  );
};
const ticker = setInterval(logStatus, 15000);

process.stdin.on("data", (b) => (stats.bytes += b.length));

const pipeline = chain([
  process.stdin,
  parser(),
  pick({ filter: /^(provider_references|in_network)$/ }),
  streamArray(),
]);

// backpressure: pause the parse chain while the CSV writer's buffer is full
out.on("drain", () => pipeline.resume());
const write = (line) => {
  if (!out.write(line)) pipeline.pause();
};

function handleProviderReference(ref) {
  stats.refsSeen++;
  const groups = ref?.provider_groups;
  if (!Array.isArray(groups)) return;
  let kept = null;
  for (const g of groups) {
    if (!Array.isArray(g?.npi)) continue;
    let matched = null;
    for (const n of g.npi) {
      const s = String(n);
      if (ourNpis.has(s)) (matched ??= []).push(s);
    }
    if (matched) {
      (kept ??= []).push({
        tin: g.tin ? `${g.tin.type ?? ""}:${g.tin.value ?? ""}` : "",
        npis: matched,
      });
    }
  }
  if (kept) {
    retained.set(ref.provider_group_id, kept);
    stats.refsRetained++;
  }
}

function emitRows(item) {
  for (const nr of item.negotiated_rates ?? []) {
    // resolve provider side: referenced group ids, or inline provider_groups
    let sides = null;
    if (Array.isArray(nr.provider_references)) {
      for (const gid of nr.provider_references) {
        const kept = retained.get(gid);
        if (kept) (sides ??= []).push(...kept);
      }
    } else if (Array.isArray(nr.provider_groups)) {
      for (const g of nr.provider_groups) {
        if (!Array.isArray(g?.npi)) continue;
        const matched = g.npi.map(String).filter((s) => ourNpis.has(s));
        if (matched.length)
          (sides ??= []).push({
            tin: g.tin ? `${g.tin.type ?? ""}:${g.tin.value ?? ""}` : "",
            npis: matched,
          });
      }
    }
    if (!sides) continue;
    for (const price of nr.negotiated_prices ?? []) {
      const pos = Array.isArray(price.service_code) ? price.service_code.join("|") : "";
      for (const side of sides) {
        for (const npi of side.npis) {
          write(
            [
              npi,
              csv(PAYER),
              csv(NETWORK),
              item.billing_code,
              price.negotiated_rate,
              price.negotiated_type ?? "",
              price.billing_class ?? "",
              pos,
              csv(side.tin),
              csv(SOURCE_FILE),
              FILE_DATE,
            ].join(",") + "\n"
          );
          stats.rows++;
          if (stats.byCode[item.billing_code] !== undefined) stats.byCode[item.billing_code]++;
        }
      }
    }
  }
}

pipeline.on("data", ({ value }) => {
  if (value && Array.isArray(value.provider_groups) && value.provider_group_id !== undefined) {
    handleProviderReference(value);
  } else if (value && value.billing_code !== undefined) {
    stats.itemsSeen++;
    if (CPTS.has(String(value.billing_code))) {
      stats.itemsMatchedCode++;
      emitRows(value);
    }
  }
});

pipeline.on("error", (err) => {
  clearInterval(ticker);
  console.error("STREAM ERROR:", err.message);
  process.exit(2);
});

pipeline.on("end", () => {
  clearInterval(ticker);
  logStatus();
  out.end(() => {
    console.error("DONE", JSON.stringify({ ...stats, elapsedMin: (Date.now() - stats.start) / 60000 }));
  });
});
