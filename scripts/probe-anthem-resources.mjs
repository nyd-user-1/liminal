#!/usr/bin/env node
// Recon for NYS-53 sub-issues (Location/Organization/OrganizationAffiliation/
// HealthcareService/InsurancePlan). Read-only, a handful of GETs — safe to run
// alongside the live harvest. Learns each resource's search params + response
// shape so the harvester (ingest-anthem-resources.mjs) can be built correctly.
//
//   node --env-file=.env.local scripts/probe-anthem-resources.mjs

const TOKEN_URL = "https://totalview.healthos.elevancehealth.com/client.oauth2/unregistered/api/v1/token";
const FHIR_BASE = "https://totalview.healthos.elevancehealth.com/resources/unregistered/api/v1/fhir/cms_mandate/mcd";
const ID = process.env.ANTHEM_CLIENT_ID;
const SECRET = process.env.ANTHEM_CLIENT_SECRET;
if (!ID || !SECRET) {
  console.error("ANTHEM_CLIENT_ID / ANTHEM_CLIENT_SECRET not set (node --env-file=.env.local)");
  process.exit(1);
}
// Known-good refs pulled from our stored raws.
const LOC = "Location/06c441086ecb2af2144822a3ff013dad";
const ORG = "Organization/11516f5e4683fa8fc1dfadaf591fa12e";

async function getToken() {
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: ID, client_secret: SECRET });
  let r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  if (r.status === 401 || r.status === 400) {
    const basic = Buffer.from(`${ID}:${SECRET}`).toString("base64");
    r = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", Authorization: `Basic ${basic}` },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });
  }
  return (await r.json())?.access_token;
}
async function get(path, token) {
  const r = await fetch(`${FHIR_BASE}${path}`, {
    headers: { Accept: "application/fhir+json", Authorization: `Bearer ${token}` },
  });
  let j = null;
  const t = await r.text();
  try { j = JSON.parse(t); } catch { /* non-JSON */ }
  return { status: r.status, json: j, textHead: t.slice(0, 160) };
}
const keys = (o) => (o && typeof o === "object" ? Object.keys(o).join(", ") : String(o));

const T = await getToken();
if (!T) { console.error("TOKEN FAILED"); process.exit(2); }
console.log("token OK\n");

const meta = await get("/metadata", T);
const rests = meta.json?.rest?.[0]?.resource ?? [];
console.log("=== search params per resource ===");
for (const r of rests) console.log(`  ${r.type}: ${(r.searchParam ?? []).map((s) => s.name).join(", ") || "(none)"}`);

console.log("\n=== Location dereference ===");
const loc = await get(`/${LOC}`, T);
console.log(`  HTTP ${loc.status} · top-level keys: ${keys(loc.json)}`);
if (loc.json) console.log("  " + JSON.stringify(loc.json).slice(0, 700));

console.log("\n=== Organization dereference ===");
const org = await get(`/${ORG}`, T);
console.log(`  HTTP ${org.status} · top-level keys: ${keys(org.json)}`);
if (org.json) console.log("  " + JSON.stringify(org.json).slice(0, 700));

for (const rt of ["OrganizationAffiliation", "HealthcareService", "InsurancePlan"]) {
  console.log(`\n=== ${rt} bulk search (_count=2) ===`);
  const s = await get(`/${rt}?_count=2`, T);
  console.log(`  HTTP ${s.status} · bundle total=${s.json?.total ?? "?"} · entries=${s.json?.entry?.length ?? 0}`);
  const first = s.json?.entry?.[0]?.resource;
  if (first) {
    console.log(`  first resource keys: ${keys(first)}`);
    console.log("  " + JSON.stringify(first).slice(0, 800));
  } else if (s.status !== 200) {
    console.log(`  ${s.textHead}`);
  }
}
console.log("\nRECON COMPLETE — read-only, no harvest.");
