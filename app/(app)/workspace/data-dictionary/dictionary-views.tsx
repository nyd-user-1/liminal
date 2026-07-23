"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/spinner";
import { DataDictionary } from "../../admin/data/data-dictionary";
import type { DictionaryGroup } from "@/lib/repos/admin";
import type { SchemaGraph } from "@/lib/repos/schema-map";
import type { SchemaTableMeta } from "@/components/maps/schema-canvas";

// Registry | Schema map — two views of the same truth. The registry is the
// curated prose (what each table means); the map is the live catalog drawn
// as a canvas (columns, FKs, matview lineage). Toggle is the org-map
// segmented pattern.

const SchemaCanvas = dynamic(() => import("@/components/maps/schema-canvas").then((m) => m.SchemaCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-[72vh] items-center justify-center">
      <Spinner size={22} className="text-text-muted" />
    </div>
  ),
});

export function DictionaryViews({
  groups,
  schema,
  meta,
}: {
  groups: DictionaryGroup[];
  schema: SchemaGraph;
  meta: Record<string, SchemaTableMeta>;
}) {
  const [view, setView] = useState<"registry" | "map">("registry");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-9 w-fit items-center overflow-hidden rounded-field border border-border bg-surface shadow-card">
        {(
          [
            ["registry", "Registry"],
            ["map", "Schema map"],
          ] as const
        ).map(([key, label], i) => (
          <span key={key} className="flex h-full items-center">
            {i > 0 && <span className="h-5 w-px bg-border" aria-hidden />}
            <button
              type="button"
              onClick={() => setView(key)}
              aria-pressed={view === key}
              className={`h-full px-3 text-[13px] font-medium transition-colors ${
                view === key ? "bg-[rgba(0,0,0,0.05)] text-text" : "text-text-body hover:text-primary"
              }`}
            >
              {label}
            </button>
          </span>
        ))}
      </div>
      {view === "registry" ? (
        <DataDictionary groups={groups} />
      ) : (
        <div className="flex h-[72vh] min-h-[480px] flex-col">
          <SchemaCanvas schema={schema} meta={meta} />
        </div>
      )}
    </div>
  );
}
