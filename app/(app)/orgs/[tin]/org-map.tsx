"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Banner } from "@/components/ui/banner";
import { InsurerMark } from "@/components/rates/insurer-mark";
import { cptLabel } from "@/components/rates/cpt";
import { titleCase } from "@/lib/format";
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
const COL_X = { provider: 0, org: 380, payer: 760 } as const;
const NODE_W = { provider: 240, org: 280, payer: 300 } as const;
const ROW_H = { provider: 64, payer: 72 } as const;

type ProviderData = { label: string; profession: string | null; href: string };
type MoreData = { label: string; onShowRoster: () => void };
type OrgData = { label: string; clinicians: number; payers: number };
type PayerData = { label: string; clinicians: number; href: string };

function rateLabel(rate: OrgGraphRate | undefined): string | undefined {
  if (!rate) return undefined;
  if (rate.kind === "published") return `$${rate.amount.toFixed(2)}`;
  if (rate.kind === "median") return `$${rate.amount.toFixed(2)} median`;
  return `${rate.nRates} rates`;
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
      title={titleCase(d.label)}
    >
      <p className="truncate text-[13px] font-medium text-text">{titleCase(d.label)}</p>
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
      <p className="text-[14px] font-semibold leading-snug">{d.label}</p>
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
  return (
    <div
      className="cursor-pointer rounded-field border border-border bg-surface px-3 py-2 shadow-card transition-colors hover:border-primary"
      style={{ width: NODE_W.payer }}
      title={`${d.label} — open in Published rates`}
    >
      <span className="flex items-center gap-2">
        <InsurerMark payer={d.label} />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-text">{d.label}</span>
          <span className="block text-[11.5px] text-text-muted">
            {d.clinicians.toLocaleString("en-US")} {d.clinicians === 1 ? "clinician" : "clinicians"} in book
          </span>
        </span>
      </span>
      <Handle type="target" position={Position.Left} className={anchor} />
    </div>
  );
}

const nodeTypes: NodeTypes = { provider: ProviderNode, more: MoreNode, org: OrgNode, payer: PayerNode };

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
        label: rateLabel(rate),
        data: { href: e.href },
        style: {
          stroke: TEAL,
          strokeOpacity: amount != null ? 0.85 : 0.35,
          strokeWidth: amount != null && maxAmount > 0 ? 1.5 + 4.5 * (amount / maxAmount) : 1.25,
        },
        labelStyle: { fontSize: 11, fill: "#1C2440", fontWeight: 500 },
        labelBgStyle: { fill: "#ffffff", fillOpacity: 0.95 },
        labelBgPadding: [5, 3] as [number, number],
        labelBgBorderRadius: 5,
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
    <>
      {/* The CPT chip row — flipping codes relabels and reweighs every edge. */}
      <div className="mb-3 flex shrink-0 items-center gap-1.5">
        {ORG_GRAPH_CODES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCode(c)}
            title={cptLabel(c)}
            className={`inline-flex h-8 items-center rounded-full border px-3 text-[13px] font-medium tabular-nums transition-colors ${
              code === c
                ? "border-primary bg-primary-wash text-primary"
                : "border-field-border text-text-body hover:border-field-border-focus"
            }`}
          >
            {c}
          </button>
        ))}
        <span className="ml-auto hidden truncate text-[12.5px] text-text-muted sm:block">{cptLabel(code)}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-card border border-border">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
          minZoom={0.3}
          maxZoom={1.5}
          nodesDraggable={false}
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
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.25} color="#dcdfe6" />
          <Controls showInteractive={false} position="bottom-right" />
        </ReactFlow>
      </div>
    </>
  );
}
