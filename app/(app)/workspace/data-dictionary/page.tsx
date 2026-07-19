import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { platformInventory } from "@/lib/repos/admin";
import { DataDictionary } from "../../admin/data/data-dictionary";

// The Data Dictionary as a workspace surface — the same live table registry
// /admin/data renders, reached from the sidebar's Workspace section rather than
// the admin-only URL. The panel component is reused (not forked); this page only
// fetches the inventory and renders it. Aggregate counts only, never a PHI read.

export const dynamic = "force-dynamic";

export default async function WorkspaceDataDictionaryPage() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/workspace");

  const inventory = await platformInventory();
  return (
    <div className="mx-auto flex min-w-0 max-w-[1400px] flex-col gap-6">
      <DataDictionary groups={inventory.groups} />
    </div>
  );
}
