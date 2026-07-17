"use client";

import { IndexHeader } from "@/components/ui/index-header";
import { useToast } from "@/components/ui/toast";
import { PrescriptionsTable, type PrescriptionRow } from "@/components/tables/prescriptions-table";

// Page chrome only — the list itself is the same object table the Clients rail
// mounts. Rows arrive pre-scoped by role from the server page.

export function PrescriptionsIndex({ rows, truncated }: { rows: PrescriptionRow[]; truncated: boolean }) {
  const toast = useToast();

  return (
    <>
      {/* One tab until this page earns real sections; the three placeholders
          that used to sit beside it named nothing. */}
      <IndexHeader
        tabs={[{ key: "all", label: "All Prescriptions" }]}
        active="all"
        newLabel="New prescription"
        onNew={() => toast("New prescription isn’t wired up yet.", "info")}
      />

      <PrescriptionsTable rows={rows} truncated={truncated} />
    </>
  );
}
