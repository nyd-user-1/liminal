#!/usr/bin/env node
// MRF PoC — analyze the rates CSV emitted by scan-tic.mjs and measure the
// empty-shell backfill against provider_network_participation (read-only).
//
//   node --env-file=.env.local scripts/mrf/report.mjs --csv=.harvest/mrf/uhc-behavioral-P3.csv
//
// No writes to Neon: the UHC participation sets are pulled with two SELECTs
// and the joins happen here.

import fs from "node:fs";
import readline from "node:readline";
import { neon } from "@neondatabase/serverless";

const arg = (name, dflt) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};
const CSV = arg("csv");
if (!CSV) {
  console.error("Usage: node scripts/mrf/report.mjs --csv=<rates.csv>");
  process.exit(1);
}

// Everything that is NOT commercial, per the brief: Medicaid / Medicare /
// DSNP / Community Plan and kin. Exchange QHPs and employer/TPA groups count
// as commercial.
const NON_COMMERCIAL_RE =
  /medicare|medicaid|d-?snp|dual|community plan|chip|child health plus|essential plan|i-snp|c-snp|nursing home|aarp|tenncare|kancare|star|quest|pathways|hoosier|turquoise|mma\b|ltc|sco\b|one care|va ccn|healthy michigan|senior care|erickson|peoples health|medicaremax|wellness4me|fida/i;

const quantile = (sorted, q) => {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

// ---- pass over the CSV ----------------------------------------------------
const rl = readline.createInterface({
  input: fs.createReadStream(CSV),
  crlfDelay: Infinity,
});

let header = null;
let rows = 0;
let dupRows = 0;
const seenRows = new Set();
const npis = new Set();
const byCodeType = new Map(); // `${code}|${type}` -> rates[]
const typeCounts = new Map();
const classCounts = new Map();
const npiTins = new Map(); // npi -> Set(tin)
const rateNpis = new Map(); // `${code}|${rate}` -> Set(npi) (zombie smell)
const codeNpis = new Map(); // code -> Set(npi)

for await (const line of rl) {
  if (!header) {
    header = line;
    continue;
  }
  if (!line) continue;
  rows++;
  if (seenRows.has(line)) dupRows++;
  else seenRows.add(line);

  // columns: npi,payer,plan_or_network,billing_code,negotiated_rate,
  // negotiated_type,billing_class,place_of_service,tin,source_file,file_date
  // payer/network/tin may be quoted but contain no commas in our data; the
  // tin column is `type:value` and unquoted unless it contains a comma.
  const c = line.split(",");
  if (c.length < 11) continue; // quoted-comma row: rare; skip for stats
  const [npi, , , code, rate, type, klass, , tin] = c;
  npis.add(npi);
  typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  classCounts.set(klass, (classCounts.get(klass) ?? 0) + 1);
  (codeNpis.get(code) ?? codeNpis.set(code, new Set()).get(code)).add(npi);
  const key = `${code}|${type}`;
  (byCodeType.get(key) ?? byCodeType.set(key, []).get(key)).push(Number(rate));
  (npiTins.get(npi) ?? npiTins.set(npi, new Set()).get(npi)).add(tin);
  const rk = `${code}|${rate}`;
  (rateNpis.get(rk) ?? rateNpis.set(rk, new Set()).get(rk)).add(npi);
}

console.log(`\n== ${CSV}`);
console.log(`rows: ${rows}  (exact duplicate rows: ${dupRows})`);
console.log(`distinct NPIs with >=1 rate: ${npis.size}`);
console.log(`negotiated_type mix: ${[...typeCounts].map(([k, v]) => `${k}=${v}`).join("  ")}`);
console.log(`billing_class mix: ${[...classCounts].map(([k, v]) => `${k}=${v}`).join("  ")}`);

console.log("\n== rate distribution per CPT (per negotiated_type)");
for (const [key, arr] of [...byCodeType].sort()) {
  arr.sort((a, b) => a - b);
  const [code, type] = key.split("|");
  console.log(
    `${code} ${type.padEnd(12)} n=${String(arr.length).padStart(7)}  npis=${String(
      codeNpis.get(code)?.size ?? 0
    ).padStart(6)}  min=${arr[0].toFixed(2)}  p25=${quantile(arr, 0.25).toFixed(2)}  median=${quantile(
      arr,
      0.5
    ).toFixed(2)}  p75=${quantile(arr, 0.75).toFixed(2)}  max=${arr[arr.length - 1].toFixed(2)}`
  );
}

console.log("\n== zombie smell: top identical (code, rate) by distinct-NPI count");
const zombies = [...rateNpis]
  .map(([k, s]) => [k, s.size])
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8);
for (const [k, n] of zombies) console.log(`  ${k.padEnd(18)} -> ${n} NPIs`);

const multiTin = [...npiTins].filter(([, s]) => s.size > 3);
console.log(`\nNPIs appearing under >3 TINs: ${multiTin.length}`);
for (const [npi, s] of multiTin.sort((a, b) => b[1].size - a[1].size).slice(0, 5))
  console.log(`  ${npi} -> ${s.size} TINs`);

// ---- empty-shell backfill (read-only Neon) --------------------------------
if (!process.env.DATABASE_URL) {
  console.log("\nDATABASE_URL not set — skipping the backfill join.");
  process.exit(0);
}
const sql = neon(process.env.DATABASE_URL);

const uhcRows = await sql`
  SELECT pnp.npi, coalesce(pn.network_name, '') AS network_name
  FROM provider_network_participation pnp
  JOIN payer_sources ps ON ps.id = pnp.payer_source_id
  LEFT JOIN payer_networks pn ON pn.id = pnp.network_id
  WHERE ps.slug = 'uhc'`;

const uhcAny = new Set();
const uhcCommercial = new Set();
for (const r of uhcRows) {
  uhcAny.add(r.npi);
  if (r.network_name && !NON_COMMERCIAL_RE.test(r.network_name)) uhcCommercial.add(r.npi);
}

let inAny = 0;
let inCommercial = 0;
for (const npi of npis) {
  if (uhcAny.has(npi)) inAny++;
  if (uhcCommercial.has(npi)) inCommercial++;
}

console.log("\n== EMPTY-SHELL BACKFILL");
console.log(`UHC FHIR-directory NPIs (any network):        ${uhcAny.size}`);
console.log(`UHC FHIR-directory NPIs (commercial network): ${uhcCommercial.size}`);
console.log(`MRF-matched NPIs:                             ${npis.size}`);
console.log(`  ... also listed under uhc (any network):    ${inAny}`);
console.log(`  ... also listed under a COMMERCIAL network: ${inCommercial}`);
console.log(
  `HEADLINE — rate exists but NOT under any UHC commercial network: ${npis.size - inCommercial}`
);
console.log(
  `  (of which not under uhc at all: ${npis.size - inAny}; under uhc but only non-commercial/unspecified: ${inAny - inCommercial})`
);
