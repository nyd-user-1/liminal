"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyEdgeChanges,
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
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Icon } from "@/components/ui/icons";
import {
  SCHEMA_DRAFT_MAX_COLUMNS,
  SCHEMA_DRAFT_MAX_TABLES,
  type DraftColumn,
  type DraftEdge,
  type DraftEdgeKind,
  type DraftTable,
  type SchemaDraftDoc,
} from "@/lib/schema-draft";

// The Data dictionary's schema-DRAFT canvas: unlike the read-only schema map
// (components/maps/schema-canvas.tsx), this one is fiction the user is meant
// to invent — rename/add/drop tables and columns, draw FK or matview-"feeds"
// edges by hand. Nothing here ever touches the live database; a saved draft
// is read back later (by a person, or by an agent) to hand-write an actual
// migration. Fourth @xyflow/react importer, still code-split behind
// next/dynamic (components/maps/* is the allowed set).
//
// Node deletion never rides the keyboard — onNodesChange strips "remove"
// changes so a stray Backspace while renaming a column can't take the whole
// table with it; the trash icon is the only way to delete a table. Edge
// deletion is fine via keyboard (edges hold no text input, nothing to type
// into) and via clicking an edge then Delete/Backspace.

const TEAL = "#3F8290";
const NODE_W = 300;
const ROW_H = 28;
const HEADER_H = 42;

const anchor = "!h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent";

const FK_STYLE = { stroke: "#b9bec9", strokeOpacity: 0.6, strokeWidth: 1 };
const FEED_STYLE = { stroke: TEAL, strokeOpacity: 0.65, strokeWidth: 1.5, strokeDasharray: "6 4" };
const markerFor = (kind: DraftEdgeKind) => ({
  type: MarkerType.ArrowClosed,
  width: 14,
  height: 14,
  color: kind === "feeds" ? TEAL : "#b9bec9",
});

type DraftNodeActions = {
  onRename: (id: string, name: string) => void;
  onToggleKind: (id: string) => void;
  onDeleteTable: (id: string) => void;
  onColumnChange: (id: string, colId: string, patch: Partial<DraftColumn>) => void;
  onAddColumn: (id: string) => void;
  onRemoveColumn: (id: string, colId: string) => void;
};

type DraftNodeData = {
  name: string;
  kind: "table" | "matview";
  columns: DraftColumn[];
} & DraftNodeActions;

