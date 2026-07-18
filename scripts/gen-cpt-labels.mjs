#!/usr/bin/env node
// Regenerate lib/cpt-labels.generated.ts from the cpt_codes table.
//
//   node --env-file=.env.local scripts/gen-cpt-labels.mjs
//
// cpt_codes (sql/033 §8 + sql/050) is the SINGLE SOURCE of our plain-language
// CPT display labels. But repo modules can't cross into the browser bundle
// (importing lib/db throws "DATABASE_URL is not set" client-side), so the
// client-safe consumers — components/rates/cpt.ts (cptLabel + RATE_CPTS),
// lib/rate-table.ts (RATE_CODES), lib/repos/plans.ts (CPT_LABELS) — read a
// checked-in generated map instead of the DB. Run this after editing cpt_codes
// (or after a migration that touches it) and commit the regenerated file.
//
// A tiny read (~20 rows) — the Neon HTTP driver is fine here; no NYS-65 ceiling.
import { neon } from "@neondatabase/serverless";
import { writeFileSync } from "node:fs";

const DB = process.env.DATABASE_URL;
if (!DB) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const sql = neon(DB);

const rows = await sql`
  SELECT code, display_name FROM cpt_codes WHERE active ORDER BY code
`;
if (rows.length === 0) {
  console.error("cpt_codes is empty — refusing to write an empty label map");
  process.exit(1);
}

const entries = rows.map((r) => `  ${JSON.stringify(r.code)}: ${JSON.stringify(r.display_name)},`).join("\n");
const out = `// GENERATED FILE — do not edit by hand.
// Source of truth: the cpt_codes table (sql/033 §8 + sql/050).
// Regenerate:  node --env-file=.env.local scripts/gen-cpt-labels.mjs
//
// The single client-safe CPT label map. Every rendering surface reads it so the
// wording never forks across components/rates/cpt.ts, lib/rate-table.ts and
// lib/repos/plans.ts. NOT AMA descriptor text — our own plain-language wording.

export const CPT_LABELS: Record<string, string> = {
${entries}
};
`;

const target = new URL("../lib/cpt-labels.generated.ts", import.meta.url);
writeFileSync(target, out);
console.log(`wrote lib/cpt-labels.generated.ts (${rows.length} codes)`);
