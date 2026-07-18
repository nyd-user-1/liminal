// Harvest status: headline coverage + per-payer detail + Cigna networks/Evernorth.
// node --env-file=.env.local .harvest/status.mjs [--networks]
//
// WHY psql AND NOT THE NEON HTTP DRIVER (@neondatabase/serverless): this report
// aggregates over provider_network_participation (2.4M rows). The HTTP driver
// rides undici, whose 300s headersTimeout turns a slow query into a hard failure
// with no result — the NYS-65 family — which is what disabled the nightly
// fhir-status job. psql speaks the wire protocol and has no such ceiling, so a
// heavy report completes instead of dying. House precedent: scripts/nppes-sync,
// scripts/orgs-sync, scripts/ingest-form5500.
//
// The per-payer aggregate ALSO carried a real bug: count(p.*) dragged every
// 718-byte-wide row through the group sort (2.4M rows, spilled to disk, ~7 min);
// count(p.id) is one column and identical in meaning, cutting it to ~10s. psql
// removes the ceiling; the rewrite removes the cause.

import { spawn } from "node:child_process";

const DB = process.env.DATABASE_URL;
if (!DB) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const SHOW_NETWORKS = process.argv.includes("--networks");

// Run one query through psql and parse tuples-only, tab-separated output into
// row objects keyed by `cols`. Values come back as strings — coerce at the call
// site where arithmetic is needed. ON_ERROR_STOP so a bad query is a non-zero
// exit, not silent empty output.
function query(sql, cols) {
  return new Promise((resolve, reject) => {
    const ps = spawn("psql", [DB, "-v", "ON_ERROR_STOP=1", "-tAF", "\t", "-c", sql], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    ps.stdout.on("data", (d) => (out += d));
    ps.stderr.on("data", (d) => (err += d));
    ps.on("error", reject);
    ps.on("close", (c) => {
      if (c !== 0) return reject(new Error(`psql exit ${c}: ${err.trim()}`));
      const rows = out
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const f = line.split("\t");
          return Object.fromEntries(cols.map((name, i) => [name, f[i]]));
        });
      resolve(rows);
    });
  });
}
const one = async (sql, cols) => (await query(sql, cols))[0];

const { total } = await one(
  `SELECT count(DISTINCT npi)::int FROM directory_providers WHERE npi IS NOT NULL`,
  ["total"],
);
const head = await one(
  `SELECT count(DISTINCT p.npi)::int, count(DISTINCT p.payer_source_id)::int
   FROM provider_network_participation p
   WHERE EXISTS (SELECT 1 FROM directory_providers d WHERE d.npi = p.npi)`,
  ["covered", "payers"],
);
console.log(
  `HEADLINE: ${head.covered} of ${total} providers (${((Number(head.covered) / Number(total)) * 100).toFixed(1)}%) have ≥1 in-network record, across ${head.payers} payer(s)`,
);

// count(p.id), NOT count(p.*) — see the header note. Meaning is identical: p.id
// is NULL only on the LEFT-JOIN-unmatched side, so payers with no participation
// still read rows=0.
const per = await query(
  `SELECT ps.slug,
     count(p.id)::int rows,
     count(DISTINCT p.npi)::int npis,
     count(DISTINCT p.npi) FILTER (WHERE p.accepting_new_patients = 'accepting')::int accepting,
     (SELECT count(*)::int FROM payer_networks n WHERE n.payer_source_id = ps.id) networks,
     (SELECT count(*)::int FROM payer_unmatched_npis u WHERE u.payer_source_id = ps.id) unmatched
   FROM payer_sources ps LEFT JOIN provider_network_participation p ON p.payer_source_id = ps.id
   GROUP BY ps.id, ps.slug ORDER BY rows DESC`,
  ["slug", "rows", "npis", "accepting", "networks", "unmatched"],
);
for (const r of per)
  console.log(`  ${r.slug}: rows=${r.rows} npis=${r.npis} accepting=${r.accepting} networks=${r.networks} unmatched=${r.unmatched}`);

// payer_sources.id is a uuid (no quote chars possible) — safe to inline quoted.
const cig = await one(`SELECT id FROM payer_sources WHERE slug = 'cigna'`, ["id"]);
if (cig?.id) {
  const ev = await one(
    `SELECT count(DISTINCT p.npi)::int FROM provider_network_participation p
     JOIN payer_networks n ON n.id = p.network_id
     WHERE p.payer_source_id = '${cig.id}' AND n.network_name ILIKE '%evernorth%'`,
    ["ev"],
  );
  console.log(`  CIGNA EVERNORTH: ${ev.ev} distinct matched NPIs in networks named *EVERNORTH*`);
  if (SHOW_NETWORKS) {
    const nets = await query(
      `SELECT n.network_name, count(DISTINCT p.npi)::int npis
       FROM payer_networks n LEFT JOIN provider_network_participation p ON p.network_id = n.id
       WHERE n.payer_source_id = '${cig.id}' GROUP BY n.network_name ORDER BY npis DESC`,
      ["network_name", "npis"],
    );
    console.log(`  CIGNA networks (${nets.length}):`);
    for (const n of nets) console.log(`    ${n.npis}\t${n.network_name}`);
  }
}