function DraftTableNode(props: NodeProps) {
  const d = props.data as unknown as DraftNodeData;
  return (
    <div className="overflow-hidden rounded-field border border-border bg-surface shadow-card" style={{ width: NODE_W }}>
      <div
        className={`relative flex items-center gap-1.5 border-b border-border px-2.5 ${
          d.kind === "matview" ? "bg-primary-wash" : "bg-canvas/60"
        }`}
        style={{ height: HEADER_H }}
      >
        <button
          type="button"
          onClick={() => d.onToggleKind(props.id)}
          title="Toggle table / materialized view"
          className="nodrag shrink-0 rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase text-text-muted transition-colors hover:bg-black/[0.1]"
        >
          {d.kind === "matview" ? "mv" : "tbl"}
        </button>
        <input
          value={d.name}
          onChange={(e) => d.onRename(props.id, e.target.value)}
          placeholder="table_name"
          aria-label="Table name"
          className="nodrag nopan min-w-0 flex-1 truncate bg-transparent font-mono text-[12.5px] font-semibold text-text outline-none placeholder:text-text-muted"
        />
        <button
          type="button"
          onClick={() => d.onDeleteTable(props.id)}
          aria-label="Delete table"
          className="nodrag flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-danger-tint hover:text-danger"
        >
          <Icon name="trash" size={13} />
        </button>
        <Handle type="target" position={Position.Left} id="t" className={anchor} />
        <Handle type="source" position={Position.Right} id="t" className={anchor} />
      </div>
      <div className="py-1">
        {d.columns.map((c) => (
          <div key={c.id} className="relative flex items-center gap-1.5 px-2.5" style={{ height: ROW_H }}>
            <input
              value={c.name}
              onChange={(e) => d.onColumnChange(props.id, c.id, { name: e.target.value })}
              placeholder="column"
              aria-label="Column name"
              className="nodrag nopan min-w-0 flex-1 truncate bg-transparent font-mono text-[11.5px] text-text-body outline-none placeholder:text-text-muted"
            />
            <input
              value={c.type}
              onChange={(e) => d.onColumnChange(props.id, c.id, { type: e.target.value })}
              placeholder="type"
              aria-label="Column type"
              className="nodrag nopan w-[64px] shrink-0 truncate bg-transparent text-right text-[10.5px] text-text-muted outline-none placeholder:text-text-muted/60"
            />
            <button
              type="button"
              onClick={() => d.onColumnChange(props.id, c.id, { pk: !c.pk })}
              title="Toggle primary key"
              className={`nodrag shrink-0 rounded px-1 text-[9.5px] font-semibold uppercase transition-colors ${
                c.pk ? "bg-primary/15 text-primary" : "bg-transparent text-text-muted/40 hover:bg-canvas"
              }`}
            >
              pk
            </button>
            <button
              type="button"
              onClick={() => d.onRemoveColumn(props.id, c.id)}
              aria-label="Remove column"
              className="nodrag flex h-5 w-5 shrink-0 items-center justify-center rounded text-text-muted/60 transition-colors hover:bg-danger-tint hover:text-danger"
            >
              <Icon name="x" size={11} />
            </button>
            <Handle type="target" position={Position.Left} id={`c:${c.id}`} className={anchor} />
            <Handle type="source" position={Position.Right} id={`c:${c.id}`} className={anchor} />
          </div>
        ))}
        <button
          type="button"
          onClick={() => d.onAddColumn(props.id)}
          disabled={d.columns.length >= SCHEMA_DRAFT_MAX_COLUMNS}
          className="nodrag flex w-full items-center gap-1.5 px-2.5 text-[10.5px] text-text-muted transition-colors hover:text-primary disabled:opacity-40"
          style={{ height: ROW_H }}
        >
          <Icon name="plus" size={11} /> Add column
        </button>
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = { draft: DraftTableNode };

// ── doc ↔ canvas ─────────────────────────────────────────────────────────────

function edgeFromDraft(e: DraftEdge): Edge {
  return {
    id: e.id,
    source: e.srcTable,
    sourceHandle: e.srcColumn ? `c:${e.srcColumn}` : "t",
    target: e.dstTable,
    targetHandle: e.dstColumn ? `c:${e.dstColumn}` : "t",
    style: e.kind === "feeds" ? FEED_STYLE : FK_STYLE,
    markerEnd: markerFor(e.kind),
    interactionWidth: 20,
    data: { kind: e.kind },
  };
}

function fromDraftDoc(doc: SchemaDraftDoc | null, actions: DraftNodeActions): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = (doc?.tables ?? []).map((t) => ({
    id: t.id,
    type: "draft",
    position: { x: t.x, y: t.y },
    data: { name: t.name, kind: t.kind, columns: t.columns, ...actions } satisfies DraftNodeData,
  }));
  const edges: Edge[] = (doc?.edges ?? []).map(edgeFromDraft);
  return { nodes, edges };
}

function toDraftDoc(nodes: Node[], edges: Edge[]): SchemaDraftDoc {
  return {
    tables: nodes.map((n) => {
      const d = n.data as unknown as DraftNodeData;
      return {
        id: n.id,
        name: d.name,
        kind: d.kind,
        columns: d.columns,
        x: Math.round(n.position.x),
        y: Math.round(n.position.y),
      };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      kind: (e.data as { kind?: DraftEdgeKind } | undefined)?.kind ?? (e.sourceHandle === "t" ? "feeds" : "fk"),
      srcTable: e.source,
      srcColumn: e.sourceHandle && e.sourceHandle !== "t" ? e.sourceHandle.slice(2) : null,
      dstTable: e.target,
      dstColumn: e.targetHandle && e.targetHandle !== "t" ? e.targetHandle.slice(2) : null,
    })),
  };
}

const ADD_GRID_W = 340;
const ADD_GRID_H = 320;
const ADD_PER_ROW = 4;

// Cascades new tables through the same grid forkFromLiveSchema uses, keyed
// on how many tables are already on the canvas — otherwise every added
// table lands at a fixed (40, 40) and stacks exactly on the last one.
function blankTable(index: number): DraftTable {
  return {
    id: crypto.randomUUID(),
    name: "",
    kind: "table",
    columns: [{ id: crypto.randomUUID(), name: "id", type: "uuid", pk: true }],
    x: (index % ADD_PER_ROW) * ADD_GRID_W,
    y: Math.floor(index / ADD_PER_ROW) * ADD_GRID_H,
  };
}

// ── The draft canvas ─────────────────────────────────────────────────────────

