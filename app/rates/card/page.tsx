import { redirect } from "next/navigation";
import { PrintActions } from "@/components/billing/print-actions";
import { DEFAULT_CODES, cptLabel } from "@/components/rates/cpt";
import { Logo } from "@/components/ui/logo";
import { getUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getRateBands, type RateBand } from "@/lib/repos/rate-signals";

// The negotiation one-pager — deliberately OUTSIDE the (app) route group so
// the workspace shell never renders around the document (the print-surface H1
// exception). On screen: a paper sheet + the shared Print toolbar; in print:
// just the card. Rates are payer-published public-record data, not PHI.

export const dynamic = "force-dynamic";

export default async function RateCardPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ codes?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  if (user.role === "client") redirect("/portal");

  const { codes: codesParam } = await searchParams;
  const codes = [...new Set((codesParam ?? "").split(","))].filter((c) => /^\d{5}$/.test(c)).slice(0, 8);
  const picked = codes.length > 0 ? codes : DEFAULT_CODES;
  const bands = await getRateBands(picked);

  const byCode = new Map<string, RateBand[]>();
  for (const b of bands) byCode.set(b.billingCode, [...(byCode.get(b.billingCode) ?? []), b]);
  const asOf = bands.reduce((m, b) => (b.asOf > m ? b.asOf : m), bands[0]?.asOf ?? "");

  return (
    <div className="print-page min-h-screen bg-canvas py-8">
      <style>{`
        @media print {
          .print-hide { display: none !important; }
          .print-page { background: white !important; padding: 0 !important; }
          .print-sheet { box-shadow: none !important; border: none !important; border-radius: 0 !important; margin: 0 !important; max-width: none !important; padding: 0 !important; }
          @page { margin: 16mm; }
        }
      `}</style>

      <PrintActions />

      <div className="print-sheet mx-auto max-w-[820px] rounded-card border border-border bg-surface p-10 shadow-card">
        <div className="flex items-start justify-between">
          <div>
            <Logo size="md" />
            <p className="mt-3 text-sm text-text-muted">Payer rate intelligence · NY behavioral book</p>
          </div>
          <div className="text-right">
            <h1 className="text-[22px] font-bold tracking-wide text-text">KNOW YOUR RATES</h1>
            {asOf && <p className="mt-1 text-sm text-text-muted">as-of {formatDate(`${asOf}T00:00:00`)}</p>}
          </div>
        </div>

        <p className="mt-6 text-[14px] leading-relaxed text-text-body">
          Per-payer in-network rate bands (25th percentile / median / 75th percentile), computed on the
          payer&rsquo;s own published Transparency-in-Coverage files — deduped per clinician, NY-book entities
          only. A published rate is the payer&rsquo;s own attestation that a contract exists; it is what the
          payer pays the clinician, never what a patient pays.
        </p>

        {picked.map((code) => {
          const rows = byCode.get(code) ?? [];
          if (rows.length === 0) return null;
          return (
            <div key={code} className="mt-7">
              <h2 className="text-[16px] font-semibold text-text">
                {code} · {cptLabel(code)}
              </h2>
              <table className="mt-2 w-full border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-text/80 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
                    <th className="py-1.5 pr-3">Payer</th>
                    <th className="py-1.5 pr-3">License</th>
                    <th className="py-1.5 pr-3 text-right">P25</th>
                    <th className="py-1.5 pr-3 text-right">Median</th>
                    <th className="py-1.5 pr-3 text-right">P75</th>
                    <th className="py-1.5 pr-3">Schedule</th>
                    <th className="py-1.5 text-right">Clinicians</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr
                      key={`${b.payer}|${b.network}|${b.license}`}
                      className="border-b border-border text-[13.5px] text-text-body"
                    >
                      <td className="py-1.5 pr-3 font-medium text-text">
                        {b.payer}
                        {b.network !== "All networks" && (
                          <span className="font-normal text-text-muted"> · {b.network}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-1.5 pr-3">{b.license}</td>
                      <td className="whitespace-nowrap py-1.5 pr-3 text-right">{b.p25}</td>
                      <td className="whitespace-nowrap py-1.5 pr-3 text-right font-semibold text-text">{b.median}</td>
                      <td className="whitespace-nowrap py-1.5 pr-3 text-right">{b.p75}</td>
                      <td className="py-1.5 pr-3">{b.negotiabilityLabel}</td>
                      <td className="py-1.5 text-right">{b.cliniciansDisplay}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

        <p className="mt-8 border-t border-border pt-4 text-[12.5px] leading-relaxed text-text-muted">
          A band is ammunition for the ask, not a guarantee of an offer. License tiers come from the NY
          provider directory (NPPES/Medicaid) joined by NPI. Published rates prove a contract existed on the
          file date; they do not carry accepting-new-patients status. Never a patient&rsquo;s cost. Source:
          payer-published machine-readable files{asOf && <> · as-of {asOf}</>}.
        </p>
      </div>
    </div>
  );
}
