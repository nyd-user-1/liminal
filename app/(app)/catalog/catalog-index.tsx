"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Tabs } from "@/components/ui/tabs";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { useToast } from "@/components/ui/toast";
import { CatalogTable } from "@/components/tables/catalog-table";
import type { PhotonTreatment } from "@/lib/photon";

// Page chrome only — the list itself is the same object table the Clients rail
// mounts. The TopBar's New button drives the table's own add panel.

export function CatalogIndex({ catalogName, treatments }: { catalogName: string; treatments: PhotonTreatment[] }) {
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <TopBarActions>
        <Button size="sm" leftIcon="plus" onClick={() => setAddOpen(true)}>
          New treatment
        </Button>
        <IconButton icon="bell" label="Notifications" onClick={() => toast("No new notifications.", "info")} />
      </TopBarActions>

      {/* The only in-content list heading — the TopBar H1 stays route-derived.
          One tab until this page earns real sections; the three placeholders
          that used to sit beside it named nothing. */}
      <Tabs className="mt-4 mb-4 shrink-0" slideActive active="all" items={[{ key: "all", label: "All Treatments" }]} />

      <CatalogTable
        treatments={treatments}
        catalogName={catalogName}
        addOpen={addOpen}
        onAddOpenChange={setAddOpen}
      />
    </>
  );
}
