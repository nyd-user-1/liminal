#!/usr/bin/env node
// STEP-0 handshake for Photon e-prescribing (Neutron sandbox), per the
// TASK-AETNA / probe-anthem pattern: token → cheapest read-only query →
// report and STOP. Read-only: runs NO mutations against the sandbox.
//
//   node --env-file=.env.local scripts/probe-photon.mjs
//
// Every host comes from env (PHOTON_AUTH_URL / PHOTON_API_URL / PHOTON_AUDIENCE)
// so this probe points at production the day those vars do. Never prints the
// secret or the bearer token — only non-secret token metadata and claims.

const AUTH_URL = process.env.PHOTON_AUTH_URL;
const API_URL = process.env.PHOTON_API_URL;
const AUDIENCE = process.env.PHOTON_AUDIENCE;
const ID = process.env.PHOTON_M2M_CLIENT_ID;
const SECRET = process.env.PHOTON_M2M_CLIENT_SECRET;

const missing = Object.entries({
  PHOTON_AUTH_URL: AUTH_URL,
  PHOTON_API_URL: API_URL,
  PHOTON_AUDIENCE: AUDIENCE,
  PHOTON_M2M_CLIENT_ID: ID,
  PHOTON_M2M_CLIENT_SECRET: SECRET,
})
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) {
  console.error(`Missing env: ${missing.join(", ")}. Run with node --env-file=.env.local`);
  process.exit(1);
}

function tokenUrl() {
  const u = new URL(AUTH_URL);
  if (u.pathname === "/" || u.pathname === "") u.pathname = "/oauth/token";
  return u.toString();
}

// Photon's auth takes a JSON body (docs.photon.health/docs/authentication),
// not the form-encoded shape most OAuth tenants use.
async function getToken() {
  const r = await fetch(tokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: ID, client_secret: SECRET, audience: AUDIENCE, grant_type: "client_credentials" }),
  });
  const txt = await r.text();
  let j = null;
  try {
    j = JSON.parse(txt);
  } catch {
    /* HTML/WAF */
  }
  return { status: r.status, json: j, textHead: txt.slice(0, 240) };
}

async function gql(query, variables, token) {
  const r = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables: variables ?? {} }),
  });
  const txt = await r.text();
  let j = null;
  try {
    j = JSON.parse(txt);
  } catch {
    /* non-JSON */
  }
  return { status: r.status, json: j, textHead: txt.slice(0, 240) };
}

/** Non-secret claims off the JWT payload (org id lives here; Elements needs it). */
function claims(token) {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

console.log(`env: PHOTON_AUDIENCE=${AUDIENCE} · api=${new URL(API_URL).host} · auth=${new URL(AUTH_URL).host}`);

const tok = await getToken();
if (!tok.json?.access_token) {
  console.error(`TOKEN FAILED (stage=token): HTTP ${tok.status}`);
  console.error(tok.textHead);
  console.error("Check PHOTON_M2M_CLIENT_ID / PHOTON_M2M_CLIENT_SECRET / PHOTON_AUDIENCE.");
  process.exit(2);
}
const T = tok.json.access_token;
console.log(`token OK: type=${tok.json.token_type} ttl=${tok.json.expires_in}s`);
console.log(`  granted scopes: ${tok.json.scope ?? "(none reported)"}`);
const c = claims(T);
if (c) {
  const orgClaim = Object.entries(c).find(([k]) => /org/i.test(k));
  console.log(`  claims: ${Object.keys(c).join(", ")}`);
  console.log(`  org id: ${orgClaim ? `${orgClaim[0]}=${orgClaim[1]}` : "(no org claim on the token)"}`);
}

// Cheapest read-only query in the schema: a static catalog list, no org data.
const du = await gql("query { dispenseUnits { name } }", null, T);
if (du.status !== 200 || !du.json?.data) {
  console.error(`QUERY FAILED (stage=query): HTTP ${du.status} — ${du.json?.errors?.[0]?.message ?? du.textHead}`);
  console.error(`Check PHOTON_API_URL (currently host=${new URL(API_URL).host}).`);
  process.exit(3);
}
const units = du.json.data.dispenseUnits ?? [];
console.log(`query OK: dispenseUnits → ${units.length} units (e.g. ${units.slice(0, 3).map((u) => u.name).join(", ")})`);

// Org-scoped read: proves the token is bound to our Photon organization.
const pat = await gql("query { patients(first: 5) { id externalId name { full } } }", null, T);
if (pat.json?.errors) {
  console.log(`patients read: ERRORS — ${pat.json.errors.map((e) => e.message).join("; ")}`);
} else {
  const rows = pat.json?.data?.patients ?? [];
  console.log(`patients read OK: ${rows.length} patient(s) visible to this org`);
  for (const p of rows) console.log(`  ${p.id} · externalId=${p.externalId ?? "(none)"} · ${p.name?.full ?? "(no name)"}`);
}

console.log("STEP-0 COMPLETE — read-only, no mutations run.");
