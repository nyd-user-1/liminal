"use client";

import { useState } from "react";
import { IndexHeader } from "@/components/ui/index-header";
import { CatalogTable } from "@/components/tables/catalog-table";
import type { PhotonTreatment } from "@/lib/photon";

// Page chrome only — the list itself is the same object table the Clients rail
// mounts. The TopBar's New button drives the table's own add panel.

export function CatalogIndex({ catalogName, treatments }: { catalogName: string; treatments: PhotonTreatment[] }) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      {/* One tab until this page earns real sections; the three placeholders
          that used to sit beside it named nothing. */}
      <IndexHeader
        tabs={[{ key: "all", label: "All Treatments" }]}
        active="all"
        newLabel="New treatment"
        onNew={() => setAddOpen(true)}
      />

      <CatalogTable
        treatments={treatments}
        catalogName={catalogName}
        addOpen={addOpen}
        onAddOpenChange={setAddOpen}
      />
    </>
  );
}
