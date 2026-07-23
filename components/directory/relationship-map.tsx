"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/spinner";
import { TextLink } from "@/components/ui/text-link";
import type { OrgGraph } from "@/lib/org-graph";

// The relationship_map tool's generative UI — an org relationship canvas
// rendered INLINE in a /chat answer (the thread's first non-table tool UI).
// Thin wrapper: sized flex box (React Flow needs a concrete height) around
// the shared OrgMap canvas, dynamically imported so @xyflow/react stays out
// of the chat bundle until a map is actually answered. The expand arrow
// works here too (portals to the app panel), and "+N more" doors to the org
// page — the full workspace is one click away via the footer link as well.

const OrgMap = dynamic(() => import("@/components/orgs/org-map").then((m) => m.OrgMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Spinner size={20} className="text-text-muted" />
    </div>
  ),
});

export function RelationshipMap({ graph }: { graph: OrgGraph }) {
  return (
    <div className="my-3">
      <div className="flex h-[420px] flex-col">
        <OrgMap tin={graph.tin} graph={graph} />
      </div>
      <p className="mt-1.5 text-[12px] text-text-muted">
        {graph.clinicians.toLocaleString("en-US")} clinicians ·{" "}
        <TextLink href={`/orgs/${encodeURIComponent(graph.tin)}`}>Open the full organization workspace</TextLink>
      </p>
    </div>
  );
}
