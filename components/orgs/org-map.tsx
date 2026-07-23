"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  Panel,
  Position,
  ReactFlow,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Banner } from "@/components/ui/banner";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { MAIN_PANEL_ID } from "@/components/shell/main-panel";
import { InsurerMark } from "@/components/rates/insurer-mark";
import { cptLabel } from "@/components/rates/cpt";
import { normalizeOrgName, providerDisplayName, titleCase } from "@/lib/format";
// From lib/org-graph (no db import), never lib/repos — a VALUE import from a
// repo pulls lib/db into this bundle and the Neon proxy throws in the browser.
import { type OrgGraph, type OrgGraphEdge, type OrgGraphRate } from "@/lib/org-graph";

// The org relationship map — one organization's relationships as a
// deterministic three-column graph: member providers | the org | insurers.
// No physics, no force layout: fixed columns, edges flowing left → right.
// The code switcher is the core interaction — it relabels every edge with
// that code's published rate (a fact when the payer publishes exactly one,
// else the COUNT of distinct rates) and reweighs fact edges.
//
// Two mounts, both via next/dynamic (@xyflow/react is imported ONLY by the
// canvas files — this one plus components/maps/* — all code-split, so the
// graph library stays out of every other bundle):
//   * the /orgs Map tab (org-panels) — onShowRoster flips to the Roster view;
//   * inline in a /chat answer (components/directory/relationship-map.tsx,
//     the relationship_map tool's generative UI) — no roster view there, so
//     the "+N more" supernode doors to the org page instead.
//
// Doors out: provider node → the provider's directory profile; payer node or
// edge → /published-rates deep-linked to that insurer + this org's row.

const TEAL = "#3F8290";

// Column geometry (graph coordinates — fitView scales the whole thing).
// These are STARTING positions: nodes are draggable, so the layout is the
// deterministic default, not a cage.
const COL_X = { provider: 0, org: 380, payer: 920 } as const;
const NODE_W = { provider: 240, org: 280, payer: 280 } as const;
const ROW_H = { provider: 64, payer: 88 } as const;

// Card caps: the repo orders payers by clinician reach (npis DESC) and
// providers alphabetically, so slicing keeps the biggest books / first names.
// Dropped nodes stay in the data (the org card still states true counts) but
// don't render; dropped providers fold into the "+N more" supernode.
const PAYER_NODE_LIMIT = 8;
const PROVIDER_NODE_LIMIT = 8;

type ProviderData = { label: string; profession: string | null; href: string };
type MoreData = { label: string; onShowRoster?: () => void; href?: string };
type OrgData = { label: string; clinicians: number; payers: number };
type PayerData = { label: string; clinicians: number; href: string };
type RateEdgeData = { amount?: string; suffix?: string; href: string; title?: string; animated?: boolean };

// SMIL has no prefers-reduced-motion hook — gate the traveling dot in JS.
const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Split a rate into chip parts. One published rate → the dollar fact; several
 *  → the count ("78 rates") — never a median or band (ruling 2026-07-23). */
export function rateParts(rate: OrgGraphRate | undefined): { amount?: string; suffix?: string } {
  if (!rate) return {};
  if (rate.kind === "published") return { amount: `$${rate.amount.toFixed(2)}` };
  return { suffix: `${rate.nRates.toLocaleString("en-US")} rates` };
}

function rateAmount(rate: OrgGraphRate | undefined): number | null {
  return rate?.kind === "published" ? rate.amount : null;
}

// ── Node skins (design-system cards; handles are invisible anchor points) ────

const anchor = "!h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent";

function ProviderNode(props: NodeProps) {
  const d = props.data as unknown as ProviderData;
  return (
    <div
      className="cursor-pointer rounded-field border border-border bg-surface px-3 py-2 shadow-card transition-colors hover:border-primary"
      style={{ width: NODE_W.provider }}
      title={providerDisplayName(d.label)}
    >
      <p className="truncate text-[13px] font-medium text-text">{providerDisplayName(d.label)}</p>
      <p className="truncate text-[11.5px] text-text-muted">{d.profession ? titleCase(d.profession) : "Clinician"}</p>
      <Handle type="source" position={Position.Right} className={anchor} />
    </div>
  );
}

