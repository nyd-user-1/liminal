import { hasDb, sql } from "@/lib/db";
import { isoDateTime } from "@/lib/format";
import { mockId, mockStore } from "@/lib/mock";
import "@/lib/mock/directory";
import type {
  DirectoryProgram,
  DirectoryProvider,
  ProviderApplication,
  Referral,
  ReferralStatus,
} from "@/lib/types";

// External provider directory repo — search over the NY open-data tables
// (directory_providers, directory_programs) plus referrals + provider
// applications. Dual-mode: hasDb ? sql : mockStore(). Search is paginated
// server-side; dynamic WHERE clauses use sql.query(text, params).

export const PAGE_SIZE = 25;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ── row mappers ────────────────────────────────────────────────────────────

type ProviderRow = {
  id: string;
  npi: string | null;
  name: string;
  profession: string | null;
  license_no: string | null;
  taxonomy: string | null;
  address: string | null;
  city: string | null;
  county: string | null;
  zip: string | null;
  phone: string | null;
  source: DirectoryProvider["source"];
  source_id: string;
  updated_at: string | Date;
};

function toProvider(r: ProviderRow): DirectoryProvider {
  return {
    id: r.id,
    npi: r.npi,
    name: r.name,
    profession: r.profession,
    licenseNo: r.license_no,
    taxonomy: r.taxonomy,
    address: r.address,
    city: r.city,
    county: r.county,
    zip: r.zip,
    phone: r.phone,
    source: r.source,
    sourceId: r.source_id,
    updatedAt: isoDateTime(r.updated_at),
  };
}

type ProgramRow = {
  id: string;
  agency: string | null;
  facility: string | null;
  program_name: string;
  program_type: string | null;
  populations: string | null;
  address: string | null;
  city: string | null;
  county: string | null;
  zip: string | null;
  phone: string | null;
  source: DirectoryProgram["source"];
  source_id: string;
  updated_at: string | Date;
};

function toProgram(r: ProgramRow): DirectoryProgram {
  return {
    id: r.id,
    agency: r.agency,
    facility: r.facility,
    programName: r.program_name,
    programType: r.program_type,
    populations: r.populations,
    address: r.address,
    city: r.city,
    county: r.county,
    zip: r.zip,
    phone: r.phone,
    source: r.source,
    sourceId: r.source_id,
    updatedAt: isoDateTime(r.updated_at),
  };
}

// ── providers ──────────────────────────────────────────────────────────────

export async function searchProviders(opts: {
  q?: string;
  county?: string;
  profession?: string;
  page?: number;
  pageSize?: number;
}): Promise<Page<DirectoryProvider>> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? PAGE_SIZE;
  const q = opts.q?.trim();

  if (hasDb) {
    const where: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    if (q) {
      where.push(`(name ILIKE $${p} OR city ILIKE $${p} OR profession ILIKE $${p})`);
      params.push(`%${q}%`);
      p++;
    }
    if (opts.county) {
      where.push(`county = $${p++}`);
      params.push(opts.county);
    }
    if (opts.profession) {
      where.push(`profession = $${p++}`);
      params.push(opts.profession);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    // A provider can exist as both a medicaid and an nppes row (same NPI).
    // Dedupe at query time to one row per NPI, preferring the medicaid row (it
    // carries license + Medicaid participation); rows without an NPI pass
    // through (COALESCE to id makes each its own partition). Filter first so the
    // preferred row is chosen among rows that actually match the search.
    const deduped =
      `SELECT * FROM (SELECT *, ROW_NUMBER() OVER (` +
      `PARTITION BY COALESCE(npi, id::text) ` +
      `ORDER BY CASE source WHEN 'medicaid' THEN 0 ELSE 1 END, id) AS _rn ` +
      `FROM directory_providers ${clause}) t WHERE _rn = 1`;
    const countRows = (await sql.query(`SELECT count(*)::int AS n FROM (${deduped}) c`, params)) as Array<{ n: number }>;
    const total = countRows[0]?.n ?? 0;
    const rows = (await sql.query(
      `SELECT * FROM (${deduped}) d ORDER BY name LIMIT $${p++} OFFSET $${p++}`,
      [...params, pageSize, (page - 1) * pageSize],
    )) as ProviderRow[];
    return { items: rows.map(toProvider), total, page, pageSize };
  }

  const all = filterProviders([...mockStore().directoryProviders.values()], opts);
  return paginate(all, page, pageSize);
}

