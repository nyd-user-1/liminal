#!/usr/bin/env node
// STEP-0 handshake for the approved Anthem Provider Directory API (NYS-15).
// Read-only, ≤4 GETs, harvests NOTHING — verify then stop, per the TASK-AETNA
// pattern: token → /metadata → one NPI search → report and STOP for review.
//
//   node --env-file=.env.local scripts/probe-anthem.mjs [--npi=1234567890]
//
// Approval email 2026-07-13: API Type "Provider Directory" (NOT Patient Access;
// patient360.anthem.com / fhir.anthem.com/r4/ remain forbidden — see
// scripts/probe-payers.mjs FORBIDDEN guards).

import fs from "node:fs";

const TOKEN_URL = "https://totalview.healthos.elevancehealth.com/client.oauth2/unregistered/api/v1/token";
const FHIR_BASE = "https://totalview.healthos.elevancehealth.com/resources/unregistered/api/v1/fhir/cms_mandate/mcd";

const ID = process.env.ANTHEM_CLIENT_ID;
const SECRET = process.env.ANTHEM_CLIENT_SECRET;
if (!ID || !SECRET) {
  console.error("ANTHEM_CLIENT_ID / ANTHEM_CLIENT_SECRET not set. Run with node --env-file=.env.local");
  process.exit(1);
}

const npiArg = process.argv.find((a) => a.startsWith("--npi="));
const NPI = npiArg
  ? npiArg.slice(6)
  : fs.readFileSync(".harvest/mrf/npis.txt", "utf8").split("\n").find((l) => /^\d{10}$/.test(l.trim()))?.trim();

async function getToken() {
  // Try the two common client-credentials shapes: form body, then Basic auth.
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
  const txt = await r.text();
  let j = null;
  try { j = JSON.parse(txt); } catch { /* HTML/WAF */ }
  return { status: r.status, json: j, textHead: txt.slice(0, 200) };
}

async function fhirGet(path, token) {
  const r = await fetch(`${FHIR_BASE}${path}`, {
    headers: { Accept: "application/fhir+json", Authorization: `Bearer ${token}` },
  });
  const txt = await r.text();
  let j = null;
  try { j = JSON.parse(txt); } catch { /* non-JSON */ }
  return { status: r.status, json: j, textHead: txt.slice(0, 200) };
}

const tok = await getToken();
if (!tok.json?.access_token) {
  console.error(`TOKEN FAILED: HTTP ${tok.status}`);
  console.error(tok.textHead);
  process.exit(2);
}
console.log(`token OK: type=${tok.json.token_type} ttl=${tok.json.expires_in}s scope=${tok.json.scope ?? "(none reported)"}`);
const T = tok.json.access_token;

const meta = await fhirGet("/metadata", T);
if (meta.status !== 200 || !meta.json) {
  console.error(`METADATA FAILED: HTTP ${meta.status} — ${meta.textHead}`);
  process.exit(3);
}
const cs = meta.json;
const rests = cs.rest?.[0]?.resource ?? [];
const names = rests.map((x) => x.type);
console.log(`metadata OK: FHIR ${cs.fhirVersion} · software=${cs.software?.name ?? "?"} ${cs.software?.version ?? ""}`);
console.log(`  IG: ${(cs.implementationGuide ?? []).join(", ") || "(none declared)"}`);
console.log(`  resources (${names.length}): ${names.join(", ")}`);
const prac = rests.find((x) => x.type === "Practitioner");
console.log(`  Practitioner search params: ${(prac?.searchParam ?? []).map((s) => s.name).join(", ") || "(none listed)"}`);

if (!NPI) {
  console.log("no NPI available for search test (pass --npi=) — STOPPING after metadata.");
  process.exit(0);
}
const search = await fhirGet(`/Practitioner?identifier=http://hl7.org/fhir/sid/us-npi%7C${NPI}`, T);
const total = search.json?.total ?? search.json?.entry?.length ?? "?";
console.log(`NPI search (${NPI}): HTTP ${search.status} · matches=${total}`);
const first = search.json?.entry?.[0]?.resource;
if (first) {
  const npiId = (first.identifier ?? []).find((i) => /us-npi/.test(i.system ?? ""));
  console.log(`  first hit: ${first.resourceType}/${first.id} · carries us-npi identifier: ${npiId ? "YES (" + npiId.value + ")" : "NO"}`);
}
console.log("STEP-0 COMPLETE — report above. STOPPING (no harvest until reviewed).");
