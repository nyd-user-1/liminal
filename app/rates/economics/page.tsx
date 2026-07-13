import { redirect } from "next/navigation";
import { PrintActions } from "@/components/billing/print-actions";
import { clinicianName } from "@/components/rates/clinician-name";
import { EconomicsTable } from "@/components/rates/economics-table";
import { Logo } from "@/components/ui/logo";
import { getUser } from "@/lib/auth";
import { getAffiliationEconomics, getAttestations, getCredentialingFootprint } from "@/lib/repos/rate-signals";

// Affiliation Economics one-pager — deliberately OUTSIDE the (app) route
// group (the print-surface H1 exception), same pattern as /rates/card and
// /rates/packet. Triggered from the Panels economics dialog's PDF button.

export const dynamic = "force-dynamic";

function normalizeTin(tin: string): string {
  return tin.toLowerCase().replace(/[\s-]/g, "");
}

function workhorseCode(card: Awaited<ReturnType<typeof getAffiliationEconomics>>[number]) {
  return card.codes.find((c) => c.billingCode === "90837") ?? card.codes[0];
}

function leftHolderFor(
  card: Awaited<ReturnType<typeof getAffiliationEconomics>>[number],
  attestations: Awaited<ReturnType<typeof getAttestations>>,
): string | null {
  const leftTins = new Set(attestations.filter((a) => a.status === "left").map((a) => normalizeTin(a.tin)));
  for (const code of card.codes) {
    for (const e of code.entries) {
      if (leftTins.has(normalizeTin(e.tin))) return e.holder;
    }
  }
  return null;
}

export default async function EconomicsPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ npi?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  if (user.role === "client") redirect("/portal");

  const { npi: npiParam } = await searchParams;
  const npi = npiParam?.trim() ?? "";
  if (!/^\d{10}$/.test(npi)) redirect("/rates");

  const [footprint, cards, attestations] = await Promise.all([
    getCredentialingFootprint(npi),
    getAffiliationEconomics(npi),
    getAttestations(npi),
  ]);
  const name = footprint.identity ? clinicianName(footprint.identity.name) : npi;

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
          <Logo size="md" />
          <div className="text-right">
            <h1 className="text-[20px] font-bold tracking-wide text-text">AFFILIATION ECONOMICS</h1>
            <p className="mt-1 text-sm text-text-muted">{name}</p>
          </div>
        </div>

        {cards.length === 0 ? (
          <p className="mt-8 text-[15px] text-text-body">
            No multi-TIN affiliation economics on file for this NPI as of the file date.
          </p>
        ) : (
          <div className="mt-8 space-y-8">
            {cards.map((card) => {
              const pin = workhorseCode(card);
              const leftHolder = card.framing === "roster" ? leftHolderFor(card, attestations) : null;
              return (
                <div key={card.payer}>
                  <h2 className="mb-2 text-[16px] font-semibold text-text">
                    {card.payer} pays your codes differently by contract
                  </h2>
                  <EconomicsTable card={card} />
                  {card.framing === "hours" ? (
                    <p className="mt-3 text-[13.5px] text-text-body">
                      {`Your clinical hour is worth more under ${pin.entries[0].holder} for ${card.payer} patients — schedule accordingly.`}
                    </p>
                  ) : (
                    <p className="mt-3 text-[13.5px] text-text-body">
                      {`You’ve marked ${leftHolder ?? "one of these contracts"} as left — see Roster check for what your sessions were worth there.`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-8 border-t border-border pt-4 text-[12.5px] leading-relaxed text-text-muted">
          Rates belong to the contract that renders the care — these numbers inform where you schedule your hours and
          what you renegotiate, never how a claim is coded.
        </p>
      </div>
    </div>
  );
}