export async function getProvider(id: string): Promise<DirectoryProvider | null> {
  if (hasDb) {
    const rows = (await sql`SELECT * FROM directory_providers WHERE id = ${id}`) as ProviderRow[];
    return rows[0] ? toProvider(rows[0]) : null;
  }
  return mockStore().directoryProviders.get(id) ?? null;
}

function filterProviders(list: DirectoryProvider[], opts: { q?: string; county?: string; profession?: string }): DirectoryProvider[] {
  const q = opts.q?.trim().toLowerCase();
  const matched = list.filter((r) => {
    if (q && !`${r.name} ${r.city ?? ""} ${r.profession ?? ""}`.toLowerCase().includes(q)) return false;
    if (opts.county && r.county !== opts.county) return false;
    if (opts.profession && r.profession !== opts.profession) return false;
    return true;
  });
  // Dedupe to one row per NPI, preferring medicaid; null-NPI rows pass through.
  const byNpi = new Map<string, DirectoryProvider>();
  const passthrough: DirectoryProvider[] = [];
  for (const r of matched) {
    if (!r.npi) { passthrough.push(r); continue; }
    const cur = byNpi.get(r.npi);
    if (!cur || (r.source === "medicaid" && cur.source !== "medicaid")) byNpi.set(r.npi, r);
  }
  return [...byNpi.values(), ...passthrough].sort((a, b) => a.name.localeCompare(b.name));
}

// ── programs ───────────────────────────────────────────────────────────────

export async function searchPrograms(opts: {
  q?: string;
  county?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}): Promise<Page<DirectoryProgram>> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? PAGE_SIZE;
  const q = opts.q?.trim();

  if (hasDb) {
    const where: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    if (q) {
      where.push(`(program_name ILIKE $${p} OR agency ILIKE $${p} OR facility ILIKE $${p} OR city ILIKE $${p})`);
      params.push(`%${q}%`);
      p++;
    }
    if (opts.county) {
      where.push(`county = $${p++}`);
      params.push(opts.county);
    }
    if (opts.type) {
      where.push(`program_type = $${p++}`);
      params.push(opts.type);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countRows = (await sql.query(`SELECT count(*)::int AS n FROM directory_programs ${clause}`, params)) as Array<{ n: number }>;
    const total = countRows[0]?.n ?? 0;
    const rows = (await sql.query(
      `SELECT * FROM directory_programs ${clause} ORDER BY program_name LIMIT $${p++} OFFSET $${p++}`,
      [...params, pageSize, (page - 1) * pageSize],
    )) as ProgramRow[];
    return { items: rows.map(toProgram), total, page, pageSize };
  }

  const all = filterPrograms([...mockStore().directoryPrograms.values()], opts);
  return paginate(all, page, pageSize);
}

export async function getProgram(id: string): Promise<DirectoryProgram | null> {
  if (hasDb) {
    const rows = (await sql`SELECT * FROM directory_programs WHERE id = ${id}`) as ProgramRow[];
    return rows[0] ? toProgram(rows[0]) : null;
  }
  return mockStore().directoryPrograms.get(id) ?? null;
}

function filterPrograms(list: DirectoryProgram[], opts: { q?: string; county?: string; type?: string }): DirectoryProgram[] {
  const q = opts.q?.trim().toLowerCase();
  return list
    .filter((r) => {
      if (q && !`${r.programName} ${r.agency ?? ""} ${r.facility ?? ""} ${r.city ?? ""}`.toLowerCase().includes(q)) return false;
      if (opts.county && r.county !== opts.county) return false;
      if (opts.type && r.programType !== opts.type) return false;
      return true;
    })
    .sort((a, b) => a.programName.localeCompare(b.programName));
}

/** Distinct filter facet values (counties, professions/types) for filter chips. */
export async function providerFacets(): Promise<{ counties: string[]; professions: string[] }> {
  if (hasDb) {
    const c = (await sql`SELECT DISTINCT county FROM directory_providers WHERE county IS NOT NULL ORDER BY county`) as Array<{ county: string }>;
    const pr = (await sql`SELECT DISTINCT profession FROM directory_providers WHERE profession IS NOT NULL ORDER BY profession`) as Array<{ profession: string }>;
    return { counties: c.map((r) => r.county), professions: pr.map((r) => r.profession) };
  }
  const list = [...mockStore().directoryProviders.values()];
  return {
    counties: unique(list.map((r) => r.county)),
    professions: unique(list.map((r) => r.profession)),
  };
}

