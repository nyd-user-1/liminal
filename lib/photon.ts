// Photon (photon.health) e-prescribing — server-side M2M plumbing.
//
// SERVER ONLY. Never import from a client component: this module reads
// PHOTON_M2M_CLIENT_SECRET. The browser half of the integration (provider
// login + prescribing) goes through @photonhealth/elements with the public
// NEXT_PUBLIC_PHOTON_* vars instead — see components/photon/.
//
// Hosts are env-driven (sandbox "Neutron" vs production differ only by env),
// so going live is a credential swap, not a code change. No photon.health /
// neutron.health literals in this file.
//
// Auth per https://docs.photon.health/docs/authentication: client-credentials
// exchange with a JSON body (NOT form-encoded — Photon's Auth0 tenant takes
// application/json here). The M2M token can do everything except write
// prescriptions; those require an authorized provider's User Access Token.

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

const AUTH_URL = process.env.PHOTON_AUTH_URL;
const CLIENT_ID = process.env.PHOTON_M2M_CLIENT_ID;
const CLIENT_SECRET = process.env.PHOTON_M2M_CLIENT_SECRET;
const AUDIENCE = process.env.PHOTON_AUDIENCE;
const API_URL = process.env.PHOTON_API_URL;

/** True when the five server-side Photon vars are present. */
export const hasPhoton = !!(AUTH_URL && CLIENT_ID && CLIENT_SECRET && AUDIENCE && API_URL);

/** Error naming the stage that failed, never echoing credentials. */
export class PhotonError extends Error {
  constructor(
    public stage: "config" | "token" | "query",
    message: string,
    public detail?: unknown,
  ) {
    super(message);
    this.name = "PhotonError";
  }
}

/**
 * Token endpoint. PHOTON_AUTH_URL carries the full path today
 * (…/oauth/token); if it is ever set to a bare domain, append the documented
 * path rather than failing.
 */
function tokenUrl(): string {
  const u = new URL(AUTH_URL!);
  if (u.pathname === "/" || u.pathname === "") u.pathname = "/oauth/token";
  return u.toString();
}

let cached: { token: string; expiresAt: number; scope: string } | null = null;

/**
 * M2M bearer token, cached in-module until 60s before expiry.
 * Scopes are assigned to the M2M application in the Photon dashboard — the
 * docs show them on the response, not as a request parameter, so we don't
 * send a `scope` param and report what was granted instead.
 */
export async function photonToken(): Promise<{ token: string; scope: string; expiresAt: number }> {
  if (!hasPhoton) throw new PhotonError("config", "Photon is not configured (PHOTON_* env vars missing).");
  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return { token: cached.token, scope: cached.scope, expiresAt: cached.expiresAt };
  }
  let res: Response;
  try {
    res = await fetch(tokenUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        audience: AUDIENCE,
        grant_type: "client_credentials",
      }),
      cache: "no-store",
    });
  } catch (e) {
    throw new PhotonError("token", `Could not reach the Photon auth host: ${(e as Error).message}`);
  }
  if (!res.ok) {
    // Auth0 error bodies name the problem (invalid_client, access_denied…)
    // without echoing what we sent — safe to surface.
    const body = await res.text().catch(() => "");
    throw new PhotonError("token", `Photon token request failed: HTTP ${res.status}`, body.slice(0, 300));
  }
  const json = (await res.json()) as TokenResponse;
  if (!json.access_token) throw new PhotonError("token", "Photon token response carried no access_token.");
  const expiresAt = Date.now() + json.expires_in * 1000;
  cached = { token: json.access_token, expiresAt, scope: json.scope ?? "" };
  return { token: json.access_token, scope: cached.scope, expiresAt };
}

/**
 * Our Photon organization id, read off the M2M token's
 * `http://photon.health/org_id` claim. Elements needs it in the browser
 * (<photon-client org="…">), and taking it from the token rather than an
 * eighth env var means it follows the credentials automatically when sandbox
 * creds are swapped for production ones. It is a public identifier, not a
 * secret — it ships in the page.
 */
export async function photonOrgId(): Promise<string> {
  const { token } = await photonToken();
  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    const org = claims["http://photon.health/org_id"];
    if (typeof org === "string" && org) return org;
  } catch {
    /* fall through */
  }
  throw new PhotonError("token", "Photon token carried no org_id claim.");
}

