"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { SearchInput } from "@/components/ui/search-input";
import type { SchemaGraph } from "@/lib/repos/schema-map";

// The Data dictionary's Schema map — the live database drawn as a canvas.
// Table/matview nodes with column rows (the database-schema-node pattern:
// one handle per column, so FK edges land column-to-column), grouped into
// vertical bands by the dictionary's curated groups. Two edge kinds:
//   * FK (gray, solid, arrowed) — a formal foreign key;
//   * feeds (teal, dashed) — matview lineage from pg_depend: the rollup
//     really is built from that source. In this schema lineage is the story.
// Node-search top-right: type a table or column, fly to it.
//
// Third @xyflow/react importer (with org-map and builder-canvas) — all three
// code-split behind next/dynamic.

const TEAL = "#3F8290";
const NODE_W = 300;
const ROW_H = 21;
const HEADER_H = 40;
const COL_CAP = 8;
const BAND_W = 380;
const BAND_GAP_Y = 28;

export type SchemaTableMeta = { group: string; count: number | null; meaning: string };

type SchemaNodeData = {
  name: string;
  kind: "table" | "matview";
  count: number | null;
  meaning: string;
  rows: Array<{ name: string; type: string; pk: boolean }>;
  moreCount: number;
};

const anchor = "!h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent";

