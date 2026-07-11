// Harvest status: headline coverage + per-payer detail + Cigna networks/Evernorth.
// node --env-file=.env.local .harvest/status.mjs [--networks]
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const SHOW_NETWORKS = process.argv.includes("--networks");

const [{ total }] = await sql`SELECT count(DISTINCT npi)::int total FROM directory_providers WHERE npi IS NOT NULL`;
const [{ covered, payers }] = await sql`
  SELECT count(DISTINCT p.npi)::int covered, count(DISTINCT p.payer_source_id)::int payers
  FROM provider_network_participation p
  WHERE EXISTS (SELECT 1 FROM directory_providers d WHERE d.npi = p.npi)`;
console.log(`HEADLINE: ${covered} of ${total} providers (${((covered / total) * 100).toFixed(1)}%) have ≥1 in-network record, across ${payers} payer(s)`);

const per = await sql`
  SELECT ps.slug,
    count(p.*)::int rows,
    count(DISTINCT p.npi)::int npis,
    count(DISTINCT p.npi) FILTER (WHERE p.accepting_new_patients = 'accepting')::int accepting,
    (SELECT count(*)::int FROM payer_networks n WHERE n.payer_source_id = ps.id) networks,
    (SELECT count(*)::int FROM payer_unmatched_npis u WHERE u.payer_source_id = ps.id) unmatched
  FROM payer_sources ps LEFT JOIN provider_network_participation p ON p.payer_source_id = ps.id
  GROUP BY ps.id, ps.slug ORDER BY rows DESC`;
for (const r of per) console.log(`  ${r.slug}: rows=${r.rows} npis=${r.npis} accepting=${r.accepting} networks=${r.networks} unmatched=${r.unmatched}`);

const [cig] = await sql`SELECT id FROM payer_sources WHERE slug = 'cigna'`;
if (cig) {
  const [{ ev }] = await sql`
    SELECT count(DISTINCT p.npi)::int ev FROM provider_network_participation p
    JOIN payer_networks n ON n.id = p.network_id
    WHERE p.payer_source_id = ${cig.id} AND n.network_name ILIKE '%evernorth%'`;
  console.log(`  CIGNA EVERNORTH: ${ev} distinct matched NPIs in networks named *EVERNORTH*`);
  if (SHOW_NETWORKS) {
    const nets = await sql`
      SELECT n.network_name, count(DISTINCT p.npi)::int npis
      FROM payer_networks n LEFT JOIN provider_network_participation p ON p.network_id = n.id
      WHERE n.payer_source_id = ${cig.id} GROUP BY n.network_name ORDER BY npis DESC`;
    console.log(`  CIGNA networks (${nets.length}):`);
    for (const n of nets) console.log(`    ${n.npis}\t${n.network_name}`);
  }
}
