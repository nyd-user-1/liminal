// The /maps canvas SHAPE — types only, db-free (client components import from
// here; the repo that persists/hydrates lives in lib/repos/canvas.ts — same
// split as lib/org-graph.ts ↔ lib/repos/org-graph.ts).
//
// A saved map stores ONLY structure: which entities sit where. Edges are
// never persisted — they are re-derived from the rate corpus on every load
// (the corpus is the truth about who pays whom; a stale drawn edge would be
// a lie). Reference data only, no PHI.

import type { OrgGraphRate } from "@/lib/org-graph";

export type CanvasNodeKind = "org" | "payer" | "provider";

export type CanvasDocNode = {
  /** Canvas-local id (stable within the doc). */
  id: string;
  kind: CanvasNodeKind;
  /** Bound entity — org TIN ('ein:…'), payer name, or provider NPI. Null while
      the node is a fresh placeholder awaiting a pick. */
  ref: string | null;
  label: string;
  /** Second line: profession, clinician count — display only. */
  sub?: string | null;
  x: number;
  y: number;
};

export type CanvasDoc = {
  nodes: CanvasDocNode[];
  /** The billing code the edge chips were last showing. */
  code: string;
};

export type CanvasMapMeta = { id: string; name: string; updatedAt: string };

export const CANVAS_MAX_NODES = 80;

/** Structural check for a client-submitted doc (API layer runs this before
 *  any write; route modules can't export helpers, so it lives here). */
export function validCanvasDoc(doc: unknown): doc is CanvasDoc {
  if (!doc || typeof doc !== "object") return false;
  const d = doc as CanvasDoc;
  return (
    Array.isArray(d.nodes) &&
    d.nodes.length <= CANVAS_MAX_NODES &&
    typeof d.code === "string" &&
    d.nodes.every(
      (n) =>
        n &&
        typeof n.id === "string" &&
        (n.kind === "org" || n.kind === "payer" || n.kind === "provider") &&
        (n.ref === null || typeof n.ref === "string") &&
        typeof n.label === "string" &&
        typeof n.x === "number" &&
        typeof n.y === "number",
    )
  );
}

/** What the corpus says about the bound entities on a canvas — recomputed
 *  server-side from the rollups, never stored. */
export type CanvasEdges = {
  orgPayer: Array<{ tin: string; payer: string; rates: Record<string, OrgGraphRate>; href: string }>;
  providerOrg: Array<{ npi: string; tin: string }>;
  providerPayer: Array<{ npi: string; payer: string; rates: Record<string, OrgGraphRate> }>;
};
