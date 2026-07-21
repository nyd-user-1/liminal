import { hasDb, sql } from "@/lib/db";

// The network crosswalk — what a payer calls a network, and which of our 72
// networks (if any) that resolves to.
//
// PERFORMANCE, measured. `network_unmapped_labels` is a VIEW, and its MRF half
// is a `GROUP BY payer, plan_or_network` over provider_rate_signals — 13.7M
// rows. It costs ~4.6s every single call and there is no index that changes
// that; the fix is a matview, which lives in sql/ and is not this seam's to add
// (flagged in the report). So this module is deliberately NOT called during page
// render: it sits behind /api/workspace/networks, fetched when the tab is first
// opened, and memoized in-process for five minutes because the underlying data
// only moves on the nightly harvest.

export type MappingStatus = "mapped" | "ambiguous" | "unmapped";

export interface MappingRow {
  /** Stable row key — source + payer + label. */
  id: string;
  status: MappingStatus;
  source: string;
  /** What the payer calls itself in the feed. */
  payerLabel: string;
  /** What the payer calls the network. The interesting ones are enormous. */
  networkLabel: string;
  /** Our network's display name, where the label resolves to one. */
  networkName: string | null;
  /** How the mapping (or the bucketing) was decided: alias, pattern:*, unresolved. */
  rule: string;
  /** The bucket a FHIR label fell into (medicare, oos-state, …). */
  scope: string | null;
  /** Rate rows behind an MRF label, participation rows behind a FHIR one. */
  weight: number | null;
  /** Our insurer, resolved from the payer label — by the alias crosswalk, or by
   *  a direct id match for FHIR labels (which are already our slugs). Null when
   *  neither resolves; never guessed from the display name. */
  insurerId: string | null;
  insurerName: string | null;
  /** When the label was bucketed. Only FHIR labels carry one — MRF labels come
   *  from a GROUP BY with no timestamp, and an invented date is worse than a
   *  dash. */
  bucketedAt: string | null;
  /** A semicolon-joined label split out. One entry when it isn't joined. */
  parts: string[];
}

export interface NetworkRow {
  id: string;
  name: string;
  /** product · network */
  kind: string;
  insurerName: string | null;
  administratorName: string | null;
  notes: string | null;
  /** Payer labels that resolve to this network. */
  mappedLabels: number;
}

export interface NetworkData {
  networks: NetworkRow[];
  mappings: MappingRow[];
  counts: { mapped: number; ambiguous: number; unmapped: number; total: number };
  /** ms the database took, so the surface can stamp its own cost honestly. */
  queryMs: number;
  generatedAt: number;
}

const EMPTY: NetworkData = {
  networks: [],
  mappings: [],
  counts: { mapped: 0, ambiguous: 0, unmapped: 0, total: 0 },
  queryMs: 0,
  generatedAt: 0,
};

const TTL_MS = 5 * 60 * 1000;
// Two caches, because the two halves cost three orders of magnitude apart.
// The roster (networks × insurers) is an 18ms join over 72 rows; the crosswalk
// groups over 13.7M rate rows. Cached together, the cheap half waited on the
// expensive one and the Networks tab spun for seconds to show a 72-row list.
let rosterCache: NetworkData | null = null;
let crosswalkCache: NetworkData | null = null;

interface MapRow {
  status: MappingStatus;
  source: string;
  payer_label: string;
  network_label: string;
  network_name: string | null;
  rule: string;
  scope: string | null;
  weight: string | null;
  insurer_id: string | null;
  insurer_name: string | null;
  bucketed_at: Date | null;
}

interface NetRow {
  id: string;
  name: string;
  kind: string;
  insurer_name: string | null;
  administrator_name: string | null;
  notes: string | null;
  mapped_labels: number;
}

/**
 * `crosswalk: false` (the default) answers the Networks tab: every network with
 * its insurer, 72 rows, ~18ms. `crosswalk: true` additionally runs the label
 * crosswalk the Network mapping tab needs, which is the expensive half.
 *
 * The founder's correction, 2026-07-21: "I just wanted the networks mapped to
 * the insurers — Aetna 10, Anthem 10, Cigna 9. We don't need 14M rows." He was
 * right; asking one question should not pay for the other.
 */
