// The org relationship-graph SHAPE — types + the code list, and nothing else.
// No db import: client components (org-map.tsx) import VALUES from here, and a
// value import from lib/repos/* would pull lib/db into the browser bundle
// (same split as lib/rate-table.ts ↔ lib/repos/rate-table.ts). The repo fn
// that fills this shape lives in lib/repos/org-graph.ts.

export const ORG_GRAPH_CODES = ["90791", "90834", "90837", "90853", "99214"] as const;
export type OrgGraphCode = (typeof ORG_GRAPH_CODES)[number];

export type OrgGraphRate =
  /** The payer's one published rate for this billing TIN + code. */
  | { kind: "published"; amount: number }
  /** Median of what the payer pays this org's clinicians (several rates). */
  | { kind: "median"; amount: number; npis: number }
  /** The payer publishes several rates and we have no dollar summary. */
  | { kind: "multiple"; nRates: number };

export type OrgGraphNode =
  | { id: "org"; kind: "org"; label: string; tin: string; clinicians: number }
  | { id: string; kind: "provider"; label: string; npi: string; profession: string | null; href: string }
  | { id: "providers-more"; kind: "providersMore"; label: string; count: number }
  | { id: string; kind: "payer"; label: string; payer: string; clinicians: number; href: string };

export type OrgGraphEdge =
  | { id: string; source: string; target: "org"; kind: "member" }
  | {
      id: string;
      source: "org";
      target: string;
      kind: "rates";
      payer: string;
      rates: Partial<Record<OrgGraphCode, OrgGraphRate>>;
      asOf: string | null; // payer file_date — render as "as-of {date}"
      href: string;
    };

export type OrgGraph = {
  tin: string;
  label: string;
  clinicians: number;
  nodes: OrgGraphNode[];
  edges: OrgGraphEdge[];
};
