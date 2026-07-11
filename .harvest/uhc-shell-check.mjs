// Empty-shell verification — re-measures the six UHC behavioral networks' role
// counts straight from the feed, plus our DB's matched NPIs per UHC network.
// Run at UHC harvest completion (and any time after):
//   node --env-file=.env.local .harvest/uhc-shell-check.mjs
// If Behavioral Commercial still reports 0 after the full 99k-NPI harvest, the
// central finding in docs/PAYER-RESEARCH.md is dispositive. Server caps
// Bundle.total at 10,000 → "10000" means "≥10,000".
import { neon } from "@neondatabase/serverless";

const BASE = "https://flex.optum.com/fhirpublic/R4";
const SHELLS = [
  ["Behavioral Medicare", "xDLOTOYNVrOijVMWTIq7RVCzwtVLw5lVUmKN3a8am9Y"],
  ["Behavioral Commercial", "RD5noSllOKFrviCTcT84MBscCGOVG8R4wVHKfn8ORl1"],
  ["Behavioral Medicaid", "s4LOPHRDhKxyDelxihCKYBSViy5l3o3fV3OaG6L1Pk5"],
  ["Behavioral Compass HMO", "WiJNdDec0aSSHIrYFwBY8bNiQsWgjDOrRUcS8RUIPH8"],
  ["Behavioral UHC Core Essential HMO", "b3gDaUqgDelT0Hljlm0mM31ehJ8yk68rzlB9dU2RfMY"],
  ["Behavioral Navigate EPO", "UPlgxwPJ3Vos4Num14OLS67Jk8rUeRYEYJr764TbSiw"],
];

console.log(`Feed-level role counts (${new Date().toISOString()}):`);
for (const [name, id] of SHELLS) {
  const res = await fetch(`${BASE}/PractitionerRole?network=${encodeURIComponent(`Organization/${id}`)}&_count=1`, {
    headers: { Accept: "application/fhir+json" },
  });
  const j = await res.json().catch(() => ({}));
  console.log(`  ${name} → ${j.total ?? `HTTP ${res.status}`}`);
  await new Promise((r) => setTimeout(r, 400));
}

if (process.env.DATABASE_URL) {
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT n.network_name, count(DISTINCT p.npi)::int npis
    FROM payer_networks n
    JOIN payer_sources s ON s.id = n.payer_source_id
    LEFT JOIN provider_network_participation p ON p.network_id = n.id
    WHERE s.slug = 'uhc'
    GROUP BY n.network_name ORDER BY npis DESC`;
  const [{ n: probed }] = await sql`
    SELECT count(DISTINCT p.npi)::int n FROM provider_network_participation p
    JOIN payer_sources s ON s.id = p.payer_source_id WHERE s.slug = 'uhc'`;
  console.log(`\nOur DB: ${probed} distinct matched NPIs across ${rows.length} UHC networks:`);
  for (const r of rows) console.log(`  ${String(r.npis).padStart(5)}  ${r.network_name}`);
}
