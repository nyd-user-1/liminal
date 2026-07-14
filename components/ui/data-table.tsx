"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ColumnPicker } from "@/components/ui/column-picker";
import { LoadMoreRow, SortableHead, Table, Td, Tr, useLazyBatch, useSort, type SortState } from "@/components/ui/table";
import { Toolbar } from "@/components/ui/toolbar";

// Catalog `DataTable` — the canonical table standard (docs/TASK-TABLE-STANDARD.md)
// as one composed primitive instead of a per-page copy-paste: sortable headers
// (SortableHead/useSort), an optional column picker (ColumnPicker, persisted to
// localStorage), single-line rows by default (every cell defaults to
// `whitespace-nowrap` — pass `cellClassName: "max-w-56 truncate"` for anything
// that can run long, paired with a `title` in your `render()`), and the
// horizontal-scroll containment the Table primitive already owns. Column
// definitions carry their own render/sort — this stays a thin composition of
// existing primitives, not a new one; see individual column render fns for
// row-specific cells (badges, links, logos, whatever the page needs).

export interface DataTableColumn<T> {
  key: string;
  label: string;
  /** Native tooltip on the header — lets an abbreviated `label` (a CPT code, a
   *  unit) stay one row instead of wrapping its meaning onto a second line. */
  headTitle?: string;
  render: (row: T) => ReactNode;
  /** Presence alone enables the header to sort asc/desc on click. */
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
  /** Starts hidden; still toggleable from the column picker. */
  defaultHidden?: boolean;
  /** Always rendered, never appears in the column picker (e.g. a leading identity column). */
  fixed?: boolean;
  /** Defaults to `whitespace-nowrap` — override for a truncating column, e.g. "max-w-56 truncate". */
  cellClassName?: string;
}

/** Visible-column state + localStorage persistence, shared by any table that
 *  wants a column picker. Pass no `storageKey` to keep everything visible and
 *  skip persistence entirely (nothing is read/written). */
