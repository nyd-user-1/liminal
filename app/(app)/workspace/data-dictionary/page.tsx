import { redirect } from "next/navigation";
import { BoardTabs } from "@/components/shell/board-tabs";
import { requireUser } from "@/lib/auth";
import { platformInventory } from "@/lib/repos/admin";
import { getSchemaGraph } from "@/lib/repos/schema-map";
import type { SchemaTableMeta } from "@/components/maps/schema-canvas";
import { DictionaryViews } from "./dictionary-views";

// The Data Dictionary as a workspace surface — two views of the live table
// registry: the curated Registry (same panel /admin/data renders) and the
// Schema map (the real catalog as a canvas: columns, FKs, matview lineage).
// Catalog metadata + aggregate counts only, never a PHI read.

export const dynamic = "force-dynamic";

export default async function WorkspaceDataDictionaryPage() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/workspace");

  const [inventory, schema] = await Promise.all([platformInventory(), getSchemaGraph()]);

  // Curated group/meaning/count per table — the canvas bands and tooltips.
  const meta: Record<string, SchemaTableMeta> = {};
  for (const g of inventory.groups) {
    for (const t of g.tables) {
      meta[t.name] = { group: g.title, count: t.count, meaning: t.meaning };
    }
  }

  return (
    <div className="mx-auto flex min-w-0 max-w-[1400px] flex-col gap-6">
      <BoardTabs />
      <DictionaryViews groups={inventory.groups} schema={schema} meta={meta} />
    </div>
  );
}
