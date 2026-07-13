import { redirect } from "next/navigation";
import { PrintActions } from "@/components/billing/print-actions";
import { clinicianName } from "@/components/rates/clinician-name";
import { Logo } from "@/components/ui/logo";
import { getUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getCredentialingFootprint, type CredentialingFootprint } from "@/lib/repos/rate-signals";

// The recruiting comparison one-pager — deliberately OUTSIDE the (app) route
// group so the workspace shell never renders around the document (the
// print-surface H1 exception). Rates are payer-published public-record data,
// not PHI; identity here is statewide-directory data, also not PHI.

export const dynamic = "force-dynamic";

const MAX_NPIS = 4;

function candidateLabel(f: CredentialingFootprint): string {
  return f.identity ? clinicianName(f.identity.name) : f.npi;
}

function moneyOnly(display: string): string {
  return display.match(/\$[\d,.]+/)?.[0] ?? display;
}

export default async function RecruitingPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ npis?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  if (user.role === "client") redirect("/portal");

  const { npis: npisParam } = await searchParams;
  const npis = [...new Set((npisParam ?? "").split(","))]
    .map((s) => s.trim())
    .filter((s) => /^\d{10}$/.test(s))
    .slice(0, MAX_NPIS);

  const footprints = await Promise.all(npis.map(getCredentialingFootprint));
  const comparePayers = [...new Set(footprints.flatMap((f) => f.foundIn.map((b) => b.payer)))].sort();
  const now = new Date().toISOString().slice(0, 10);

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
            <p className="mt-3 text-sm text-text-muted">Candidate credentialing footprint · NY behavioral book</p>
          </div>
          <div className="text-right">
            <h1 className="text-[22px] font-bold tracking-wide text-text">RECRUITING COMPARISON</h1>
            <p className="mt-1 text-sm text-text-muted">as-of {formatDate(`${now}T00:00:00`)}</p>
          </div>
        </div>

        <p className="mt-6 text-[14px] leading-relaxed text-text-body">
          Which NY payer books already publish each candidate — presence is the payer&rsquo;s own attestation as of
          the file date, and pays forward the moment a group adds them to the roster (weeks), not full initial
          credentialing (months). It does not prove current employment or panel status; never a background check.
        </p>

        {comparePayers.length > 0 && (
          <div className="mt-7">
            <h2 className="text-[16px] font-semibold text-text">Compare — 90837 by payer</h2>
            <table className="mt-2 w-full border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-text/80 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
                  <th className="py-1.5 pr-3">Payer</th>
                  {footprints.map((f) => (
                    <th key={f.npi} className="py-1.5 pr-3">
                      {candidateLabel(f)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparePayers.map((payer) => (
                  <tr key={payer} className="border-b border-border text-[13.5px] text-text-body">
                    <td className="py-1.5 pr-3 font-medium text-text">{payer}</td>
                    {footprints.map((f) => {
                      const hit = f.foundIn.find((b) => b.payer === payer)?.codes["90837"];
                      return (
                        <td key={f.npi} className="py-1.5 pr-3">
                          {hit ? moneyOnly(hit) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {footprints.map((f) => (
          <div key={f.npi} className="mt-7 break-inside-avoid">
            <h2 className="text-[16px] font-semibold text-text">
              {candidateLabel(f)}
              {f.identity?.profession && (
                <span className="ml-2 text-[13px] font-normal text-text-muted">{f.identity.profession}</span>
              )}
            </h2>
            <p className="mt-1 text-[13px] text-text-muted">
              Checked {f.checkedBooks.length} NY payer books · found in {f.foundIn.length}
            </p>
            {f.foundIn.length > 0 && (
              <p className="mt-1 text-[13.5px] text-text-body">
                Found in: {[...new Set(f.foundIn.map((b) => b.payer))].join(", ")}
              </p>
            )}
            {f.absentFrom.length > 0 && (
              <p className="mt-1 text-[13.5px] text-text-body">
                Verified-absent: {f.absentFrom.join(", ")}
              </p>
            )}
          </div>
        ))}

        <p className="mt-8 border-t border-border pt-4 text-[12.5px] leading-relaxed text-text-muted">
          Presence is the payer&rsquo;s own published attestation as of the file date — it does not prove current
          employment or panel status. Absence is only claimable for the NY books we index; other-state regional
          books are not yet indexed. Never a background check. Source: payer-published machine-readable files.
        </p>
      </div>
    </div>
  );
}
