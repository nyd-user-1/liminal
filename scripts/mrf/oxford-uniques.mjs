#!/usr/bin/env node
// Oxford coverage join — for the NPIs in the Oxford CSVs, how many have NO
// other payer signal at all: no FHIR-directory participation under ANY payer
// source AND no non-Oxford negotiated rate. Those providers' ONLY in-network
// evidence anywhere is the Oxford contract — the number that justifies the run.
// Read-only against Neon.
//
//   node --env-file=.env.local scripts/mrf/oxford-uniques.mjs .harvest/mrf/oxford/*.csv

import fs from "node:fs";
import readline from "node:readline";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set.");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!files.length) {
  console.error("No CSVs given.");
  process.exit(1);
}

const oxfordNpis = new Set();
const byNetwork = new Map(); // network -> Set(npi)
for (const file of files) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  let header = null;
  for await (const line of rl) {
    if (!header) { header = line; continue; }
    if (!line) continue;
    const c = line.split(",");
    if (c.length < 11) continue;
    oxfordNpis.add(c[0]);
    const net = c[2];
    (byNetwork.get(net) ?? byNetwork.set(net, new Set()).get(net)).add(c[0]);
  }
}

const inDirectory = new Set(
  (await sql`SELECT DISTINCT npi FROM provider_network_participation`).map((r) => r.npi)
);
const hasOtherRate = new Set(
  (await sql`SELECT DISTINCT npi FROM provider_rate_signals WHERE payer NOT ILIKE '%oxford%'`).map(
    (r) => r.npi
  )
);

let dirOnly = 0, rateOnly = 0, both = 0, neither = 0;
for (const npi of oxfordNpis) {
  const d = inDirectory.has(npi);
  const r = hasOtherRate.has(npi);
  if (d && r) both++;
  else if (d) dirOnly++;
  else if (r) rateOnly++;
  else neither++;
}

console.log(`Oxford-matched NPIs: ${oxfordNpis.size}`);
console.log(`per network: ${[...byNetwork].map(([n, s]) => `${n}=${s.size}`).join("  ")}`);
console.log(`\nother-signal breakdown for those NPIs:`);
console.log(`  also in a FHIR directory (any payer) AND have another rate: ${both}`);
console.log(`  also in a FHIR directory (any payer) only:                  ${dirOnly}`);
console.log(`  also have a non-Oxford rate (UHC P3) only:                  ${rateOnly}`);
console.log(`  NO OTHER PAYER SIGNAL AT ALL (Oxford is the only evidence): ${neither}`);
