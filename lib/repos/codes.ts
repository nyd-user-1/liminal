import { CODE_VOLUMES, CODE_VOLUMES_ASOF } from "@/lib/code-volumes";
import { CPT_LABELS } from "@/lib/cpt-labels.generated";
import { hasDb, sql } from "@/lib/db";
import { RATE_ROW_CODES } from "@/lib/repos/rate-rows";

// The billing codes we carry — /codes reads this. Labels are LIVE off cpt_codes
// (our own wording, 20 rows, one cheap query, memoized), volume is the dated
// snapshot from lib/code-volumes.ts (a live per-code group-by is ~60s). No PHI:
// codes are facts, counts are aggregates. `shownInRates` marks the five codes
// the /rates panels currently surface, distinct from the fifteen priced but not
// yet shown (the NYS-50 gap, made visible).

// A Set<string> so `.has(code)` takes a plain string, not the code union.
const SHOWN_IN_RATES: Set<string> = new Set(RATE_ROW_CODES);

export interface CodeRow {
  code: string;
  /** cpt_codes.display_name — our own plain-language wording, never AMA text. */
  description: string;
  category: string | null;
  active: boolean;
  /** Rate rows in the corpus for this code (snapshot). Null if not yet priced. */
  rows: number | null;
  /** Distinct NPIs priced for this code (snapshot). */
  npis: number | null;
  /** One of the five codes the /rates panels surface today. */
  shownInRates: boolean;
}

export interface CodeCatalog {
  codes: CodeRow[];
  volumesAsOf: string;
  shownCount: number;
}

type CptRow = { code: string; display_name: string; category: string | null; active: boolean };

let memo: { at: number; data: CodeCatalog } | null = null;

export async function codeCatalog(maxAgeMs = 5 * 60_000): Promise<CodeCatalog> {
  if (memo && Date.now() - memo.at < maxAgeMs) return memo.data;

  const base: CptRow[] = hasDb
    ? ((await sql`SELECT code, display_name, category, active FROM cpt_codes ORDER BY code`) as CptRow[])
    : Object.keys(CODE_VOLUMES).map((code) => ({
        code,
        display_name: CPT_LABELS[code] ?? code,
        category: null,
        active: true,
      }));

  const codes: CodeRow[] = base
    .map((r) => {
      const v = CODE_VOLUMES[r.code] ?? null;
      return {
        code: r.code,
        description: r.display_name,
        category: r.category,
        active: r.active,
        rows: v?.rows ?? null,
        npis: v?.npis ?? null,
        shownInRates: SHOWN_IN_RATES.has(r.code),
      };
    })
    .sort((a, b) => (b.rows ?? -1) - (a.rows ?? -1));

  const data: CodeCatalog = {
    codes,
    volumesAsOf: CODE_VOLUMES_ASOF,
    shownCount: codes.filter((c) => c.shownInRates).length,
  };
  memo = { at: Date.now(), data };
  return data;
}
