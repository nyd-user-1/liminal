"use client";

import { useMemo, useState } from "react";
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
import { InsurerMark } from "@/components/rates/insurer-mark";
import { cptLabel } from "@/components/rates/cpt";
import { normalizeOrgName, providerDisplayName, titleCase } from "@/lib/format";
// From lib/org-graph (no db import), never lib/repos — a VALUE import from a
// repo pulls lib/db into this bundle and the Neon proxy throws in the browser.
import { ORG_GRAPH_CODES, type OrgGraph, type OrgGraphCode, type OrgGraphRate } from "@/lib/org-graph";

// The /orgs Map tab — one organization's relationships as a deterministic
// three-column graph: member providers | the org | payers. No physics, no
// force layout: fixed columns, edges flowing left → right. The CPT chip row is
// the core interaction — it relabels every org→payer edge with that code's
// dollars and scales edge thickness by relative amount.
//
// Doors out: provider node → the provider's directory profile; payer node or
// edge → /published-rates deep-linked to that insurer + this org's row; the
// "+N more" supernode → this page's own Roster table.
//
// This file is the ONLY importer of @xyflow/react and is itself loaded via
// next/dynamic from org-panels — the graph library stays out of every other
// bundle. Data comes as pure {nodes, edges} from lib/repos/org-graph.ts (the
// /chat relationship_map tool will reuse that shape).

const TEAL = "#3F8290";

// Column geometry (graph coordinates — fitView scales the whole thing).
// These are STARTING positions: nodes are draggable, so the layout is the
// deterministic default, not a cage.
const COL_X = { provider: 0, org: 380, payer: 920 } as const;
const NODE_W = { provider: 240, org: 280, payer: 280 } as const;
const ROW_H = { provider: 64, payer: 88 } as const;

type ProviderData = { label: string; profession: string | null; href: string };
type MoreData = { label: string; onShowRoster: () => void };
type OrgData = { label: string; clinicians: number; payers: number };
type PayerData = { label: string; clinicians: number; href: string };
type RateEdgeData = { amount?: string; suffix?: string; href: string };

/** Split a rate into chip parts: the dollar figure and its qualifier. */
function rateParts(rate: OrgGraphRate | undefined): { amount?: string; suffix?: string } {
  if (!rate) return {};
  if (rate.kind === "published") return { amount: `$${rate.amount.toFixed(2)}` };
  if (rate.kind === "median") return { amount: `$${rate.amount.toFixed(2)}`, suffix: "median" };
  return { suffix: `${rate.nRates} rates` };
}

function rateAmount(rate: OrgGraphRate | undefined): number | null {
  return rate && rate.kind !== "multiple" ? rate.amount : null;
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
      title="Open the full roster"
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
            {d.clinicians.toLocaleString("en-US")} {d.clinicians === 1 ? "clinician" : "clinicians"} in book
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
function RateEdge(props: EdgeProps) {
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
      {(d.amount || d.suffix) && (
        <EdgeLabelRenderer>
          <button
            type="button"
            onClick={() => router.push(d.href)}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all" }}
            className="nodrag nopan absolute inline-flex cursor-pointer items-baseline gap-1 whitespace-nowrap rounded-full border border-border bg-surface px-2.5 py-1 shadow-card transition-colors hover:border-primary"
            title="Open in Published rates"
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

// ── The map ──────────────────────────────────────────────────────────────────

export function OrgMap({ graph, onShowRoster }: { graph: OrgGraph; onShowRoster: () => void }) {
  const router = useRouter();
  const [code, setCode] = useState<OrgGraphCode>("90837");

  const payerCount = graph.nodes.filter((n) => n.kind === "payer").length;

  const { nodes, edges } = useMemo(() => {
    const providers = graph.nodes.filter((n) => n.kind === "provider" || n.kind === "providersMore");
    const payers = graph.nodes.filter((n) => n.kind === "payer");
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
            : ({ label: n.label, onShowRoster } satisfies MoreData),
      });
    });
    const org = graph.nodes.find((n) => n.kind === "org");
    if (org && org.kind === "org") {
      nodes.push({
        id: org.id,
        type: "org",
        position: { x: COL_X.org, y: height / 2 - 40 },
        data: { label: org.label, clinicians: org.clinicians, payers: payers.length } satisfies OrgData,
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

    // Thickness ∝ the selected code's dollars, relative to the column max.
    const amounts = graph.edges
      .map((e) => (e.kind === "rates" ? rateAmount(e.rates[code]) : null))
      .filter((v): v is number => v != null);
    const maxAmount = amounts.length ? Math.max(...amounts) : 0;

    const edges: Edge[] = graph.edges.map((e) => {
      if (e.kind === "member") {
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          style: { stroke: TEAL, strokeOpacity: 0.3, strokeWidth: 1 },
          interactionWidth: 0,
        };
      }
      const rate = e.rates[code];
      const amount = rateAmount(rate);
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: "rate",
        data: { ...rateParts(rate), href: e.href } satisfies RateEdgeData,
        style: {
          stroke: TEAL,
          strokeOpacity: amount != null ? 0.85 : 0.35,
          strokeWidth: amount != null && maxAmount > 0 ? 1.5 + 4.5 * (amount / maxAmount) : 1.25,
        },
      };
    });

    return { nodes, edges };
  }, [graph, code, onShowRoster]);

  if (payerCount === 0) {
    return (
      <Banner variant="info">
        No payer books reference this organization — there are no relationships to map.
      </Banner>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-card border border-border">
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
        {/* The CPT chip rail, floating in the canvas corner — flipping codes
            relabels and reweighs every edge. */}
        <Panel position="top-left" className="flex items-center gap-1.5">
          {ORG_GRAPH_CODES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCode(c)}
              title={cptLabel(c)}
              className={`inline-flex h-8 items-center rounded-full border px-3 text-[13px] font-medium tabular-nums shadow-card transition-colors ${
                code === c
                  ? "border-primary bg-primary-wash text-primary"
                  : "border-border bg-surface text-text-body hover:border-field-border-focus"
              }`}
            >
              {c}
            </button>
          ))}
        </Panel>
        <Panel position="bottom-left" className="max-w-64">
          <span className="block truncate text-[13px] font-medium text-primary">{cptLabel(code)}</span>
        </Panel>
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.25} color="#dcdfe6" />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  );
}