// NYC boroughs (title-case, as stored for OMH programs) — the portal
// Resources slice. NYC DOHMH's own directory (8nqg-ia7v) is private, so the
// client-facing resources are OMH programs scoped to the five boroughs.
const NYC_COUNTIES = ["New York", "Kings", "Queens", "Bronx", "Richmond"];

/** Curated NYC-borough programs for the client portal Resources page. */
export async function searchNycResources(opts: {
  q?: string;
  category?: string;
  limit?: number;
}): Promise<DirectoryProgram[]> {
  const limit = opts.limit ?? 60;
  const q = opts.q?.trim();

  if (hasDb) {
    const where: string[] = [`county = ANY($1)`, `source = 'omh'`];
    const params: unknown[] = [NYC_COUNTIES];
    let p = 2;
    if (q) {
      where.push(`(program_name ILIKE $${p} OR agency ILIKE $${p} OR city ILIKE $${p})`);
      params.push(`%${q}%`);
      p++;
    }
    if (opts.category) {
      where.push(`program_type = $${p++}`);
      params.push(opts.category);
    }
    const rows = (await sql.query(
      `SELECT * FROM directory_programs WHERE ${where.join(" AND ")} ORDER BY program_name LIMIT $${p}`,
      [...params, limit],
    )) as ProgramRow[];
    return rows.map(toProgram);
  }

  return filterPrograms([...mockStore().directoryPrograms.values()], {
    q,
    type: opts.category,
  })
    .filter((r) => r.county && NYC_COUNTIES.includes(r.county))
    .slice(0, limit);
}

/** Distinct program types among NYC-borough programs (portal category chips). */
export async function nycResourceCategories(): Promise<string[]> {
  if (hasDb) {
    const rows = (await sql`
      SELECT program_type, count(*)::int AS n
      FROM directory_programs
      WHERE source = 'omh' AND county = ANY(${NYC_COUNTIES}) AND program_type IS NOT NULL
      GROUP BY program_type ORDER BY n DESC LIMIT 12
    `) as Array<{ program_type: string }>;
    return rows.map((r) => r.program_type);
  }
  const list = [...mockStore().directoryPrograms.values()].filter((r) => r.county && NYC_COUNTIES.includes(r.county));
  return unique(list.map((r) => r.programType));
}

export async function programFacets(): Promise<{ counties: string[]; types: string[] }> {
  if (hasDb) {
    const c = (await sql`SELECT DISTINCT county FROM directory_programs WHERE county IS NOT NULL ORDER BY county`) as Array<{ county: string }>;
    const t = (await sql`SELECT DISTINCT program_type FROM directory_programs WHERE program_type IS NOT NULL ORDER BY program_type`) as Array<{ program_type: string }>;
    return { counties: c.map((r) => r.county), types: t.map((r) => r.program_type) };
  }
  const list = [...mockStore().directoryPrograms.values()];
  return {
    counties: unique(list.map((r) => r.county)),
    types: unique(list.map((r) => r.programType)),
  };
}

// ── referrals ──────────────────────────────────────────────────────────────

type ReferralRow = {
  id: string;
  client_id: string;
  provider_id: string | null;
  program_id: string | null;
  reason: string | null;
  status: ReferralStatus;
  created_by: string | null;
  created_at: string | Date;
  target_name?: string | null;
  target_kind?: "provider" | "program" | null;
};

function toReferral(r: ReferralRow): Referral {
  return {
    id: r.id,
    clientId: r.client_id,
    providerId: r.provider_id,
    programId: r.program_id,
    reason: r.reason,
    status: r.status,
    createdBy: r.created_by,
    createdAt: isoDateTime(r.created_at),
    targetName: r.target_name ?? undefined,
    targetKind: r.target_kind ?? undefined,
  };
}

