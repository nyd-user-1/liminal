"use client";

import { useState } from "react";
import type { DictionaryGroup, DictionaryTable } from "@/lib/repos/admin";
import { Badge } from "@/components/ui/badge";
import { SettingsCard } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { Table, Td, Tr } from "@/components/ui/table";

function formatCount(t: DictionaryTable): string {
  if (t.count === null) return "—";
  const n = t.count.toLocaleString("en-US");
  // Estimates carry a trailing "+" rather than a leading almost-equal glyph.
  return t.countKind === "estimate" ? `${n}+` : n;
}

export function DataDictionary({ groups }: { groups: DictionaryGroup[] }) {
  // Standard anatomy: select column (table names are unique schema-wide).
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggle = (name: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (!next.delete(name)) next.add(name);
      return next;
    });
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <SettingsCard key={group.title} title={group.title}>
          <Table
            footer={
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13px] text-text-muted">
                <span className="min-w-0 truncate tabular-nums">{group.tables.length.toLocaleString("en-US")} records</span>
                <span className="shrink-0">Data set by NYSgpt</span>
              </div>
            }
            head={[
              <Checkbox
                key="__sel"
                aria-label="Select all"
                checked={group.tables.every((t) => sel.has(t.name))}
                onChange={() =>
                  setSel((prev) => {
                    const all = group.tables.every((t) => prev.has(t.name));
                    const next = new Set(prev);
                    group.tables.forEach((t) => (all ? next.delete(t.name) : next.add(t.name)));
                    return next;
                  })
                }
              />,
              "Table",
              "Count",
              "Meaning",
              "Links to",
              "",
            ]}
          >
            {group.tables.map((t) => (
              <Tr key={t.name} className={t.planned ? "opacity-60" : undefined}>
                <Td className="w-10" onClick={(e) => e.stopPropagation()}>
                  <Checkbox aria-label="Select row" checked={sel.has(t.name)} onChange={() => toggle(t.name)} />
                </Td>
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
                <Td className="w-12" onClick={(e) => e.stopPropagation()}>
                  <KebabMenu label={`Actions for ${t.name}`}>
                    <MenuItem icon="copy" label="Copy table name" onClick={() => void navigator.clipboard.writeText(t.name)} />
                  </KebabMenu>
                </Td>
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
