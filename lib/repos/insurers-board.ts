import { hasDb, sql } from "@/lib/db";
import { isoDateOnly } from "@/lib/format";

// The insurer roster behind the /workspace Insurers section — one row per row of
// `insurers` (sql/042), enriched only with facts that already exist elsewhere in
// the schema. Nothing here is scored, ranked or estimated: a card with thin data
// shows thin data.
//
//   networks      count of `networks` rows carrying this insurer_id
//   companies     count of `insurer_companies` (NAIC-licensed entities) rows
//   rate rows     summed from the `payer_rate_totals` MATVIEW through
//                 `insurer_aliases` — the entity layer's own label crosswalk.
//                 Going straight at provider_rate_signals instead costs 27s for
//                 a DISTINCT over 13.7M rows; the matview answers in ~180ms.
//
// Ordered by name. The card wall re-sorts into "has a real mark" then "does
// not", each A–Z, because whether a mark resolves is a UI fact the repo has no
// business knowing — see LOGOS in app/(app)/workspace/insurers-panel.tsx.

export interface InsurerCard {
  id: string;
  name: string;
  /** carrier · group · administrator */
  kind: string;
  /** The parent insurer's display name, where one is recorded. */
  parentName: string | null;
  /** Free-text note from the registry. The card's description when present. */
  notes: string | null;
  naicGroupCode: string | null;
  networks: number;
  companies: number;
  /** Null where we hold no rate rows for any of this insurer's labels. */
  rateRows: number | null;
  rateNpis: number | null;
  /** ISO date of the newest priced file, where we hold rates. */
  ratesAsOf: string | null;
}

interface Row {
  id: string;
  name: string;
  kind: string;
  parent_name: string | null;
  notes: string | null;
  naic_group_code: string | null;
  network_count: number;
  company_count: number;
  rate_rows: string | null;
  rate_npis: number | null;
  latest: Date | null;
}

export async function insurerBoard(): Promise<InsurerCard[]> {
  if (!hasDb) return [];
  const rows = (await sql`
    SELECT i.id, i.name, i.kind, i.naic_group_code, i.notes,
           p.name AS parent_name,
           (SELECT count(*)::int FROM networks n WHERE n.insurer_id = i.id) AS network_count,
           (SELECT count(*)::int FROM insurer_companies c WHERE c.insurer_id = i.id) AS company_count,
           r.rate_rows, r.rate_npis, r.latest
    FROM insurers i
    LEFT JOIN insurers p ON p.id = i.parent_id
    LEFT JOIN LATERAL (
      SELECT sum(t."rows")::bigint AS rate_rows,
             max(t.npis)::int      AS rate_npis,
             max(t.latest)         AS latest
      FROM insurer_aliases a
      JOIN payer_rate_totals t ON t.payer = a.label
      WHERE a.insurer_id = i.id AND a.role = 'insurer'
    ) r ON true
    ORDER BY i.name
  `) as Row[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    parentName: r.parent_name,
    notes: r.notes,
    naicGroupCode: r.naic_group_code,
    networks: Number(r.network_count),
    companies: Number(r.company_count),
    // sum() comes back as a string from the bigint cast; null means no rates.
    rateRows: r.rate_rows === null ? null : Number(r.rate_rows),
    rateNpis: r.rate_npis === null ? null : Number(r.rate_npis),
    ratesAsOf: r.latest ? isoDateOnly(r.latest) : null,
  }));
}

/** How many `networks` rows exist at all — the Networks tabs are placeholders,
 *  and the placeholder states this number so an unbuilt view is never mistaken
 *  for an empty table. */
export async function networkRowCount(): Promise<number | null> {
  if (!hasDb) return null;
  const rows = (await sql`SELECT count(*)::int AS c FROM networks`) as Array<{ c: number }>;
  return rows[0] ? Number(rows[0].c) : null;
}
