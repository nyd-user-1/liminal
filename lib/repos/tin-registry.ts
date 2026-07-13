import { hasDb, sql } from "@/lib/db";

// tin_registry repo (sql/019) — org names for contract-holder TINs, its own
// module so the KYR peer lane in rate-signals.ts stays untouched. Names are
// payer-roster attestations captured from MRF files, not legal-entity lookups.

/** 'ein:83-2675429' → 'ein:832675429' — payers dash/space EINs inconsistently. */
export function normTin(tin: string): string {
  return tin.toLowerCase().replace(/[\s-]/g, "");
}

/** 'ein:262976526' → 'EIN 26-2976526' for display when no name is known. */
export function formatTin(tin: string): string {
  const n = normTin(tin);
  const m = n.match(/^ein:(\d{9})$/);
  if (m) return `EIN ${m[1].slice(0, 2)}-${m[1].slice(2)}`;
  const p = n.match(/^npi:(\d{10})$/);
  if (p) return `Org NPI ${p[1]}`;
  return tin;
}

// Zero-env fixtures mirror the sql/019 seed.
const MOCK_NAMES: Record<string, string> = {
  "ein:832675429": "New York Medical Behavioral Health Services (Headway NY)",
  "ein:853976267": "Orenda Psychiatry PLLC",
  "ein:262976526": "River Region Psychiatry",
  "ein:842050464": "Culpepper Psychiatric Associates",
};

/** Org name for a TIN, or null when unknown — callers render formatTin() then. */
export async function getOrgName(tin: string): Promise<string | null> {
  const key = normTin(tin);
  if (!hasDb) return MOCK_NAMES[key] ?? null;
  const rows = (await sql`
    SELECT business_name FROM tin_registry WHERE tin_norm = ${key}
  `) as Array<{ business_name: string }>;
  return rows[0]?.business_name ?? null;
}

/** Batch variant for list screens — one query, Map keyed by the input strings. */
export async function getOrgNames(tins: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const uniq = [...new Set(tins)];
  if (!hasDb) {
    for (const t of uniq) {
      const n = MOCK_NAMES[normTin(t)];
      if (n) out.set(t, n);
    }
    return out;
  }
  const keys = uniq.map(normTin);
  const rows = (await sql`
    SELECT tin_norm, business_name FROM tin_registry WHERE tin_norm = ANY(${keys})
  `) as Array<{ tin_norm: string; business_name: string }>;
  const byNorm = new Map(rows.map((r) => [r.tin_norm, r.business_name]));
  for (const t of uniq) {
    const n = byNorm.get(normTin(t));
    if (n) out.set(t, n);
  }
  return out;
}