export async function createReferral(input: {
  clientId: string;
  providerId?: string | null;
  programId?: string | null;
  reason?: string | null;
  createdBy?: string | null;
  status?: ReferralStatus;
}): Promise<Referral> {
  const status = input.status ?? "sent";
  if (hasDb) {
    const rows = (await sql`
      INSERT INTO referrals (client_id, provider_id, program_id, reason, status, created_by)
      VALUES (${input.clientId}, ${input.providerId ?? null}, ${input.programId ?? null}, ${input.reason ?? null}, ${status}, ${input.createdBy ?? null})
      RETURNING *
    `) as ReferralRow[];
    return toReferral(rows[0]);
  }
  const now = new Date().toISOString();
  const ref: Referral = {
    id: mockId(),
    clientId: input.clientId,
    providerId: input.providerId ?? null,
    programId: input.programId ?? null,
    reason: input.reason ?? null,
    status,
    createdBy: input.createdBy ?? null,
    createdAt: now,
  };
  mockStore().referrals.set(ref.id, ref);
  return ref;
}

export async function listReferrals(opts: { clientId: string }): Promise<Referral[]> {
  if (hasDb) {
    const rows = (await sql`
      SELECT r.*,
        COALESCE(dp.name, dpr.program_name) AS target_name,
        CASE WHEN r.provider_id IS NOT NULL THEN 'provider' ELSE 'program' END AS target_kind
      FROM referrals r
      LEFT JOIN directory_providers dp ON dp.id = r.provider_id
      LEFT JOIN directory_programs dpr ON dpr.id = r.program_id
      WHERE r.client_id = ${opts.clientId}
      ORDER BY r.created_at DESC
    `) as ReferralRow[];
    return rows.map(toReferral);
  }
  const store = mockStore();
  return [...store.referrals.values()]
    .filter((r) => r.clientId === opts.clientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => {
      const targetName = r.providerId
        ? store.directoryProviders.get(r.providerId)?.name
        : r.programId
          ? store.directoryPrograms.get(r.programId)?.programName
          : undefined;
      return { ...r, targetName, targetKind: r.providerId ? "provider" : "program" };
    });
}

// ── provider applications ──────────────────────────────────────────────────

type ApplicationRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  license_type: string | null;
  state: string | null;
  npi: string | null;
  message: string | null;
  status: ProviderApplication["status"];
  created_at: string | Date;
};

function toApplication(r: ApplicationRow): ProviderApplication {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    licenseType: r.license_type,
    state: r.state,
    npi: r.npi,
    message: r.message,
    status: r.status,
    createdAt: isoDateTime(r.created_at),
  };
}

export async function createProviderApplication(input: {
  name: string;
  email: string;
  phone?: string | null;
  licenseType?: string | null;
  state?: string | null;
  npi?: string | null;
  message?: string | null;
}): Promise<ProviderApplication> {
  if (hasDb) {
    const rows = (await sql`
      INSERT INTO provider_applications (name, email, phone, license_type, state, npi, message)
      VALUES (${input.name}, ${input.email}, ${input.phone ?? null}, ${input.licenseType ?? null}, ${input.state ?? null}, ${input.npi ?? null}, ${input.message ?? null})
      RETURNING *
    `) as ApplicationRow[];
    return toApplication(rows[0]);
  }
  const now = new Date().toISOString();
  const app: ProviderApplication = {
    id: mockId(),
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    licenseType: input.licenseType ?? null,
    state: input.state ?? null,
    npi: input.npi ?? null,
    message: input.message ?? null,
    status: "new",
    createdAt: now,
  };
  mockStore().providerApplications.set(app.id, app);
  return app;
}

export async function listProviderApplications(): Promise<ProviderApplication[]> {
  if (hasDb) {
    const rows = (await sql`SELECT * FROM provider_applications ORDER BY created_at DESC`) as ApplicationRow[];
    return rows.map(toApplication);
  }
  return [...mockStore().providerApplications.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function countNewApplications(): Promise<number> {
  if (hasDb) {
    const rows = (await sql`SELECT count(*)::int AS n FROM provider_applications WHERE status = 'new'`) as Array<{ n: number }>;
    return rows[0]?.n ?? 0;
  }
  return [...mockStore().providerApplications.values()].filter((a) => a.status === "new").length;
}

// ── helpers ────────────────────────────────────────────────────────────────

function paginate<T>(all: T[], page: number, pageSize: number): Page<T> {
  const start = (page - 1) * pageSize;
  return { items: all.slice(start, start + pageSize), total: all.length, page, pageSize };
}

function unique(vals: Array<string | null>): string[] {
  return [...new Set(vals.filter((v): v is string => !!v))].sort();
}
