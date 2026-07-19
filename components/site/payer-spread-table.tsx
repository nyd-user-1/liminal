import { InsurerMark } from "@/components/rates/insurer-mark";
import { formatDate } from "@/lib/format";
import type { PayerSpread } from "@/lib/repos/public-stats";

// Aggregate payer-median spread, rendered as a ranked bar list — the "why the
// same session pays so differently" moment, made of live data. NEW (public
// marketing site): a composition of InsurerMark + tokens, shared by the
// pricing-data and payer-negotiation pages (one source, two surfaces). Reuses
// the rate table's own InsurerMark so the payer marks match the app exactly.
//
// HONESTY (rule 4, structural): every figure is the payer's OWN published
// in-network median for one CPT across NY books — aggregate market intelligence,
// never a specific plan's rate and never what a patient pays. The column header
// and the footnote carry that qualifier; the bar width is a visual proportion,
// not a second rate.

export function PayerSpreadTable({ spread }: { spread: PayerSpread }) {
  if (spread.rows.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface p-8 text-center shadow-card">
        <p className="text-[15px] text-text-body">
          The live payer median spread is loading from the rate corpus. Explore it on the rates surface.
        </p>
      </div>
    );
  }

  const asOf = spread.asOf ? formatDate(spread.asOf) : null;

  return (
    <figure className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-5 py-4 sm:px-7">
        <span className="font-display text-[17px] font-semibold text-text">
          CPT {spread.code} · {spread.codeLabel}
        </span>
        <span className="text-[13px] font-medium text-text-muted">
          Payer-published in-network median{asOf ? ` · as of ${asOf}` : ""}
        </span>
      </figcaption>

      <ol className="divide-y divide-border">
        {spread.rows.map((r) => (
          <li key={r.payer} className="grid grid-cols-1 gap-x-6 gap-y-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:items-center sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <InsurerMark payer={r.payer} />
              <span className="min-w-0">
                <span className="block truncate font-medium text-text" title={r.payer}>
                  {r.payer}
                </span>
                <span className="block text-[13px] text-text-muted">
                  {r.clinicians.toLocaleString("en-US")} clinicians
                </span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-primary-wash">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${r.barPct}%` }}
                />
              </div>
              <span className="w-20 shrink-0 text-right font-display text-[17px] font-semibold tabular-nums text-text">
                {r.median}
              </span>
            </div>
          </li>
        ))}
      </ol>

      <p className="border-t border-border bg-canvas px-5 py-4 text-[13px] leading-relaxed text-text-muted sm:px-7">
        Each figure is the payer&rsquo;s own published in-network median for CPT {spread.code} across New York
        behavioral books — aggregate market intelligence, not a specific plan&rsquo;s rate and never what a patient
        pays.
      </p>
    </figure>
  );
}
