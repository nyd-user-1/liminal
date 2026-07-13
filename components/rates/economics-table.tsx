"use client";

import { Table, Td, Tr } from "@/components/ui/table";
import { cptLabel } from "@/components/rates/cpt";
import type { EconCard } from "@/lib/repos/rate-signals";

// Shared row-styled render of one economics card's per-code comparison —
// used by both the Panels dialog and the print view, so the two never drift.
// Pivots each card's distinct holders into columns (a card's codes always
// ride the same TIN set, per getAffiliationEconomics).

export function EconomicsTable({ card }: { card: EconCard }) {
  const holders = [...new Set(card.codes.flatMap((c) => c.entries.map((e) => e.holder)))];

  return (
    <Table head={["Service", "Code", ...holders, "Gap"]}>
      {card.codes.map((c) => (
        <Tr key={c.billingCode}>
          <Td className="whitespace-nowrap">{cptLabel(c.billingCode)}</Td>
          <Td className="whitespace-nowrap text-text-muted">{c.billingCode}</Td>
          {holders.map((h) => {
            const entry = c.entries.find((e) => e.holder === h);
            return (
              <Td key={h} className="whitespace-nowrap">
                {entry ? entry.display : "—"}
              </Td>
            );
          })}
          <Td className="whitespace-nowrap font-semibold text-text">{c.gapDisplay}</Td>
        </Tr>
      ))}
    </Table>
  );
}