function SchemaNode(props: NodeProps) {
  const d = props.data as unknown as SchemaNodeData;
  return (
    <div
      className="overflow-hidden rounded-field border border-border bg-surface shadow-card"
      style={{ width: NODE_W }}
      title={d.meaning || d.name}
    >
      <div
        className={`relative flex items-center gap-2 border-b border-border px-3 ${
          d.kind === "matview" ? "bg-primary-wash" : "bg-canvas/60"
        }`}
        style={{ height: HEADER_H }}
      >
        <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] font-semibold text-text">{d.name}</span>
        {d.kind === "matview" && (
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
            mv
          </span>
        )}
        {d.count != null && (
          <span className="text-[11px] tabular-nums text-text-muted">{d.count.toLocaleString("en-US")}</span>
        )}
        <Handle type="target" position={Position.Left} id="t" className={anchor} />
        <Handle type="source" position={Position.Right} id="t" className={anchor} />
      </div>
      <div className="py-1">
        {d.rows.map((c) => (
          <div key={c.name} className="relative flex items-center gap-2 px-3" style={{ height: ROW_H }}>
            <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-text-body">{c.name}</span>
            {c.pk && (
              <span className="rounded bg-canvas px-1 text-[9.5px] font-semibold uppercase text-text-muted">pk</span>
            )}
            <span className="max-w-[40%] truncate text-[10.5px] text-text-muted">{c.type}</span>
            <Handle type="target" position={Position.Left} id={`c:${c.name}`} className={anchor} />
            <Handle type="source" position={Position.Right} id={`c:${c.name}`} className={anchor} />
          </div>
        ))}
        {d.moreCount > 0 && (
          <div className="px-3 text-[10.5px] italic text-text-muted" style={{ height: ROW_H, lineHeight: `${ROW_H}px` }}>
            +{d.moreCount} more column{d.moreCount === 1 ? "" : "s"}
          </div>
        )}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = { schema: SchemaNode };

function nodeHeight(shownRows: number, hasMore: boolean): number {
  return HEADER_H + 8 + (shownRows + (hasMore ? 1 : 0)) * ROW_H;
}

function SchemaCanvasInner({ schema, meta }: { schema: SchemaGraph; meta: Record<string, SchemaTableMeta> }) {
  const { setCenter } = useReactFlow();

  const { nodes: layoutNodes, edges, heights } = useMemo(() => {
    // Columns that participate in an FK stay visible past the display cap —
    // their edges must land on a real row handle.
    const fkCols = new Map<string, Set<string>>();
    for (const fk of schema.fks) {
      (fkCols.get(fk.srcTable) ?? fkCols.set(fk.srcTable, new Set()).get(fk.srcTable)!).add(fk.srcColumn);
      (fkCols.get(fk.dstTable) ?? fkCols.set(fk.dstTable, new Set()).get(fk.dstTable)!).add(fk.dstColumn);
    }

    // Band per dictionary group, in first-seen order; unlisted tables → Other.
    const bandOrder: string[] = [];
    const bandOf = (table: string): string => {
      const g = meta[table]?.group ?? "Other";
      if (!bandOrder.includes(g)) bandOrder.push(g);
      return g;
    };
    const byBand = new Map<string, typeof schema.tables>();
    for (const t of [...schema.tables].sort((a, b) => a.name.localeCompare(b.name))) {
      const g = bandOf(t.name);
      const arr = byBand.get(g) ?? [];
      arr.push(t);
      byBand.set(g, arr);
    }

    const nodes: Node[] = [];
    const heights = new Map<string, number>();
    bandOrder.forEach((band, bi) => {
      let y = 0;
      for (const t of byBand.get(band) ?? []) {
        const keep = fkCols.get(t.name) ?? new Set<string>();
        const rows = t.columns.filter((c, i) => i < COL_CAP || c.pk || keep.has(c.name));
        const moreCount = t.columns.length - rows.length;
        const h = nodeHeight(rows.length, moreCount > 0);
        const x = bi * BAND_W;
        nodes.push({
          id: t.name,
          type: "schema",
          position: { x, y },
          data: {
            name: t.name,
            kind: t.kind,
            count: meta[t.name]?.count ?? null,
            meaning: meta[t.name]?.meaning ?? "",
            rows,
            moreCount,
          } satisfies SchemaNodeData,
        });
        heights.set(t.name, h);
        y += h + BAND_GAP_Y;
      }
    });

    const present = new Set(nodes.map((n) => n.id));
    const edges: Edge[] = [];
    for (const fk of schema.fks) {
      if (!present.has(fk.srcTable) || !present.has(fk.dstTable)) continue;
      edges.push({
        id: `fk:${fk.srcTable}.${fk.srcColumn}→${fk.dstTable}.${fk.dstColumn}`,
        source: fk.srcTable,
        sourceHandle: `c:${fk.srcColumn}`,
        target: fk.dstTable,
        targetHandle: `c:${fk.dstColumn}`,
        style: { stroke: "#b9bec9", strokeOpacity: 0.6, strokeWidth: 1 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "#b9bec9" },
        interactionWidth: 0,
      });
    }
    for (const l of schema.lineage) {
      if (!present.has(l.view) || !present.has(l.source)) continue;
      edges.push({
        id: `feed:${l.source}→${l.view}`,
        source: l.source,
        sourceHandle: "t",
        target: l.view,
        targetHandle: "t",
        style: { stroke: TEAL, strokeOpacity: 0.65, strokeWidth: 1.5, strokeDasharray: "6 4" },
        markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: TEAL },
        interactionWidth: 0,
      });
    }
    return { nodes, edges, heights };
  }, [schema, meta]);

  // Draggable views need onNodesChange in v12 or drags are silently dropped —
  // node state seeds from the layout and re-seeds if the schema changes.
  // Rearrangement is session-local; no deletion (deleteKeyCode null).
  const [nodes, setNodes] = useState(layoutNodes);
  useEffect(() => setNodes(layoutNodes), [layoutNodes]);
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((ns) => applyNodeChanges(changes, ns)),
    [],
  );

  // Node search: table-name (or column) match → fly the viewport to it.
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);
  const needle = q.trim().toLowerCase();
  const hits = useMemo(() => {
    if (!needle) return [];
    const out: Array<{ table: string; via?: string }> = [];
    for (const t of schema.tables) {
      if (t.name.toLowerCase().includes(needle)) out.push({ table: t.name });
      else {
        const col = t.columns.find((c) => c.name.toLowerCase().includes(needle));
        if (col) out.push({ table: t.name, via: col.name });
      }
      if (out.length >= 8) break;
    }
    return out;
  }, [needle, schema.tables]);
  const flyTo = (table: string) => {
    // Current position (the user may have dragged the card), layout height.
    const n = nodes.find((x) => x.id === table);
    if (n) {
      const h = heights.get(table) ?? 120;
      void setCenter(n.position.x + NODE_W / 2, n.position.y + h / 2, { zoom: 1, duration: 500 });
    }
    setQ("");
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      deleteKeyCode={null}
      fitView
      fitViewOptions={{ padding: 0.06 }}
      minZoom={0.05}
      maxZoom={1.5}
      nodesConnectable={false}
      onlyRenderVisibleElements
    >
      <Panel position="top-right">
        <div ref={searchRef} className="relative w-72">
          <SearchInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a table or column…"
            className="w-full shadow-card"
          />
          {hits.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-card border border-border bg-surface p-1.5 shadow-menu">
              {hits.map((h) => (
                <button
                  key={`${h.table}:${h.via ?? ""}`}
                  type="button"
                  onClick={() => flyTo(h.table)}
                  className="flex w-full items-center gap-2 rounded-field px-2.5 py-1.5 text-left transition-colors hover:bg-[rgba(0,0,0,0.05)]"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] font-medium text-text">{h.table}</span>
                  {h.via && <span className="truncate font-mono text-[11px] text-text-muted">.{h.via}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </Panel>
      <Panel position="bottom-right" className="flex items-center gap-3 rounded-field border border-border bg-surface px-3 py-1.5 text-[11.5px] text-text-muted shadow-card">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-6 border-t border-[#b9bec9]" /> foreign key
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-6 border-t-[1.5px] border-dashed border-primary" /> feeds (matview)
        </span>
      </Panel>
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.25} color="#D4D4D4" bgColor="#FAFAFA" />
      <Controls showInteractive={false} position="bottom-left" />
    </ReactFlow>
  );
}

export function SchemaCanvas(props: { schema: SchemaGraph; meta: Record<string, SchemaTableMeta> }) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-card border border-border bg-[#FAFAFA]">
      <ReactFlowProvider>
        <SchemaCanvasInner {...props} />
      </ReactFlowProvider>
    </div>
  );
}