type GraphQLResponse<T> = { data?: T; errors?: Array<{ message: string; extensions?: Record<string, unknown> }> };

/** Minimal GraphQL fetch against PHOTON_API_URL with the M2M bearer token. */
export async function photonQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const { token } = await photonToken();
  let res: Response;
  try {
    res = await fetch(API_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables: variables ?? {} }),
      cache: "no-store",
    });
  } catch (e) {
    throw new PhotonError("query", `Could not reach the Photon API: ${(e as Error).message}`);
  }
  const text = await res.text();
  let json: GraphQLResponse<T>;
  try {
    json = JSON.parse(text) as GraphQLResponse<T>;
  } catch {
    throw new PhotonError("query", `Photon API returned non-JSON (HTTP ${res.status}).`, text.slice(0, 300));
  }
  if (json.errors?.length) {
    throw new PhotonError("query", json.errors.map((e) => e.message).join("; "), json.errors);
  }
  if (!res.ok) throw new PhotonError("query", `Photon API error: HTTP ${res.status}`, text.slice(0, 300));
  if (!json.data) throw new PhotonError("query", "Photon API returned no data.");
  return json.data;
}

// ── Patients ─────────────────────────────────────────────────────────────────

/** Photon's SexType enum; free-text gender rides along in `gender`. */
export type PhotonSex = "MALE" | "FEMALE" | "UNKNOWN";

/** Map a Liminal `clients.gender` free-text value onto Photon's SexType. */
export function toPhotonSex(gender: string | null | undefined): PhotonSex {
  const g = (gender ?? "").trim().toLowerCase();
  if (g === "male" || g === "m" || g === "man") return "MALE";
  if (g === "female" || g === "f" || g === "woman") return "FEMALE";
  return "UNKNOWN";
}

/**
 * E.164-ish phone for Photon's AWSPhone scalar. Demo data is all US.
 * Returns null when there aren't enough digits to form a valid number —
 * caller decides, because `phone` is required on createPatient.
 */
export function toPhotonPhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return null;
}

