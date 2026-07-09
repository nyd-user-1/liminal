// One-off: give Lena Whitfield + Marcus Bell (demo practitioners with a real
// provider_profiles row but no availability) the same M-F 9-5 slate as the
// other bookable demo practitioners, so their homepage spotlight card can
// show a real, computed "next opening" instead of a made-up one. Idempotent.
// Run:
//   node --env-file=.env.local scripts/add-lena-marcus-availability.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const IDS = {
  "Lena Whitfield": "00000000-0000-4000-8000-000000001004",
  "Marcus Bell": "00000000-0000-4000-8000-000000001005",
};

for (const [name, id] of Object.entries(IDS)) {
  await sql`DELETE FROM availability WHERE practitioner_id = ${id}`;
  for (const weekday of [1, 2, 3, 4, 5]) {
    await sql`INSERT INTO availability (id, practitioner_id, weekday, start_time, end_time)
      VALUES (gen_random_uuid(), ${id}, ${weekday}, '09:00', '17:00')`;
  }
  const [a] = await sql`SELECT count(*)::int AS n FROM availability WHERE practitioner_id = ${id}`;
  console.log(`✓ ${name} — ${a.n} availability rows`);
}
