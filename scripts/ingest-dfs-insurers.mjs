#!/usr/bin/env node
// NYS DFS company directory → sql/042 dfs_insurers (NYS-104).
//
//   node --env-file=.env.local scripts/ingest-dfs-insurers.mjs
//
// The DFS portal (myportal.dfs.ny.gov) fronts a plain JSP app at
// /companydirectory/; srch_results.jsp answers an org-type POST with the full
// list in one page (no pagination — verified on LF, the largest at 127 rows).
// We sweep the health-family org types + Life. Each result row is
//   NAIC# | name (link carries DFS's internal file number) | org type
//   | domicile | group_code/group_name | FEIN | website
// and the whole sweep is ~350 rows, so the load is one psql txn with an
// ON CONFLICT upsert keyed on the DFS file number (cpat_num) — idempotent,
// re-runnable, and safe to re-sweep whenever DFS licenses a new entity.

import { spawn } from "node:child_process";

const DB = process.env.DATABASE_URL;
if (!DB) { console.error("DATABASE_URL not set"); process.exit(1); }

const BASE = "https://myportal.dfs.ny.gov/companydirectory/srch_results.jsp";
const ORG_TYPES = ["AH", "HMO", "MHL", "MME", "MDE", "PHS", "MCH", "MLT", "LF"];

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

async function fetchList(orgType) {
  const body = new URLSearchParams({
    srch_way: "org_typ", sort_by: "comp_nam", source: "o",
    frst: "dir_srch_optiono", filekey: "dir", para1: orgType,
  });
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`${orgType}: HTTP ${res.status}`);
  return res.text();
}

// One <tr> per company; cells in order:
//   NAIC | name (dir_det link carries DFS's file number) | org type
//   | domicile | group_code/group_name | FEIN | website
function parseRows(html, orgType) {
  const rows = [];
  for (const trm of html.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...trm[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (cells.length < 6) continue; // header/title rows
    const link = cells[1].match(/dir_det\.jsp\?search_value=(\d+)[^"]*"[^>]*>([^<]*)</i);
    if (!link) continue;
    const g = decode(cells[4]);
    const slash = g.indexOf("/");
    const fein = decode(cells[5]);
    const site = (cells[6] ?? "").match(/<a[^>]*>([^<]*)<\/a>/i);
    rows.push({
      cpat_num: Number(link[1]),
      naic: decode(cells[0]) || null,
      name: decode(link[2]),
      org_type: decode(cells[2]) || orgType,
      domicile: decode(cells[3]) || null,
      group_code: slash > 0 ? g.slice(0, slash) : null,
      group_name: slash > 0 ? g.slice(slash + 1) : null,
      fein: /^\d{9}$/.test(fein) ? fein : null,
      website: site ? decode(site[1]) : null,
    });
  }
  return rows;
}

const csvField = (v) =>
  v === null || v === undefined || v === "" ? "" : `"${String(v).replace(/"/g, '""')}"`;
const csvRow = (vals) => vals.map(csvField).join(",") + "\n";

const all = new Map(); // cpat_num → row (an entity has one org type; Map guards dupes anyway)
for (const t of ORG_TYPES) {
  const html = await fetchList(t);
  const rows = parseRows(html, t);
  if (rows.length === 0) throw new Error(`${t}: 0 rows parsed — layout drift, aborting before load`);
  for (const r of rows) all.set(r.cpat_num, r);
  console.log(`${t}: ${rows.length} rows`);
}
console.log(`total distinct entities: ${all.size}`);

const sqlHead = `
BEGIN;
CREATE TEMP TABLE stage (LIKE dfs_insurers INCLUDING DEFAULTS) ON COMMIT DROP;
ALTER TABLE stage DROP COLUMN loaded_at;
COPY stage (cpat_num, naic, name, org_type, domicile, group_code, group_name, fein, website) FROM STDIN WITH (FORMAT csv);
`;
const sqlTail = `\\.
INSERT INTO dfs_insurers (cpat_num, naic, name, org_type, domicile, group_code, group_name, fein, website)
SELECT cpat_num, naic, name, org_type, domicile, group_code, group_name, fein, website FROM stage
ON CONFLICT (cpat_num) DO UPDATE SET
  naic = EXCLUDED.naic, name = EXCLUDED.name, org_type = EXCLUDED.org_type,
  domicile = EXCLUDED.domicile, group_code = EXCLUDED.group_code,
  group_name = EXCLUDED.group_name, fein = EXCLUDED.fein,
  website = EXCLUDED.website, loaded_at = now();
COMMIT;
SELECT org_type, count(*) FROM dfs_insurers GROUP BY 1 ORDER BY 1;
`;

const psql = spawn("psql", [DB, "-X", "-q", "-v", "ON_ERROR_STOP=1"], {
  stdio: ["pipe", "inherit", "inherit"],
});
psql.stdin.write(sqlHead);
for (const r of all.values()) {
  psql.stdin.write(csvRow([
    r.cpat_num, r.naic, r.name, r.org_type, r.domicile,
    r.group_code, r.group_name, r.fein, r.website,
  ]));
}
psql.stdin.write(sqlTail);
psql.stdin.end();
const code = await new Promise((res) => psql.on("close", res));
process.exit(code === 0 ? 0 : 1);
