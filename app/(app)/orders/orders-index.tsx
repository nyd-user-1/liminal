"use client";

import { IndexHeader } from "@/components/ui/index-header";
import { useToast } from "@/components/ui/toast";
import { OrdersTable, type OrderRow } from "@/components/tables/orders-table";

// Page chrome only — the list itself is the same object table the Clients rail
// mounts. Rows arrive pre-scoped by role from the server page.

export function OrdersIndex({ rows, truncated }: { rows: OrderRow[]; truncated: boolean }) {
  const toast = useToast();

  return (
    <>
      {/* One tab until this page earns real sections; the three placeholders
          that used to sit beside it named nothing. */}
      <IndexHeader
        tabs={[{ key: "all", label: "All Orders" }]}
        active="all"
        newLabel="New order"
        onNew={() => toast("New order isn’t wired up yet.", "info")}
      />

      <OrdersTable rows={rows} truncated={truncated} />
    </>
  );
}
