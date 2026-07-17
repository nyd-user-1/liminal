"use client";

import { useEffect, useState } from "react";
import { IndexHeader } from "@/components/ui/index-header";
import { useToast } from "@/components/ui/toast";
import { ClientsTable } from "@/components/tables/clients-table";
import { PrescriptionsTable } from "@/components/tables/prescriptions-table";
import { OrdersTable } from "@/components/tables/orders-table";
import { CatalogTable } from "@/components/tables/catalog-table";
import { ClientRecordTab } from "@/components/records/client-record-tab";
import type { ClientRecordBundle } from "@/components/records/client-record";
import type { Client } from "@/lib/types";
import type { PractitionerOption } from "@/lib/repos/clients";

// The clients index is the page chrome only: the TopBar actions, the rail, and
// which object table the rail is currently showing. Every table below is the
// same component its own route mounts (components/tables/*), so a change to the
// prescriptions list lands here and on /prescriptions at once.
//
// A client row opens as a CLOSABLE TAB after the sections — /directory's
// browser-tab model, and no navigation: the record arrives over its API twin.

type Section = "clients" | "prescriptions" | "orders" | "catalog";
const SECTIONS: Section[] = ["clients", "prescriptions", "orders", "catalog"];
const isSection = (k: string): k is Section => (SECTIONS as string[]).includes(k);

const clientName = (c: Client) => `${c.firstName} ${c.lastName}`;

export function ClientsIndex({
  clients,
  practitioners,
  isAdmin,
  initialRecord,
  initialCard,
}: {
  clients: Client[];
  practitioners: PractitionerOption[];
  /** Admin sees every client + a Practitioner column; a practitioner sees only their own. */
  isAdmin: boolean;
  /** Deep link (/clients/[id]): this record opens as a tab, server-rendered. */
  initialRecord?: ClientRecordBundle;
  /** Deep link's ?tab= — the card to put on the board and scroll to. */
  initialCard?: string;
}) {
  const toast = useToast();
  const [section, setSection] = useState<Section>("clients");
  // Browser-tab model: each opened client is a closable tab after the sections;
  // `view` is "list" (show the active section) or the open client's id.
  const [openTabs, setOpenTabs] = useState<Array<{ id: string; name: string }>>(
    initialRecord ? [{ id: initialRecord.client.id, name: clientName(initialRecord.client) }] : [],
  );
  const [view, setView] = useState<string>(initialRecord ? initialRecord.client.id : "list");

  // Keep the URL bar in step with the active tab, so ⌘R (or a bookmark, or a
  // copied link) reopens the record you were on instead of the list. This is
  // pure URL sync — the /clients/[id] route already server-renders the record
  // as the open tab, so a reload lands exactly here. replaceState (not push)
  // because tab switches are a workspace, not a history stack to walk back
  // through; and we skip the write when the path already matches, which on a
  // deep link's first paint leaves any ?tab= intact (the card-scroll already
  // ran off the initialCard prop, not the URL). history.state is preserved so
  // the App Router's own navigation record isn't clobbered.
  useEffect(() => {
    const target = view === "list" ? "/clients" : `/clients/${view}`;
    if (window.location.pathname !== target) {
      window.history.replaceState(window.history.state, "", target);
    }
  }, [view]);

  function openClient(c: Client) {
    setOpenTabs((tabs) => (tabs.some((t) => t.id === c.id) ? tabs : [...tabs, { id: c.id, name: clientName(c) }]));
    setView(c.id);
  }

  // Close a client tab; if it was the active one, fall back to its left
  // neighbour (another open client, else the list).
  function closeTab(id: string) {
    const idx = openTabs.findIndex((t) => t.id === id);
    setOpenTabs((tabs) => tabs.filter((t) => t.id !== id));
    if (view === id) setView(openTabs[idx - 1]?.id ?? "list");
  }
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
      <div className="flex h-full min-h-0 flex-col">
        {/* Swaps the table in place — /directory's Providers/Programs model, not
            routing: the four surfaces of one patient-record section under one
            tab row. Status left this row and became editable in its own column —
            it is a property of the client, not a place to stand.
            (IndexHeader's TopBar half portals out of this div into the TopBar.) */}
        <IndexHeader
          newLabel={newAction[section].label}
          onNew={newAction[section].onClick}
          active={view === "list" ? section : view}
          onChange={(k) => {
            if (isSection(k)) {
              setView("list");
              setSection(k);
            } else {
              setView(k);
            }
          }}
          onClose={closeTab}
          tabs={[
            // The only in-content list heading — the TopBar H1 stays route-derived.
            { key: "clients", label: isAdmin ? "All Clients" : "My Clients" },
            { key: "prescriptions", label: "Prescriptions" },
            { key: "orders", label: "Orders" },
            { key: "catalog", label: "Catalog" },
            ...openTabs.map((t) => ({ key: t.id, label: t.name, closable: true })),
          ]}
        />

        <div className="flex min-h-0 flex-1 flex-col" hidden={view !== "list"}>
          {section === "clients" ? (
            <ClientsTable
              clients={clients}
              practitioners={practitioners}
              isAdmin={isAdmin}
              newOpen={newClientOpen}
              onNewOpenChange={setNewClientOpen}
              onRowOpen={openClient}
            />
          ) : section === "prescriptions" ? (
            <PrescriptionsTable />
          ) : section === "orders" ? (
            <OrdersTable />
          ) : (
            <CatalogTable addOpen={addTreatmentOpen} onAddOpenChange={setAddTreatmentOpen} />
          )}
        </div>

        {/* Open records stay MOUNTED behind the active tab — a board rearranged
            on one client must still be there when you tab back to it. */}
        {openTabs.map((t) => (
          <div key={t.id} className="min-h-0 flex-1" hidden={view !== t.id}>
            <ClientRecordTab
              clientId={t.id}
              initial={t.id === initialRecord?.client.id ? initialRecord : undefined}
              initialCard={t.id === initialRecord?.client.id ? initialCard : undefined}
            />
          </div>
        ))}
      </div>
    </>
  );
}