export async function networkData(opts?: { crosswalk?: boolean }): Promise<NetworkData> {
  if (!hasDb) return EMPTY;
  const wantCrosswalk = opts?.crosswalk === true;
  const hit = wantCrosswalk ? crosswalkCache : rosterCache;
  if (hit && Date.now() - hit.generatedAt < TTL_MS) return hit;

  const t0 = Date.now();
  const [nets, maps] = await Promise.all([
    sql`
      SELECT n.id, n.name, n.kind, n.notes,
             i.name AS insurer_name,
             a.name AS administrator_name,
             (SELECT count(*)::int FROM network_aliases al WHERE al.network_id = n.id) AS mapped_labels
      FROM networks n
      LEFT JOIN insurers i ON i.id = n.insurer_id
      LEFT JOIN insurers a ON a.id = n.administrator_id
      ORDER BY i.name NULLS LAST, n.name
    ` as unknown as Promise<NetRow[]>,
    // One row per payer-reported label. Mapped ones come from the alias table;
    // everything else comes from the unmapped view, carrying the pattern rule
    // that bucketed it. The bucket lookup is a CTE, not a correlated lateral,
    // so it hash-joins once instead of probing per row.
    //
    // Skipped entirely unless the caller asked for it — this is the 13.7M-row half.
    wantCrosswalk
      ? (sql`
      WITH bucket AS (
        SELECT DISTINCT ON (pn.network_name) pn.network_name, pm.rule, pm.scope, pm.mapped_at
        FROM payer_networks pn
        JOIN payer_network_map pm ON pm.payer_network_id = pn.id
      ),
      -- payer label -> our insurer. The alias crosswalk first; failing that, a
      -- FHIR label IS one of our slugs, so it can match insurers.id directly.
      payer_insurer AS (
        SELECT DISTINCT ON (label) label, insurer_id
        FROM insurer_aliases WHERE role = 'insurer'
      )
      SELECT 'mapped' AS status, al.source, al.payer_label, al.network_label,
             n.name AS network_name, 'alias' AS rule,
             NULL::text AS scope, NULL::bigint AS weight,
             COALESCE(pi.insurer_id, di.id) AS insurer_id,
             COALESCE(ins.name, di.name) AS insurer_name,
             NULL::timestamptz AS bucketed_at
      FROM network_aliases al
      LEFT JOIN networks n ON n.id = al.network_id
      LEFT JOIN payer_insurer pi ON pi.label = al.payer_label
      LEFT JOIN insurers ins ON ins.id = pi.insurer_id
      LEFT JOIN insurers di ON di.id = al.payer_label
      UNION ALL
      SELECT CASE WHEN u.network_label LIKE '%;%' THEN 'ambiguous' ELSE 'unmapped' END,
             u.source, u.payer_label, u.network_label, NULL,
             COALESCE(b.rule, 'unresolved'), b.scope, u.weight,
             COALESCE(pi.insurer_id, di.id),
             COALESCE(ins.name, di.name),
             b.mapped_at
      FROM network_unmapped_labels u
      LEFT JOIN bucket b ON b.network_name = u.network_label
      LEFT JOIN payer_insurer pi ON pi.label = u.payer_label
      LEFT JOIN insurers ins ON ins.id = pi.insurer_id
      LEFT JOIN insurers di ON di.id = u.payer_label
    `.then((r) => r as unknown as MapRow[]) as Promise<MapRow[]>)
      : (Promise.resolve([]) as Promise<MapRow[]>),
  ]);
  const queryMs = Date.now() - t0;

  const mappings: MappingRow[] = maps.map((r) => ({
    id: `${r.source}::${r.payer_label}::${r.network_label}`,
    status: r.status,
    source: r.source,
    payerLabel: r.payer_label,
    networkLabel: r.network_label,
    networkName: r.network_name,
    rule: r.rule,
    scope: r.scope,
    weight: r.weight === null ? null : Number(r.weight),
    insurerId: r.insurer_id,
    insurerName: r.insurer_name,
    bucketedAt: r.bucketed_at ? new Date(r.bucketed_at).toISOString() : null,
    // Split here rather than in the browser, so every option renders the same
    // parts from the same place and none of them can quietly truncate.
    parts: r.network_label.split(";").map((p) => p.trim()).filter(Boolean),
  }));

  const counts = {
    mapped: mappings.filter((m) => m.status === "mapped").length,
    ambiguous: mappings.filter((m) => m.status === "ambiguous").length,
    unmapped: mappings.filter((m) => m.status === "unmapped").length,
    total: mappings.length,
  };

  const result: NetworkData = {
    networks: nets.map((n) => ({
      id: n.id,
      name: n.name,
      kind: n.kind,
      insurerName: n.insurer_name,
      administratorName: n.administrator_name,
      notes: n.notes,
      mappedLabels: Number(n.mapped_labels),
    })),
    mappings,
    counts,
    queryMs,
    generatedAt: Date.now(),
  };
  if (wantCrosswalk) crosswalkCache = result;
  else rosterCache = result;
  return result;
}
