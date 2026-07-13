#!/usr/bin/env node
// Stream-load: read scan-tic CSV from stdin and batch-insert into
// provider_rate_signals — no intermediate file. The pipe-to-loader path for
// payers whose CSV output won't fit local disk (Aetna: 43M+ rows/file):
//
//   curl -sSL <url> | gunzip -c \
//     | node scripts/mrf/scan-tic.mjs --npis=… --out=- --payer=… --network=… \
//         --source-file=… --file-date=… \
//     | node --env-file=.env.local scripts/mrf/stream-load.mjs --as-of=YYYY-MM-DD
//
// Idempotent (ON CONFLICT DO NOTHING, same UNIQUE key as sql/017). Memory-
// bounded: batches of BATCH rows, input paused during each Neon flush so the
// upstream scanner backpressures instead of buffering unboundedly.

import readline from "node:readline";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set. Run with node --env-file=.env.local");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

const asOfArg = process.argv.find((a) => a.startsWith("--as-of="));
if (!asOfArg) {
  console.error("--as-of=YYYY-MM-DD required (fetch date if the file carries no effective date)");
  process.exit(1);
}
const AS_OF = asOfArg.slice(8);
const BATCH = 1000;
const COLS = 11;

async function flush(batch) {
  if (!batch.length) return;
  const col = (i) => batch.map((r) => r[i]);
  await sql.query(
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
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let header = null;
let batch = [];
let read = 0;
let skipped = 0;
let inserted = 0;
const t0 = Date.now();
let ticker = setInterval(() => {
  console.error(`[${((Date.now() - t0) / 60000).toFixed(1)}m] stream-load: ${read} rows read, ${inserted} sent`);
}, 15000);

rl.on("line", (line) => {
  if (!header) { header = line; return; }
  if (!line) return;
  const c = line.split(",");
  // scan-tic only quotes on embedded commas/quotes, which our values don't
  // carry; treat any short/quoted row as a red flag rather than mis-insert
  if (c.length !== COLS || c.some((v) => v.startsWith('"'))) { skipped++; return; }
  read++;
  batch.push(c);
  if (batch.length >= BATCH) {
    const b = batch; batch = [];
    rl.pause();
    flush(b).then(() => { inserted += b.length; rl.resume(); })
      .catch((e) => { console.error("FLUSH ERROR:", e.message); process.exit(2); });
  }
});

rl.on("close", async () => {
  clearInterval(ticker);
  try { await flush(batch); inserted += batch.length; }
  catch (e) { console.error("FINAL FLUSH ERROR:", e.message); process.exit(2); }
  console.error(`stream-load DONE: ${read} rows read, ${inserted} inserted${skipped ? `, ${skipped} skipped` : ""}`);
});