function DraftCanvasInner({
  initialDoc,
  onDocChange,
}: {
  initialDoc: SchemaDraftDoc | null;
  onDocChange: (doc: SchemaDraftDoc) => void;
}) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const renameTable = useCallback((id: string, name: string) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, name } } : n)));
  }, []);
  const toggleKind = useCallback((id: string) => {
    setNodes((ns) =>
      ns.map((n) => {
        if (n.id !== id) return n;
        const d = n.data as unknown as DraftNodeData;
        return { ...n, data: { ...d, kind: d.kind === "matview" ? "table" : "matview" } };
      }),
    );
  }, []);
  const deleteTable = useCallback((id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
  }, []);
  const columnChange = useCallback((id: string, colId: string, patch: Partial<DraftColumn>) => {
    setNodes((ns) =>
      ns.map((n) => {
        if (n.id !== id) return n;
        const d = n.data as unknown as DraftNodeData;
        return { ...n, data: { ...d, columns: d.columns.map((c) => (c.id === colId ? { ...c, ...patch } : c)) } };
      }),
    );
  }, []);
  const addColumn = useCallback((id: string) => {
    setNodes((ns) =>
      ns.map((n) => {
        if (n.id !== id) return n;
        const d = n.data as unknown as DraftNodeData;
        if (d.columns.length >= SCHEMA_DRAFT_MAX_COLUMNS) return n;
        return {
          ...n,
          data: { ...d, columns: [...d.columns, { id: crypto.randomUUID(), name: "", type: "text", pk: false }] },
        };
      }),
    );
  }, []);
  const removeColumn = useCallback((id: string, colId: string) => {
    setNodes((ns) =>
      ns.map((n) => {
        if (n.id !== id) return n;
        const d = n.data as unknown as DraftNodeData;
        return { ...n, data: { ...d, columns: d.columns.filter((c) => c.id !== colId) } };
      }),
    );
    setEdges((es) => es.filter((e) => e.sourceHandle !== `c:${colId}` && e.targetHandle !== `c:${colId}`));
  }, []);

  const actions = useMemo<DraftNodeActions>(
    () => ({
      onRename: renameTable,
      onToggleKind: toggleKind,
      onDeleteTable: deleteTable,
      onColumnChange: columnChange,
      onAddColumn: addColumn,
      onRemoveColumn: removeColumn,
    }),
    [renameTable, toggleKind, deleteTable, columnChange, addColumn, removeColumn],
  );

  // Seeds once per mount; the parent remounts this component (key) on every
  // load/new/fork, matching the /maps builder's canvasKey pattern.
  useEffect(() => {
    const seeded = fromDraftDoc(initialDoc, actions);
    setNodes(seeded.nodes);
    setEdges(seeded.edges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    // Table deletion is trash-icon only — never let a stray keyboard Delete
    // (e.g. while renaming a column) take a whole table with it.
    setNodes((ns) => applyNodeChanges(changes.filter((c) => c.type !== "remove"), ns));
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((es) => applyEdgeChanges(changes, es));
  }, []);
  const onConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target || !conn.sourceHandle || !conn.targetHandle) return;
    const kind: DraftEdgeKind = conn.sourceHandle === "t" && conn.targetHandle === "t" ? "feeds" : "fk";
    setEdges((es) => [
      ...es,
      {
        id: `e:${crypto.randomUUID()}`,
        source: conn.source!,
        sourceHandle: conn.sourceHandle,
        target: conn.target!,
        targetHandle: conn.targetHandle,
        style: kind === "feeds" ? FEED_STYLE : FK_STYLE,
        markerEnd: markerFor(kind),
        interactionWidth: 20,
        data: { kind },
      },
    ]);
  }, []);

  const addTable = useCallback(() => {
    setNodes((ns) => {
      if (ns.length >= SCHEMA_DRAFT_MAX_TABLES) return ns;
      const t = blankTable(ns.length);
      return [...ns, { id: t.id, type: "draft", position: { x: t.x, y: t.y }, data: { ...t, ...actions } }];
    });
  }, [actions]);

  // Report the serializable doc upward on every structural change.
  useEffect(() => {
    onDocChange(toDraftDoc(nodes, edges));
  }, [nodes, edges, onDocChange]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      deleteKeyCode={["Backspace", "Delete"]}
      fitView
      fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
      minZoom={0.1}
      maxZoom={1.5}
    >
      <Panel position="top-left" className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={addTable}
          disabled={nodes.length >= SCHEMA_DRAFT_MAX_TABLES}
          className="flex w-40 items-center gap-2 rounded-field border border-dashed border-field-border bg-surface px-3 py-2 text-[13px] font-medium text-text-body shadow-card transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
        >
          <Icon name="plus" size={15} className="text-text-muted" />
          Add table
        </button>
        <p className="mt-0.5 w-44 text-[11.5px] leading-snug text-text-muted">
          Drag a handle to another column for a foreign key; drag a table's edge handle to another table's for a
          matview feed.
        </p>
      </Panel>
      <Panel
        position="bottom-right"
        className="flex items-center gap-3 rounded-field border border-border bg-surface px-3 py-1.5 text-[11.5px] text-text-muted shadow-card"
      >
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

export function SchemaDraftCanvas(props: {
  initialDoc: SchemaDraftDoc | null;
  onDocChange: (doc: SchemaDraftDoc) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-card border border-border bg-[#FAFAFA]">
      <ReactFlowProvider>
        <DraftCanvasInner {...props} />
      </ReactFlowProvider>
    </div>
  );
}
