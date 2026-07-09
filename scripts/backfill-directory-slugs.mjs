/**
 * One-time backfill: persisted SEO slugs for directory_providers (~116k rows).
 *
 * Collision policy (lib/slug.ts): bare name → name-city → name-<base36 counter>.
 * All ~116k slugs are generated in a single in-process pass against an
 * in-memory Set of already-taken slugs — no per-row DB round trip for the
 * uniqueness check. Writes go back in batches (UPDATE ... FROM unnest(...))
 * so the whole run is a few hundred round trips, not one per row.
 *
 * Idempotent: only rows with slug IS NULL are considered; safe to re-run if
 * interrupted (already-slugged rows are simply skipped on the next pass).
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-directory-slugs.mjs
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const BATCH_SIZE = 1000;
const PAUSE_EVERY = 20; // batches — ease off Neon periodically
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slugify(input) {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueSlug(name, city, taken) {
  const base = slugify(name) || "provider";
  if (!taken.has(base)) return base;

  if (city) {
    const withCity = `${base}-${slugify(city)}`;
    if (!taken.has(withCity)) return withCity;
  }

  for (let n = 2; n < 46656; n++) {
    const candidate = `${base}-${n.toString(36)}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`Could not generate a unique slug for "${name}"`);
}

async function main() {
  console.log("Loading existing slugs...");
  const existing = await sql`SELECT slug FROM directory_providers WHERE slug IS NOT NULL`;
  const taken = new Set(existing.map((r) => r.slug));
  console.log(`  ${taken.size} rows already slugged`);

  console.log("Loading rows needing a slug...");
  const rows = await sql`SELECT id, name, city FROM directory_providers WHERE slug IS NULL ORDER BY id`;
  console.log(`  ${rows.length} rows to backfill`);

  const assignments = rows.map((r) => {
    const slug = uniqueSlug(r.name, r.city, taken);
    taken.add(slug);
    return { id: r.id, slug };
  });

  let written = 0;
  let batches = 0;
  for (let i = 0; i < assignments.length; i += BATCH_SIZE) {
    const chunk = assignments.slice(i, i + BATCH_SIZE);
    const ids = chunk.map((c) => c.id);
    const slugs = chunk.map((c) => c.slug);
    const text = `
      UPDATE directory_providers d SET slug = v.slug
      FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::text[]) AS slug) v
      WHERE d.id = v.id
    `;
    try {
      await sql.query(text, [ids, slugs]);
    } catch (err) {
      console.error(`  batch error at offset ${i}, retrying once: ${err.message}`);
      await sql.query(text, [ids, slugs]);
    }
    written += chunk.length;
    batches++;
    process.stdout.write(`\r  ${written}/${assignments.length} written`);
    if (batches % PAUSE_EVERY === 0) await sleep(500);
  }
  console.log(`\nDone. ${written} rows backfilled.`);

  const [{ n }] = await sql`SELECT count(*)::int AS n FROM directory_providers WHERE slug IS NULL`;
  console.log(`Remaining with no slug: ${n}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
