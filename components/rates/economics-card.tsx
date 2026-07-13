"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cptLabel } from "@/components/rates/cpt";
import { InsurerMark } from "@/components/rates/insurer-mark";
import type { Attestation, EconCard } from "@/lib/repos/rate-signals";

// Feature 4 — Affiliation Economics. Shown only when a payer lists the NPI
// under 2+ TINs with schedules that actually differ (getAffiliationEconomics
// already filters to that). Not TIN arbitrage — a session bills under the
// entity that rendered it; the disclaimer line is mandatory and verbatim.

function normalizeTin(tin: string): string {
  return tin.toLowerCase().replace(/[\s-]/g, "");
}

function workhorseCode(card: EconCard) {
  return card.codes.find((c) => c.billingCode === "90837") ?? card.codes[0];
}

function leftHolderFor(card: EconCard, attestations: Attestation[]): string | null {
  const leftTins = new Set(attestations.filter((a) => a.status === "left").map((a) => normalizeTin(a.tin)));
  for (const code of card.codes) {
    for (const e of code.entries) {
      if (leftTins.has(normalizeTin(e.tin))) return e.holder;
    }
  }
  return null;
}

export function EconomicsCard({
  card,
  attestations,
  onPinBands,
  onGoToRoster,
}: {
  card: EconCard;
  attestations: Attestation[];
  onPinBands: (payer: string, code: string) => void;
  onGoToRoster: () => void;
}) {
  const pin = workhorseCode(card);
  const leftHolder = card.framing === "roster" ? leftHolderFor(card, attestations) : null;

  return (
    <Card className="mb-4">
      <h2 className="flex items-center gap-2.5 text-[17px] font-semibold text-text">
        <InsurerMark payer={card.payer} />
        {card.payer} pays your codes differently by contract
      </h2>

      <ul className="mt-3 space-y-1.5 text-[15px] text-text-body">
        {card.codes.map((c) => (
          <li key={c.billingCode}>
            <span className="font-medium text-text">{c.billingCode}</span>{" "}
            <span className="text-text-muted">· {cptLabel(c.billingCode)}</span>:{" "}
            {c.entries.map((e, i) => (
              <span key={e.tin}>
                {i > 0 && " · "}
                {e.display} under {e.holder}
              </span>
            ))}{" "}
            — <span className="font-semibold text-text">{c.gapDisplay}</span>
          </li>
        ))}
      </ul>

      {card.framing === "hours" ? (
        <p className="mt-3 text-[15px] text-text-body">
          {`Your clinical hour is worth more under ${pin.entries[0].holder} for ${card.payer} patients — schedule accordingly.`}
        </p>
      ) : (
        <p className="mt-3 text-[15px] text-text-body">
          {`You’ve marked ${leftHolder ?? "one of these contracts"} as left — `}
          <button type="button" className="font-medium text-primary hover:underline" onClick={onGoToRoster}>
            see Roster check
          </button>
          {" for what your sessions were worth there."}
        </p>
      )}

      <p className="mt-3 text-[13px] leading-relaxed text-text-muted">
        Rates belong to the contract that renders the care — these numbers inform where you schedule your hours and
        what you renegotiate, never how a claim is coded.
      </p>

      {card.framing === "hours" && (
        <Button
          className="mt-3"
          size="sm"
          variant="secondary"
          onClick={() => onPinBands(card.payer, pin.billingCode)}
        >
          Renegotiate the lower schedule
        </Button>
      )}
    </Card>
  );
}
