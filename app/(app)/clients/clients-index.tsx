"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Tabs } from "@/components/ui/tabs";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { useToast } from "@/components/ui/toast";
import { ClientsTable } from "@/components/tables/clients-table";
import { PrescriptionsTable } from "@/components/tables/prescriptions-table";
import { OrdersTable } from "@/components/tables/orders-table";
import { CatalogTable } from "@/components/tables/catalog-table";
import type { Client } from "@/lib/types";
import type { PractitionerOption } from "@/lib/repos/clients";

// The clients index is the page chrome only: the TopBar actions, the rail, and
// which object table the rail is currently showing. Every table below is the
// same component its own route mounts (components/tables/*), so a change to the
// prescriptions list lands here and on /prescriptions at once.

type Section = "clients" | "prescriptions" | "orders" | "catalog";

export function ClientsIndex({
  clients,
  practitioners,
  isAdmin,
}: {
  clients: Client[];
  practitioners: PractitionerOption[];
  /** Admin sees every client + a Practitioner column; a practitioner sees only their own. */
  isAdmin: boolean;
}) {
  const toast = useToast();
  const [section, setSection] = useState<Section>("clients");
  // The create flows the TopBar's New button drives; the tables own the panels.
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [addTreatmentOpen, setAddTreatmentOpen] = useState(false);

  // New follows the rail — the button creates whatever you are looking at.
  // Prescriptions and orders have no create flow of their own yet, so they toast
  // rather than sit dead (the same stub their own routes show).
  const newAction: Record<Section, { label: string; onClick: () => void }> = {
    clients: { label: "New client", onClick: () => setNewClientOpen(true) },
    prescriptions: { label: "New prescription", onClick: () => toast("New prescription isn’t wired up yet.", "info") },
    orders: { label: "New order", onClick: () => toast("New order isn’t wired up yet.", "info") },
    catalog: { label: "New treatment", onClick: () => setAddTreatmentOpen(true) },
  };

  return (
    <>
      <TopBarActions>
        <Button size="sm" leftIcon="plus" onClick={newAction[section].onClick}>
          {newAction[section].label}
        </Button>
        <IconButton icon="bell" label="Notifications" onClick={() => toast("No new notifications.", "info")} />
      </TopBarActions>

      <div className="flex h-full min-h-0 flex-col">
        {/* Swaps the table in place — /directory's Providers/Programs model, not
            routing: the four surfaces of one patient-record section under one
            tab row. Status left this row and became editable in its own column —
            it is a property of the client, not a place to stand. */}
        <Tabs
          className="mt-4 mb-4 shrink-0"
          slideActive
          active={section}
          onChange={(k) => setSection(k as Section)}
          items={[
            // The only in-content list heading — the TopBar H1 stays route-derived.
            { key: "clients", label: isAdmin ? "All Clients" : "My Clients" },
            { key: "prescriptions", label: "Prescriptions" },
            { key: "orders", label: "Orders" },
            { key: "catalog", label: "Catalog" },
          ]}
        />

        {section === "clients" ? (
          <ClientsTable
            clients={clients}
            practitioners={practitioners}
            isAdmin={isAdmin}
            newOpen={newClientOpen}
            onNewOpenChange={setNewClientOpen}
          />
        ) : section === "prescriptions" ? (
          <PrescriptionsTable />
        ) : section === "orders" ? (
          <OrdersTable />
        ) : (
          <CatalogTable addOpen={addTreatmentOpen} onAddOpenChange={setAddTreatmentOpen} />
        )}
      </div>
    </>
  );
}