export function useColumnVisibility(storageKey: string | undefined, columns: Array<{ key: string; defaultHidden?: boolean }>) {
  const [visible, setVisible] = useState<Set<string>>(() => new Set(columns.filter((c) => !c.defaultHidden).map((c) => c.key)));
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (Array.isArray(saved)) setVisible(new Set(saved));
    } catch {
      // corrupt storage — keep defaults
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const toggle = (key: string) => {
    setVisible((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify([...next]));
      return next;
    });
  };
  return [visible, toggle] as const;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  storageKey,
  defaultSort,
  rowClassName,
  onRowClick,
  toolbarExtra,
  footnote,
  className,
  lazy,
  scrollToKey,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Enables the column picker + localStorage-persisted visibility when set. */
  storageKey?: string;
  defaultSort?: SortState<string>;
  rowClassName?: (row: T) => string | undefined;
  onRowClick?: (row: T) => void;
  /** Renders left of the column picker in the toolbar (e.g. a search input). Toolbar only shows when this or storageKey is set. */
  toolbarExtra?: ReactNode;
  footnote?: ReactNode;
  className?: string;
  /**
   * Render in growing batches (useLazyBatch + a LoadMoreRow sentinel) instead
   * of putting every row in the DOM. For tables in the thousands — /published-rates
   * ships ~12.5k rows. `true` = the default 100-row batch.
   */
  lazy?: boolean | { batchSize?: number };
  /**
   * `rowKey` of a row to reveal: re-anchors the batch around that row under the
   * CURRENT sort, scrolls it into view and flashes it, leaving its neighbours
   * rendered around it. Pairs with a search that jumps to a match instead of
   * filtering the table down — the surrounding rows are often the point.
   * Ignored unless `lazy`.
   */
  scrollToKey?: string | null;
}) {
  const [visible, toggle] = useColumnVisibility(storageKey, columns);
  const shown = columns.filter((c) => c.fixed || !storageKey || visible.has(c.key));

  // No sort active until the user clicks a header — `col: ""` matches no
  // column key, so sortedRows below falls through to the given row order
  // (whatever the caller curated) instead of silently re-sorting on mount.
  const [sort, toggleSort] = useSort<string>(defaultSort ?? { col: "", dir: "asc" });

  const sortedRows = useMemo(() => {
    const col = columns.find((c) => c.key === sort.col);
    if (!col?.sortValue) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      return typeof va === "number" && typeof vb === "number" ? (va - vb) * dir : String(va).localeCompare(String(vb)) * dir;
    });
  }, [rows, sort, columns]);

  const head = shown.map((c) => {
    const inner = c.sortValue ? <SortableHead label={c.label} col={c.key} sort={sort} onSort={toggleSort} /> : c.label;
    if (c.align !== "right" && !c.headTitle) return inner;
    return (
      <div title={c.headTitle} className={c.align === "right" ? "flex justify-end" : undefined}>
        {inner}
      </div>
    );
  });

  // ── batching + jump-to-row ────────────────────────────────────────────────
  // Hooks run unconditionally (rules of hooks); `lazy` only decides whether the
  // batched slice or the full set is rendered.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const batchSize = typeof lazy === "object" ? (lazy.batchSize ?? 100) : 100;

  // Index under the ACTIVE sort — re-sorting moves the target, so the anchor is
  // recomputed against the new order, not the old one.
  const targetIndex = useMemo(
    () => (scrollToKey ? sortedRows.findIndex((r) => rowKey(r) === scrollToKey) : -1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scrollToKey, sortedRows],
  );

  // A jump ANCHORS the batch just above the target instead of growing the batch
  // down to it. Growing is the obvious reading, but the target's index is its
  // rank under the sort: jumping to a mid-table row would mount thousands of
  // rows (measured: ~12k rows / 8.6s for a bottom-ranked match) — the exact
  // thing lazy rendering exists to prevent. Anchoring keeps the DOM at one
  // batch and still shows the row in place, with its neighbours around it.
  const anchor = targetIndex >= batchSize ? Math.max(0, targetIndex - 25) : 0;
  const windowRows = useMemo(() => (anchor ? sortedRows.slice(anchor) : sortedRows), [sortedRows, anchor]);

  const { visible: batch, hasMore, sentinelRef } = useLazyBatch(windowRows, {
    batchSize,
    // Snap back to the first batch when the row set, the sort or the anchor moves.
    resetKey: `${sort.col}:${sort.dir}:${rows.length}:${anchor}`,
  });
  const rendered = lazy ? batch : sortedRows;

  useEffect(() => {
    if (!lazy || !scrollToKey || targetIndex < 0) return;
    // The anchor already put the row in `rendered` in this same commit, so it's
    // in the DOM by the time this effect runs. Keyed off the first cell, which
    // carries data-rowkey (Td already spreads arbitrary attributes).
    const cell = wrapRef.current?.querySelector(`[data-rowkey="${CSS.escape(scrollToKey)}"]`);
    if (!cell) return;
    cell.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlashKey(scrollToKey);
    const t = setTimeout(() => setFlashKey(null), 1800);
    return () => clearTimeout(t);
  }, [lazy, scrollToKey, targetIndex, sort.col, sort.dir]);

  return (
    // min-w-0 is load-bearing: without it this flex child grows past its
    // container and the PAGE scrolls horizontally instead of the Table
    // primitive's own overflow-auto wrapper (docs/TASK-TABLE-STANDARD.md).
    <div ref={wrapRef} className={`flex min-w-0 flex-col gap-3 ${className ?? ""}`}>
      {(toolbarExtra || storageKey) && (
        <Toolbar
          className="shrink-0"
          actions={
            <>
              {toolbarExtra}
              {storageKey && (
                <ColumnPicker
                  options={columns.filter((c) => !c.fixed).map((c) => ({ key: c.key, label: c.label }))}
                  visible={visible}
                  onToggle={toggle}
                />
              )}
            </>
          }
        />
      )}
      <Table head={head} className="min-w-0">
        {rendered.map((row) => {
          const key = rowKey(row);
          return (
            <Tr
              key={key}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              // Tr already transitions colors, so the flash fades out on its own.
              className={`${rowClassName?.(row) ?? ""}${flashKey === key ? " bg-teal-100" : ""}`}
            >
              {shown.map((c, i) => (
                <Td
                  key={c.key}
                  // Only the first cell is tagged — scrollToKey resolves the row
                  // via this attribute, one node per row instead of one per cell.
                  data-rowkey={i === 0 ? key : undefined}
                  className={`${c.align === "right" ? "text-right tabular-nums " : ""}${c.cellClassName ?? "whitespace-nowrap"}`}
                >
                  {c.render(row)}
                </Td>
              ))}
            </Tr>
          );
        })}
        {lazy && hasMore && <LoadMoreRow sentinelRef={sentinelRef} colSpan={shown.length} />}
      </Table>
      {footnote}
    </div>
  );
}
