#!/usr/bin/env node
// Load scan-tic.mjs CSVs into provider_rate_signals (sql/017). Idempotent:
// exact duplicates collapse on the table's UNIQUE key (ON CONFLICT DO NOTHING)
// — that is the dedup teeth for payers that republish identical rows.
//
//   node --env-file=.env.local scripts/mrf/load-rate-signals.mjs \
//     --as-of=2026-07-12 .harvest/mrf/uhc-behavioral-P3-rates.csv [more.csv …]
//
// as_of = the rate's effective date if the file carries one, else the fetch
// date. UHC/Oxford TiC files carry only expiration (9999-12-31), so pass the
// date the stream ran.

import fs from "node:fs";
import readline from "node:readline";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set. Run with node --env-file=.env.local");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

const asOfArg = process.argv.find((a) => a.startsWith("--as-of="));
if (!asOfArg) {
  console.error("--as-of=YYYY-MM-DD is required (fetch date if the file has no effective date)");
  process.exit(1);
}
const AS_OF = asOfArg.slice(8);
const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!files.length) {
  console.error("No CSV files given.");
  process.exit(1);
}

const BATCH = 1000;
const COLS = 11; // csv columns; as_of is appended by us

async function flush(batch) {
  if (!batch.length) return 0;
  const col = (i) => batch.map((r) => r[i]);
  const res = await sql.query(
    `INSERT INTO provider_rate_signals
       (npi, payer, plan_or_network, billing_code, negotiated_rate,
        negotiated_type, billing_class, place_of_service, tin, source_file,
        file_date, as_of)
     SELECT * FROM unnest(
       $1::text[], $2::text[], $3::text[], $4::text[], $5::numeric[],
       $6::text[], $7::text[], $8::text[], $9::text[], $10::text[],
       $11::date[], $12::date[])
     ON CONFLICT DO NOTHING`,
    [...Array.from({ length: COLS }, (_, i) => col(i)), batch.map(() => AS_OF)]
  );
  return res.length ?? 0;
}

let totalRead = 0;
for (const file of files) {
  const rl = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  });
  let header = null;
  let batch = [];
  let read = 0;
  let skipped = 0;
  for await (const line of rl) {
    if (!header) {
      header = line;
      continue;
    }
    if (!line) continue;
    const c = line.split(",");
    if (c.length !== COLS || c.some((v) => v.startsWith('"'))) {
      // scan-tic only quotes on embedded commas/quotes, which our payer/
      // network/tin values never contain — treat any quoted row as a red flag
      skipped++;
      continue;
    }
    read++;
    batch.push(c);
    if (batch.length >= BATCH) {
      await flush(batch);
      batch = [];
    }
  }
  await flush(batch);
  totalRead += read;
  console.log(`${file}: ${read} rows read${skipped ? `, ${skipped} SKIPPED (quoted fields — inspect!)` : ""}`);
}

const [{ count }] = await sql`SELECT count(*)::int AS count FROM provider_rate_signals`;
console.log(`read ${totalRead} rows total; provider_rate_signals now holds ${count} rows`);
