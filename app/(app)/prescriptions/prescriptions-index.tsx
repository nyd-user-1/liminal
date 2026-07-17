"use client";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Tabs } from "@/components/ui/tabs";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { useToast } from "@/components/ui/toast";
import { PrescriptionsTable, type PrescriptionRow } from "@/components/tables/prescriptions-table";

// Page chrome only — the list itself is the same object table the Clients rail
// mounts. Rows arrive pre-scoped by role from the server page.

export function PrescriptionsIndex({ rows, truncated }: { rows: PrescriptionRow[]; truncated: boolean }) {
  const toast = useToast();

  return (
    <>
      <TopBarActions>
        <Button size="sm" leftIcon="plus" onClick={() => toast("New prescription isn’t wired up yet.", "info")}>
          New prescription
        </Button>
        <IconButton icon="bell" label="Notifications" onClick={() => toast("No new notifications.", "info")} />
      </TopBarActions>

      {/* The only in-content list heading — the TopBar H1 stays route-derived.
          One tab until this page earns real sections; the three placeholders
          that used to sit beside it named nothing. */}
      <Tabs className="mt-4 mb-4 shrink-0" slideActive active="all" items={[{ key: "all", label: "All Prescriptions" }]} />

      <PrescriptionsTable rows={rows} truncated={truncated} />
    </>
  );
}
