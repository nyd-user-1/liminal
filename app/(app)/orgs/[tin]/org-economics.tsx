"use client";

import { Banner } from "@/components/ui/banner";
import { Table, Td, Tr } from "@/components/ui/table";
import { cptLabel } from "@/components/rates/cpt";
import { InsurerMark } from "@/components/rates/insurer-mark";
import type { OrgRateBand } from "@/lib/repos/orgs";

// Per-insurer rate economics — the headline. One row per (payer, CPT); the
// insurer name shows once per group. Figures are what the PAYER pays this
// org's clinicians (negotiated in-network rates), NOT patient cost — the
// section framing carries that, per the rate-signals display rules. Bands are
// 25th / median / 75th over the org's deduped rate rows for that code.

// Canonical order for the well-known behavioral codes; unknown codes sort after.
const CPT_ORDER = ["90791", "90792", "90834", "90837", "90853", "99213", "99214", "99215"];
const cptRank = (c: string) => {
  const i = CPT_ORDER.indexOf(c);
  return i === -1 ? CPT_ORDER.length : i;
};

const usd = (n: number | null) => (n == null ? "—" : `$${n.toFixed(2)}`);

export function OrgEconomics({ rates, asOf }: { rates: OrgRateBand[]; asOf: string | null }) {
  // Group by payer, order payers by their largest roster, codes canonically.
  const byPayer = new Map<string, OrgRateBand[]>();
  for (const r of rates) {
    const g = byPayer.get(r.payer);
    if (g) g.push(r);
    else byPayer.set(r.payer, [r]);
  }
  const groups = [...byPayer.entries()]
    .map(([payer, rows]) => ({
      payer,
      rows: [...rows].sort((a, b) => cptRank(a.billingCode) - cptRank(b.billingCode) || a.billingCode.localeCompare(b.billingCode)),
      maxNpis: Math.max(...rows.map((r) => r.npis)),
    }))
    .sort((a, b) => b.maxNpis - a.maxNpis || a.payer.localeCompare(b.payer));

  return (
    <section>
      <h2 className="text-[17px] font-semibold text-text">In-network rates</h2>
      <p className="mt-1 max-w-2xl text-sm text-text-muted">
        What each payer pays this organization&rsquo;s clinicians — negotiated in-network rates from the payer&rsquo;s own
        rate files, not patient cost. Bands are the 25th percentile, median, and 75th percentile across the org&rsquo;s
        rate rows for that code{asOf ? `, as-of ${asOf}` : ""}.
      </p>

      {groups.length === 0 ? (
        <Banner variant="info" className="mt-4">
          No dollar-denominated rate rows for this organization. Its rate rows may all be percentage-of-charge
          contracts, which don&rsquo;t carry a comparable dollar figure.
        </Banner>
      ) : (
        <Table
          className="mt-4"
          head={["Insurer", "Code", "Clinicians", "25th", "Median", "75th", "As-of"]}
        >
          {groups.flatMap((g) =>
            g.rows.map((r, i) => (
              <Tr key={`${g.payer}|${r.billingCode}`} className={i === 0 ? "border-t-2 border-t-border" : ""}>
                <Td className="whitespace-nowrap">
                  {i === 0 ? (
                    <span className="flex items-center gap-2.5">
                      <InsurerMark payer={g.payer} />
                      <span className="max-w-48 truncate font-medium text-text" title={g.payer}>
                        {g.payer}
                      </span>
                    </span>
                  ) : (
                    <span className="sr-only">{g.payer}</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap" title={cptLabel(r.billingCode)}>
                  <span className="tabular-nums">{r.billingCode}</span>
                </Td>
                <Td className="whitespace-nowrap tabular-nums text-text-body">{r.npis.toLocaleString()}</Td>
                <Td className="whitespace-nowrap tabular-nums text-text-muted">{usd(r.p25)}</Td>
                <Td className="whitespace-nowrap tabular-nums font-medium text-text">{usd(r.median)}</Td>
                <Td className="whitespace-nowrap tabular-nums text-text-muted">{usd(r.p75)}</Td>
                <Td className="whitespace-nowrap text-text-muted">{r.asOf}</Td>
              </Tr>
            )),
          )}
        </Table>
      )}
    </section>
  );
}