export type PhotonAddressInput = {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

/**
 * Parse the demo `clients.address` single-line string into Photon's
 * AddressInput. Seed shape: "48 Carmine St, Apt 3B, New York, NY 10014".
 * Returns null if it doesn't parse — address is optional on createPatient,
 * so a miss costs nothing rather than failing the sync.
 */
export function parseAddress(address: string | null | undefined): PhotonAddressInput | null {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const last = parts[parts.length - 1];
  const m = /^([A-Za-z]{2})\s+(\d{5})(?:-\d{4})?$/.exec(last);
  if (!m) return null;
  const [, state, postalCode] = m;
  const city = parts[parts.length - 2];
  const street1 = parts[0];
  const street2 = parts.length > 3 ? parts.slice(1, parts.length - 2).join(", ") : undefined;
  return { street1, street2, city, state, postalCode, country: "US" };
}

const CREATE_PATIENT = /* GraphQL */ `
  mutation createPatient(
    $externalId: ID
    $name: NameInput!
    $dateOfBirth: AWSDate!
    $sex: SexType!
    $gender: String
    $email: AWSEmail
    $phone: AWSPhone!
    $address: AddressInput
  ) {
    createPatient(
      externalId: $externalId
      name: $name
      dateOfBirth: $dateOfBirth
      sex: $sex
      gender: $gender
      email: $email
      phone: $phone
      address: $address
    ) {
      id
      externalId
    }
  }
`;

export type CreatePatientInput = {
  externalId: string;
  name: { first: string; last: string };
  dateOfBirth: string;
  sex: PhotonSex;
  gender?: string | null;
  email?: string | null;
  phone: string;
  address?: PhotonAddressInput | null;
};

/** createPatient → Photon patient id. */
export async function createPhotonPatient(input: CreatePatientInput): Promise<string> {
  const data = await photonQuery<{ createPatient: { id: string } }>(CREATE_PATIENT, {
    externalId: input.externalId,
    name: input.name,
    dateOfBirth: input.dateOfBirth,
    sex: input.sex,
    gender: input.gender ?? null,
    email: input.email ?? null,
    phone: input.phone,
    address: input.address ?? null,
  });
  return data.createPatient.id;
}

// ── Prescriptions ────────────────────────────────────────────────────────────

/** Photon PrescriptionState. */
export type PhotonRxState = "ACTIVE" | "EXPIRED" | "DEPLETED" | "CANCELED";

export type PhotonPrescription = {
  id: string;
  medication: string;
  dispenseQuantity: number | null;
  dispenseUnit: string | null;
  fillsAllowed: number | null;
  writtenAt: string | null;
  state: PhotonRxState;
  instructions: string | null;
};

const RX_FIELDS = /* GraphQL */ `
  id
  state
  dispenseQuantity
  dispenseUnit
  fillsAllowed
  writtenAt
  instructions
  treatment {
    id
    name
  }
`;

type RxRow = {
  id: string;
  state: PhotonRxState;
  dispenseQuantity: number | null;
  dispenseUnit: string | null;
  fillsAllowed: number | null;
  writtenAt: string | null;
  instructions: string | null;
  treatment: { id: string; name: string } | null;
};

function toPrescription(r: RxRow): PhotonPrescription {
  return {
    id: r.id,
    // Treatment.name is the full label ("Lisinopril 10 mg tablet") — Photon
    // has no separate strength field, the strength is inside the name.
    medication: r.treatment?.name ?? "—",
    dispenseQuantity: r.dispenseQuantity,
    dispenseUnit: r.dispenseUnit,
    fillsAllowed: r.fillsAllowed,
    writtenAt: r.writtenAt,
    state: r.state,
    instructions: r.instructions,
  };
}

const PRESCRIPTIONS_BY_PATIENT = /* GraphQL */ `
  query prescriptionsByPatient($patientId: ID!) {
    prescriptions(filter: { patientId: $patientId }) {
      ${RX_FIELDS}
    }
  }
`;

/** Prescriptions for one Photon patient, normalized. */
export async function listPhotonPrescriptions(patientId: string): Promise<PhotonPrescription[]> {
  const data = await photonQuery<{ prescriptions: RxRow[] }>(PRESCRIPTIONS_BY_PATIENT, { patientId });
  return (data.prescriptions ?? []).map(toPrescription);
}

// ── Rx counts (batched) ──────────────────────────────────────────────────────
//
// The schema has no "count prescriptions for N patients" query, so we batch
// with GraphQL aliases: one HTTP round-trip carrying N aliased `prescriptions`
// queries. Results are cached in-module for 60s so paging the clients list
// doesn't re-hit Photon per keystroke.

const COUNT_TTL_MS = 60_000;
const countCache = new Map<string, { count: number; at: number }>();

/** Aliases must be valid GraphQL names; Photon ids contain characters that aren't. */
function alias(i: number): string {
  return `p${i}`;
}

/**
 * Prescription counts keyed by Photon patient id. One round-trip per batch of
 * 25 aliases (bounded so a large page can't build an unbounded query
 * document), 60s cache. Unknown/failed ids simply stay absent from the map.
 */
export async function photonRxCounts(patientIds: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const now = Date.now();
  const misses: string[] = [];
  for (const id of new Set(patientIds)) {
    const hit = countCache.get(id);
    if (hit && now - hit.at < COUNT_TTL_MS) out[id] = hit.count;
    else misses.push(id);
  }
  const BATCH = 25;
  for (let i = 0; i < misses.length; i += BATCH) {
    const batch = misses.slice(i, i + BATCH);
    const vars: Record<string, unknown> = {};
    const decls = batch.map((_, j) => `$${alias(j)}: ID!`).join(", ");
    const body = batch
      .map((_, j) => `${alias(j)}: prescriptions(filter: { patientId: $${alias(j)} }) { id }`)
      .join("\n      ");
    batch.forEach((id, j) => (vars[alias(j)] = id));
    const query = `query rxCounts(${decls}) {\n      ${body}\n    }`;
    const data = await photonQuery<Record<string, Array<{ id: string }>>>(query, vars);
    batch.forEach((id, j) => {
      const rows = data[alias(j)];
      if (Array.isArray(rows)) {
        out[id] = rows.length;
        countCache.set(id, { count: rows.length, at: Date.now() });
      }
    });
  }
  return out;
}

/** Drop cached counts for a patient (after a prescription is written). */
export function invalidateRxCount(patientId: string): void {
  countCache.delete(patientId);
}