function MoreNode(props: NodeProps) {
  const d = props.data as unknown as MoreData;
  return (
    <div
      className="cursor-pointer rounded-field border border-dashed border-field-border bg-canvas px-3 py-2 text-center transition-colors hover:border-primary hover:text-primary"
      style={{ width: NODE_W.provider }}
      title={d.onShowRoster ? "Open the full roster" : "Open the organization"}
    >
      <p className="text-[13px] font-medium text-text-body">{d.label}</p>
      <Handle type="source" position={Position.Right} className={anchor} />
    </div>
  );
}

function OrgNode(props: NodeProps) {
  const d = props.data as unknown as OrgData;
  return (
    <div className="rounded-card bg-[#1C2440] px-4 py-3 text-white shadow-card" style={{ width: NODE_W.org }}>
      <p className="text-[14px] font-semibold leading-snug">{normalizeOrgName(d.label)}</p>
      <p className="mt-0.5 text-[12px] text-white/70">
        {d.clinicians.toLocaleString("en-US")} {d.clinicians === 1 ? "clinician" : "clinicians"} ·{" "}
        {d.payers.toLocaleString("en-US")} {d.payers === 1 ? "payer" : "payers"}
      </p>
      <Handle type="target" position={Position.Left} className={anchor} />
      <Handle type="source" position={Position.Right} className={anchor} />
    </div>
  );
}

function PayerNode(props: NodeProps) {
  const d = props.data as unknown as PayerData;
  // Same footprint as the org card (width, padding, type scale) — the two ends
  // of a rates edge carry equal visual weight.
  return (
    <div
      className="cursor-pointer rounded-card border border-border bg-surface px-4 py-3 shadow-card transition-colors hover:border-primary"
      style={{ width: NODE_W.payer }}
      title={`${d.label} — open in Published rates`}
    >
      <span className="flex items-center gap-2.5">
        <InsurerMark payer={d.label} />
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold leading-snug text-text">{d.label}</span>
          <span className="mt-0.5 block text-[12px] text-text-muted">
            {d.clinicians.toLocaleString("en-US")} {d.clinicians === 1 ? "clinician" : "clinicians"} in plan
          </span>
        </span>
      </span>
      <Handle type="target" position={Position.Left} className={anchor} />
    </div>
  );
}

const nodeTypes: NodeTypes = { provider: ProviderNode, more: MoreNode, org: OrgNode, payer: PayerNode };

