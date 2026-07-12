import { hasDb, sql } from "@/lib/db";
import { isoDateOnly } from "@/lib/format";
import { mockRateSignals, type MockRateSignalRow } from "@/lib/mock/rate-signals";

// Negotiated-rate signals repo (provider_rate_signals, sql/017) — the ONLY
// door to Transparency-in-Coverage rates. Dual-mode: hasDb ? sql : fixtures.
//
// THE THREE DISPLAY RULES — enforced here, structurally:
//  1. A negotiated rate is what the PAYER pays the PROVIDER, never patient
//     cost. This module NEVER returns a bare number: the figure only leaves
//     pre-wrapped in `display` ("$233.40 in-network rate · as-of 2026-07-12")
//     so no page can fetch a number and mislabel it as what a patient pays.
//  2. A rate proves a contract existed on file_date — carry as_of on every
//     rate-derived claim.
//  3. MEMBERSHIP vs LIVENESS: a rate row is the payer's OWN published
//     attestation that the provider is in-network — "takes Oxford" is a fair
//     claim on rate evidence alone. What the rate file does NOT carry is
//     accepting-new-patients or any recency heartbeat (published rates
//     outlive active participation — the zombie-rate problem CMS's proposed
//     Utilization File exists to fix). `directoryListed` gates ONLY those
//     liveness/accepting claims, never the membership claim itself.

export interface RateSignal {
  payer: string;
  planOrNetwork: string;
  billingCode: string;
  billingClass: string;
  placeOfService: string;
  /** The only form the figure exists in: "$233.40 in-network rate · as-of 2026-07-12". */
  display: string;
  /** ISO date the claim is good as of (effective date if published, else our fetch date). */
  asOf: string;
  /** ISO date the payer published the MRF. */
  fileDate: string;
  /**
   * true = the SAME payer also lists this NPI in its FHIR directory, which
   * unlocks accepting-new-patients display. false = rate-file evidence only:
   * membership is still solid (it is the payer's own disclosure); there is
   * simply no accepting/liveness data to show alongside it.
   */
  directoryListed: boolean;
}

// Map an MRF reporting-entity name to our payer_sources slug so the directory
// join is same-payer only (a Humana listing says nothing about Oxford
// accepting-status). Oxford maps to null: no public FHIR directory exists
// (probed 2026-07-12), so Oxford rows carry no accepting data — membership is
// unaffected.
const PAYER_TO_SOURCE_SLUG: Array<[RegExp, string | null]> = [
  [/oxford/i, null],
  [/unitedhealthcare|united healthcare|\buhc\b/i, "uhc"],
  [/aetna/i, "aetna_commercial"],
  [/cigna/i, "cigna"],
  [/anthem|empire|elevance/i, "elevance"],
  [/healthfirst/i, "healthfirst"],
];

function sourceSlugForPayer(payer: string): string | null {
  for (const [re, slug] of PAYER_TO_SOURCE_SLUG) if (re.test(payer)) return slug;
  return null;
}

function display(rate: number | string, negotiatedType: string, asOf: string): string {
  // Non-dollar types (percentage, per diem) are qualified explicitly rather
  // than rendered as a dollar figure.
  const n = Number(rate);
  const figure =
    negotiatedType === "negotiated"
      ? `$${n.toFixed(2)}`
      : `${n} (${negotiatedType})`;
  return `${figure} in-network rate · as-of ${asOf}`;
}

type SignalRow = {
  payer: string;
  plan_or_network: string;
  billing_code: string;
  negotiated_rate: string;
  billing_class: string;
  negotiated_type: string;
  place_of_service: string;
  file_date: string | Date;
  as_of: string | Date;
};

/**
 * All rate signals for an NPI, figure pre-labeled, directory join resolved.
 * "In-network with {payer} — per the payer's published rate file" is a fair
 * claim from any row; add accepting-new-patients only when directoryListed.
 * Never a patient cost.
 */
export async function getRateSignals(npi: string): Promise<RateSignal[]> {
  if (!hasDb) {
    return mockRateSignals
      .filter((r) => r.npi === npi)
      .map((r: MockRateSignalRow) => ({
        payer: r.payer,
        planOrNetwork: r.planOrNetwork,
        billingCode: r.billingCode,
        billingClass: r.billingClass,
        placeOfService: r.placeOfService,
        display: display(r.negotiatedRate, r.negotiatedType, r.asOf),
        asOf: r.asOf,
        fileDate: r.fileDate,
        directoryListed: false, // fixtures mirror today's reality: no same-payer directory rows
      }));
  }

  const rows = (await sql`
    SELECT payer, plan_or_network, billing_code, negotiated_rate, billing_class,
           negotiated_type, place_of_service, file_date, as_of
    FROM provider_rate_signals
    WHERE npi = ${npi}
    ORDER BY payer, plan_or_network, billing_code, billing_class, negotiated_rate
  `) as SignalRow[];
  if (!rows.length) return [];

  // Same-payer directory listings for this NPI → corroboration flags.
  const listed = (await sql`
    SELECT DISTINCT ps.slug
    FROM provider_network_participation pnp
    JOIN payer_sources ps ON ps.id = pnp.payer_source_id
    WHERE pnp.npi = ${npi}
  `) as Array<{ slug: string }>;
  const listedSlugs = new Set(listed.map((r) => r.slug));

  return rows.map((r) => {
    const asOf = isoDateOnly(r.as_of);
    const slug = sourceSlugForPayer(r.payer);
    return {
      payer: r.payer,
      planOrNetwork: r.plan_or_network,
      billingCode: r.billing_code,
      billingClass: r.billing_class,
      placeOfService: r.place_of_service,
      display: display(r.negotiated_rate, r.negotiated_type, asOf),
      asOf,
      fileDate: isoDateOnly(r.file_date),
      directoryListed: !!slug && listedSlugs.has(slug),
    };
  });
}
