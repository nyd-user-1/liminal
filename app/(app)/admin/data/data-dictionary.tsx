"use client";

import type { DictionaryGroup, DictionaryTable } from "@/lib/repos/admin";
import { Badge } from "@/components/ui/badge";
import { SettingsCard } from "@/components/ui/card";
import { Table, Td, Tr } from "@/components/ui/table";

function formatCount(t: DictionaryTable): string {
  if (t.count === null) return "—";
  const n = t.count.toLocaleString("en-US");
  // Estimates carry a trailing "+" rather than a leading almost-equal glyph.
  return t.countKind === "estimate" ? `${n}+` : n;
}

export function DataDictionary({ groups }: { groups: DictionaryGroup[] }) {
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <SettingsCard key={group.title} title={group.title}>
          <Table head={["Table", "Count", "Meaning", "Links to"]}>
            {group.tables.map((t) => (
              <Tr key={t.name} className={t.planned ? "opacity-60" : undefined}>
                <Td className="whitespace-nowrap font-mono text-sm">{t.name}</Td>
                <Td className="whitespace-nowrap tabular-nums">
                  {t.planned ? (
                    <span className="flex items-center gap-2">
                      <Badge variant="neutral">planned</Badge>
                      <span className="text-text-muted">{t.planned}</span>
                    </span>
                  ) : (
                    formatCount(t)
                  )}
                </Td>
                <Td>{t.meaning}</Td>
                <Td className="text-text-muted">{t.links}</Td>
              </Tr>
            ))}
          </Table>
        </SettingsCard>
      ))}

      <p className="text-sm text-text-muted">
        Counts are live (a trailing + marks a planner estimate). Sources: NPPES/Medicaid/OMH (foundation), payer FHIR
        directories (membership), TiC MRF files (rates), Aetna ToC (employers/plans).
      </p>
    </div>
  );
}