// The rates edge: a BaseEdge stroke plus an HTML label chip (EdgeLabelRenderer
// escapes SVG, so the label can be a real design-system pill instead of the
// library's flat text-on-rect). The chip tracks the bezier midpoint, so it
// follows when either end is dragged; clicking it (or the edge) opens the
// payer's filtered /published-rates view.
export function RateEdge(props: EdgeProps) {
  const router = useRouter();
  const [path, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });
  const d = props.data as unknown as RateEdgeData;
  return (
    <>
      <BaseEdge id={props.id} path={path} style={props.style} />
      {/* Money-flow dot, hover-scoped (ruling: selective, with restraint).
          The bezier is drawn org→payer but the payer PAYS the org, so the
          motion runs the path in reverse (keyPoints 1→0). */}
      {d.animated && !reducedMotion() && (
        <circle r="4" fill={TEAL}>
          <animateMotion dur="1.6s" repeatCount="indefinite" path={path} keyPoints="1;0" keyTimes="0;1" />
        </circle>
      )}
      {(d.amount || d.suffix) && (
        <EdgeLabelRenderer>
          <button
            // Keyed on the displayed value: a code switch that changes the
            // dollars remounts the chip and restarts the border pulse; a code
            // switch that lands on the same figure stays quiet.
            key={`${d.amount ?? ""}|${d.suffix ?? ""}`}
            type="button"
            onClick={() => router.push(d.href)}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all" }}
            className="edge-chip-pulse nodrag nopan absolute inline-flex cursor-pointer items-baseline gap-1 whitespace-nowrap rounded-full border border-border bg-surface px-2.5 py-1 shadow-card transition-colors hover:border-primary"
            title={d.title ?? "Open in Published rates"}
          >
            {d.amount && <span className="text-[12px] font-semibold tabular-nums text-text">{d.amount}</span>}
            {d.suffix && <span className="text-[11px] text-text-muted">{d.suffix}</span>}
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const edgeTypes: EdgeTypes = { rate: RateEdge };

// Kit has no diagonal expand/collapse glyphs — inline lucide paths, page-local
// (the /chat thumbs precedent). Up-left = grow into the corner the button sits
// in; down-right = shrink back toward the tab layout.
const ARROW_UP_LEFT = (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17V7h10" />
    <path d="M17 17 7 7" />
  </svg>
);
const ARROW_DOWN_RIGHT = (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m7 7 10 10" />
    <path d="M17 7v10H7" />
  </svg>
);

// The in-canvas billing-code switcher — the shell ContextSwitcher pill pattern
// (current value + stacked ⇅, own anchored "Find…" menu) over exactly the
// codes THIS org has rates for (graph.codes — can be all 20, never a fixed
// five). Replaces the five-chip rail (ruling 2026-07-23).
export function CodeSwitcher({
  codes,
  code,
  onChange,
}: {
  codes: string[];
  code: string;
  onChange: (c: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      // globalThis.Node: the bare name is shadowed by @xyflow/react's Node type.
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? codes.filter((c) => c.includes(needle) || cptLabel(c).toLowerCase().includes(needle))
    : codes;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${cptLabel(code)} — switch billing code`}
        className={`flex h-9 items-center gap-1.5 rounded-field border border-border bg-surface pl-3 pr-2 text-[14px] shadow-card transition-colors ${
          open ? "text-primary" : "text-text-body hover:text-primary"
        }`}
      >
        <span className="max-w-[200px] truncate font-medium">{cptLabel(code)}</span>
        <span className="ml-0.5 flex shrink-0 flex-col text-text-muted" aria-hidden>
          <Icon name="chevron-up" size={12} className="-mb-[3px]" />
          <Icon name="chevron-down" size={12} className="-mt-[3px]" />
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-card border border-border bg-surface shadow-menu"
        >
          <div className="border-b border-border p-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find…"
              aria-label="Find a billing code"
              className="w-full rounded-field bg-canvas px-2.5 py-1.5 text-[14px] text-text outline-none transition-shadow placeholder:text-text-muted focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="max-h-72 overflow-y-auto p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {shown.length === 0 ? (
              <p className="px-2.5 py-3 text-sm text-text-muted">No matches.</p>
            ) : (
              shown.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="menuitemradio"
                  aria-checked={c === code}
                  onClick={() => {
                    onChange(c);
                    setOpen(false);
                    setQ("");
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-field px-2.5 py-2 text-left text-[14px] transition-colors ${
                    c === code
                      ? "bg-[rgba(0,0,0,0.05)] text-text"
                      : "text-text-body hover:bg-[rgba(0,0,0,0.05)] hover:text-text"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{cptLabel(c)}</span>
                  <span className="text-[13px] tabular-nums text-text-muted">{c}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── The map ──────────────────────────────────────────────────────────────────

export function OrgMap({
  tin,
  graph: initialGraph,
  onShowRoster,
}: {
  tin: string;
  graph: OrgGraph;
  /** Omitted (the /chat mount): "+N more" doors to the org page instead. */
  onShowRoster?: () => void;
}) {
  const router = useRouter();
  // Default to the 60-min psychotherapy workhorse when the org has it.
  const [code, setCode] = useState<string>(() =>
    initialGraph.codes.includes("90837") ? "90837" : initialGraph.codes[0] ?? "90837",
  );

  // Provider-column ranking. 'breadth' (default) is code-stable and came with
  // the page; 'rate' reranks by the selected code's highest published rate,
  // which needs a per-code server round-trip (the LIMIT happens in SQL over
  // the full roster) — fetched lazily, cached per code.
  const [rank, setRank] = useState<"breadth" | "rate">("breadth");
  const [graph, setGraph] = useState(initialGraph);
  const [rankLoading, setRankLoading] = useState(false);
  const graphCache = useRef(new Map<string, OrgGraph>([["breadth", initialGraph]]));
  useEffect(() => {
    const cacheKey = rank === "breadth" ? "breadth" : `rate:${code}`;
    const hit = graphCache.current.get(cacheKey);
    if (hit) {
      setGraph(hit);
      return;
    }
    let stale = false;
    setRankLoading(true);
    fetch(`/api/orgs/graph?tin=${encodeURIComponent(tin)}&rank=rate&code=${encodeURIComponent(code)}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((g: OrgGraph) => {
        if (stale) return;
        graphCache.current.set(cacheKey, g);
        setGraph(g);
      })
      .catch(() => {
        if (!stale) setRank("breadth");
      })
      .finally(() => {
        if (!stale) setRankLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [rank, code, tin]);

  // Full-container mode: the canvas portals into the floating white panel and
  // fills it (absolute inset-0 over header, tabs, rail — everything). Escape
  // collapses. Toggling remounts ReactFlow, so fitView re-frames — desirable,
  // since the aspect ratio just changed.
  const [expanded, setExpanded] = useState(false);

  // Money-flow focus: hovering a payer card animates ITS edge; hovering the
  // org card animates every inflow. Nothing moves unhovered.
  const [flowFocus, setFlowFocus] = useState<string | null>(null);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);

  const payerCount = graph.nodes.filter((n) => n.kind === "payer").length;

  const { nodes, edges } = useMemo(() => {
    // Cap named providers; anyone dropped joins the "+N more" supernode's count
    // (synthesized here if the repo didn't send one).
    const named = graph.nodes.filter((n) => n.kind === "provider").slice(0, PROVIDER_NODE_LIMIT);
    const repoMore = graph.nodes.find((n) => n.kind === "providersMore");
    const moreCount =
      (repoMore?.kind === "providersMore" ? repoMore.count : 0) +
      (graph.nodes.filter((n) => n.kind === "provider").length - named.length);
    const providers: typeof graph.nodes =
      moreCount > 0
        ? [
            ...named,
            {
              id: "providers-more",
              kind: "providersMore",
              label: `+${moreCount.toLocaleString("en-US")} more`,
              count: moreCount,
            },
          ]
        : named;
    const allPayers = graph.nodes.filter((n) => n.kind === "payer");
    const payers = allPayers.slice(0, PAYER_NODE_LIMIT);
    const height = Math.max(providers.length * ROW_H.provider, payers.length * ROW_H.payer, 200);

    const nodes: Node[] = [];
    const pOffset = (height - providers.length * ROW_H.provider) / 2;
    providers.forEach((n, i) => {
      nodes.push({
        id: n.id,
        type: n.kind === "provider" ? "provider" : "more",
        position: { x: COL_X.provider, y: pOffset + i * ROW_H.provider },
        data:
          n.kind === "provider"
            ? ({ label: n.label, profession: n.profession, href: n.href } satisfies ProviderData)
            : ({
                label: n.label,
                ...(onShowRoster ? { onShowRoster } : { href: `/orgs/${encodeURIComponent(graph.tin)}` }),
              } satisfies MoreData),
      });
    });
    const org = graph.nodes.find((n) => n.kind === "org");
    if (org && org.kind === "org") {
      nodes.push({
        id: org.id,
        type: "org",
        position: { x: COL_X.org, y: height / 2 - 40 },
        data: { label: org.label, clinicians: org.clinicians, payers: allPayers.length } satisfies OrgData,
      });
    }
    const yOffset = (height - payers.length * ROW_H.payer) / 2;
    payers.forEach((n, i) => {
      if (n.kind !== "payer") return;
      nodes.push({
        id: n.id,
        type: "payer",
        position: { x: COL_X.payer, y: yOffset + i * ROW_H.payer },
        data: { label: n.label, clinicians: n.clinicians, href: n.href } satisfies PayerData,
      });
    });

    // Member edges are rebuilt from the rendered provider list (capping may
    // have dropped or synthesized nodes); rate edges keep only rendered payers.
    const payerIds = new Set(payers.map((n) => n.id));
    const rateEdges = graph.edges.filter(
      (e): e is Extract<OrgGraphEdge, { kind: "rates" }> => e.kind === "rates" && payerIds.has(e.target),
    );

    // Thickness ∝ the selected code's dollars, relative to the on-screen max.
    const amounts = rateEdges.map((e) => rateAmount(e.rates[code])).filter((v): v is number => v != null);
    const maxAmount = amounts.length ? Math.max(...amounts) : 0;

    // Each named provider's own rates ride the member edges (repo attaches
    // them); the chip shows the selected code's figure, door → their profile.
    const memberRateByProvider = new Map(
      graph.edges
        .filter((e): e is Extract<OrgGraphEdge, { kind: "member" }> => e.kind === "member")
        .map((e) => [e.source, e.rates]),
    );

    const edges: Edge[] = [
      ...providers.map((n) => {
        const rate = memberRateByProvider.get(n.id)?.[code];
        const base = { id: `m:${n.id}`, source: n.id, target: "org" };
        if (!rate || n.kind !== "provider") {
          return { ...base, style: { stroke: TEAL, strokeOpacity: 0.3, strokeWidth: 1 }, interactionWidth: 0 };
        }
        return {
          ...base,
          type: "rate",
          data: { ...rateParts(rate), href: n.href, title: "Open provider profile" } satisfies RateEdgeData,
          style: { stroke: TEAL, strokeOpacity: 0.5, strokeWidth: 1.25 },
        };
      }),
      ...rateEdges.map((e) => {
        const rate = e.rates[code];
        const amount = rateAmount(rate);
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: "rate",
          data: {
            ...rateParts(rate),
            href: e.href,
            animated: flowFocus === "org" || flowFocus === e.target,
          } satisfies RateEdgeData,
          style: {
            stroke: TEAL,
            strokeOpacity: amount != null ? 0.85 : 0.35,
            strokeWidth: amount != null && maxAmount > 0 ? 1.5 + 4.5 * (amount / maxAmount) : 1.25,
          },
        };
      }),
    ];

    return { nodes, edges };
  }, [graph, code, onShowRoster, flowFocus]);

  if (payerCount === 0) {
    return (
      <Banner variant="info">
        No insurance plans reference this organization — there are no relationships to map.
      </Banner>
    );
  }

  const canvas = (
    // Canvas ground: "dark white" (#FAFAFA) with a neutral gray dot grid —
    // matches the React Flow playground look, not the app's white surface.
    // Expanded, it drops the card frame and fills the panel it portals into.
    <div
      className={
        expanded
          ? "absolute inset-0 z-40 bg-[#FAFAFA]"
          : "min-h-0 flex-1 overflow-hidden rounded-card border border-border bg-[#FAFAFA]"
      }
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesConnectable={false}
        onNodeMouseEnter={(_, node) => {
          if (node.type === "payer" || node.type === "org") setFlowFocus(node.id);
        }}
        onNodeMouseLeave={() => setFlowFocus(null)}
        onNodeClick={(_, node) => {
          const d = node.data as { href?: string; onShowRoster?: () => void };
          if (d.onShowRoster) d.onShowRoster();
          else if (d.href) router.push(d.href);
        }}
        onEdgeClick={(_, edge) => {
          const href = (edge.data as { href?: string } | undefined)?.href;
          if (href) router.push(href);
        }}
      >
        {/* Full-container toggle in the corner it grows toward, then the
            provider-column ranking switch. */}
        <Panel position="top-left" className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? "Exit full-container view" : "Expand map to fill the page"}
            title={expanded ? "Collapse" : "Expand"}
            className="flex h-9 w-9 items-center justify-center rounded-field border border-border bg-surface text-text-body shadow-card transition-colors hover:border-primary hover:text-primary"
          >
            {expanded ? ARROW_DOWN_RIGHT : ARROW_UP_LEFT}
          </button>
          <div className="flex h-9 items-center overflow-hidden rounded-field border border-border bg-surface shadow-card">
            <button
              type="button"
              onClick={() => setRank("breadth")}
              aria-pressed={rank === "breadth"}
              title="Providers appearing in the most insurance plans"
              className={`h-full px-3 text-[13px] font-medium transition-colors ${
                rank === "breadth" ? "bg-[rgba(0,0,0,0.05)] text-text" : "text-text-body hover:text-primary"
              }`}
            >
              Most plans
            </button>
            <div className="h-5 w-px bg-border" aria-hidden />
            <button
              type="button"
              onClick={() => setRank("rate")}
              aria-pressed={rank === "rate"}
              title="Highest published rate for the selected code — reranks when the code changes"
              className={`h-full px-3 text-[13px] font-medium transition-colors ${
                rank === "rate" ? "bg-[rgba(0,0,0,0.05)] text-text" : "text-text-body hover:text-primary"
              }`}
            >
              Top paid
            </button>
          </div>
          {rankLoading && <Spinner size={16} className="text-text-muted" />}
        </Panel>
        {/* The billing-code switcher — flipping codes relabels and reweighs
            every edge. */}
        {graph.codes.length > 0 && (
          <Panel position="top-right">
            <CodeSwitcher codes={graph.codes} code={code} onChange={setCode} />
          </Panel>
        )}
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.25} color="#D4D4D4" bgColor="#FAFAFA" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
    </div>
  );

  if (expanded) {
    const host = typeof document === "undefined" ? null : document.getElementById(MAIN_PANEL_ID);
    if (host) return createPortal(canvas, host);
  }
  return canvas;
}
