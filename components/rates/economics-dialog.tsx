"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cptLabel } from "@/components/rates/cpt";
import { EconomicsTable } from "@/components/rates/economics-table";
import type { Attestation, EconCard } from "@/lib/repos/rate-signals";

// Feature 4 — Affiliation Economics, as a button-triggered dialog (moved out
// of the inline Panels flow so the standing table stays the fixed, always-
// visible thing on this tab). Not TIN arbitrage — a session bills under the
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

function plainTextSummary(clinicianLabel: string, cards: EconCard[], attestations: Attestation[]): string {
  const lines = [`Affiliation economics — ${clinicianLabel}`, ""];
  for (const card of cards) {
    lines.push(`${card.payer} pays your codes differently by contract`);
    for (const c of card.codes) {
      const parts = c.entries.map((e) => `${e.display} under ${e.holder}`).join(" · ");
      lines.push(`  ${c.billingCode} · ${cptLabel(c.billingCode)}: ${parts} — ${c.gapDisplay}`);
    }
    if (card.framing === "hours") {
      const pin = workhorseCode(card);
      lines.push(`  Your clinical hour is worth more under ${pin.entries[0].holder} for ${card.payer} patients.`);
    } else {
      const leftHolder = leftHolderFor(card, attestations);
      lines.push(`  You've marked ${leftHolder ?? "one of these contracts"} as left — see Roster check.`);
    }
    lines.push("");
  }
  lines.push(
    "Rates belong to the contract that renders the care — these numbers inform where you schedule your hours and what you renegotiate, never how a claim is coded.",
  );
  return lines.join("\n");
}

export function EconomicsButton({
  npi,
  clinicianLabel,
  cards,
  attestations,
  userEmail,
  onPinBands,
  onGoToRoster,
}: {
  npi: string;
  clinicianLabel: string;
  cards: EconCard[];
  attestations: Attestation[];
  userEmail?: string;
  onPinBands: (payer: string, code: string) => void;
  onGoToRoster: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (cards.length === 0) return null;

  const summary = plainTextSummary(clinicianLabel, cards, attestations);

  const copy = async () => {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const mailHref = `mailto:${userEmail ?? ""}?subject=${encodeURIComponent(
    `Affiliation economics — ${clinicianLabel}`,
  )}&body=${encodeURIComponent(summary)}`;

  return (
    <>
      <Button size="sm" variant="secondary" leftIcon="dollar" onClick={() => setOpen(true)} className="shrink-0">
        {clinicianLabel}: pays differently by contract — view economics
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Affiliation economics — ${clinicianLabel}`}
        icon="dollar"
        width="max-w-3xl"
        footer={
          <>
            <Button size="sm" variant="secondary" leftIcon="copy" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              leftIcon="download"
              onClick={() => window.open(`/rates/economics?npi=${npi}`, "_blank")}
            >
              PDF
            </Button>
            <Button
              size="sm"
              variant="secondary"
              leftIcon="send"
              onClick={() => {
                window.location.href = mailHref;
              }}
            >
              Email yourself
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          {cards.map((card) => {
            const pin = workhorseCode(card);
            const leftHolder = card.framing === "roster" ? leftHolderFor(card, attestations) : null;
            return (
              <div key={card.payer}>
                <h3 className="mb-2 text-[15px] font-semibold text-text">
                  {card.payer} pays your codes differently by contract
                </h3>
                <EconomicsTable card={card} />
                {card.framing === "hours" ? (
                  <p className="mt-3 text-[15px] text-text-body">
                    {`Your clinical hour is worth more under ${pin.entries[0].holder} for ${card.payer} patients — schedule accordingly.`}
                  </p>
                ) : (
                  <p className="mt-3 text-[15px] text-text-body">
                    {`You’ve marked ${leftHolder ?? "one of these contracts"} as left — `}
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => {
                        setOpen(false);
                        onGoToRoster();
                      }}
                    >
                      see Roster check
                    </button>
                    {" for what your sessions were worth there."}
                  </p>
                )}
                {card.framing === "hours" && (
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setOpen(false);
                      onPinBands(card.payer, pin.billingCode);
                    }}
                  >
                    Renegotiate the lower schedule
                  </Button>
                )}
              </div>
            );
          })}
          <p className="border-t border-border pt-4 text-[13px] leading-relaxed text-text-muted">
            Rates belong to the contract that renders the care — these numbers inform where you schedule your hours
            and what you renegotiate, never how a claim is coded.
          </p>
        </div>
      </Modal>
    </>
  );
}
