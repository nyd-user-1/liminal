// The org relationship-graph SHAPE — types and nothing else.
// No db import: client components (org-map.tsx) import from here, and a
// value import from lib/repos/* would pull lib/db into the browser bundle
// (same split as lib/rate-table.ts ↔ lib/repos/rate-table.ts). The repo fn
// that fills this shape lives in lib/repos/org-graph.ts.
//
// Codes are DYNAMIC (2026-07-23): `codes` lists every billing code the org
// actually has rate rows for (ascending CPT order) — the canvas's switcher
// offers exactly these, never a fixed five. Rate maps are keyed by those
// code strings.

export type OrgGraphRate =
  /** Exactly ONE distinct published rate for this key — a quotable fact. */
  | { kind: "published"; amount: number }
  /** Several distinct published dollar values. No median, no band — the chip
      states the count ("78 rates"): the multiplicity IS the finding. */
  | { kind: "multiple"; nRates: number };

export type OrgGraphNode =
  | { id: "org"; kind: "org"; label: string; tin: string; clinicians: number }
  | { id: string; kind: "provider"; label: string; npi: string; profession: string | null; href: string }
  | { id: "providers-more"; kind: "providersMore"; label: string; count: number }
  | { id: string; kind: "payer"; label: string; payer: string; clinicians: number; href: string };

export type OrgGraphEdge =
  | {
      id: string;
      source: string;
      target: "org";
      kind: "member";
      /** The provider's OWN published rates under this TIN, when any exist. */
      rates?: Record<string, OrgGraphRate>;
    }
  | {
      id: string;
      source: "org";
      target: string;
      kind: "rates";
      payer: string;
      rates: Record<string, OrgGraphRate>;
      asOf: string | null; // payer file_date — render as "as-of {date}"
      href: string;
    };

export type OrgGraph = {
  tin: string;
  label: string;
  clinicians: number;
  /** Billing codes this org has rate rows for, ascending — the switcher list. */
  codes: string[];
  nodes: OrgGraphNode[];
  edges: OrgGraphEdge[];
};
