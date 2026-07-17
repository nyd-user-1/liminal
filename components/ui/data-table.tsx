"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ColumnPicker } from "@/components/ui/column-picker";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
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
  toolbarLeft,
  footnote,
  className,
  lazy,
  scrollToKey,
  fillHeight,
  subRows,
  isSubRow,
  selected,
  onSelectedChange,
  rowActions,
  filter,
  onExport,
  onRefresh,
  stacked = false,
  collapseActions = false,
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
  /**
   * Renders LEFT-aligned in the toolbar — search + filter chips, the way every
   * index page lays them out (see /directory). `toolbarExtra` is the opposite
   * end: it sits right, beside the column picker.
   */
  toolbarLeft?: ReactNode;
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
  /**
   * Bound the table to its container and scroll the ROWS under a sticky header,
   * instead of growing the page. Needs a height-bounded ancestor — the caller's
   * wrapper must be `flex min-h-0 flex-1 flex-col` (the (app) shell's <main>
   * already provides the bound).
   */
  fillHeight?: boolean;
  /**
   * Turns the table into a TREE: return a row's children and it gains a
   * disclosure control; the children render beneath it, indented, in the same
   * columns. Return undefined/empty for a leaf.
   *
   * Same columns top to bottom is the whole point — it makes "compare across
   * groups" and "compare inside one group" the same gesture at two depths,
   * rather than two screens. Children are NOT sorted into the parent list: the
   * sort orders parents, and each parent keeps its own children in the order the
   * caller supplied.
   */
  subRows?: (row: T) => T[] | undefined;
  /** True for a child row — drives the indent. Required with `subRows`. */
  isSubRow?: (row: T) => boolean;
  /**
   * THE INDEX-PAGE STANDARD (see /clients). Leading select column + trailing
   * kebab column + the Filter/Columns/Export/Refresh cluster. All opt-in, so
   * the analytical tables that are just a grid of numbers stay a grid.
   */
  selected?: Set<string>;
  onSelectedChange?: (next: Set<string>) => void;
  /** Trailing kebab cell. Its own click-stop is handled here. */
  rowActions?: (row: T) => ReactNode;
  /** The page's filter chip — sits left of Columns in the actions cluster. */
  filter?: ReactNode;
  onExport?: () => void;
  onRefresh?: () => void;
  /**
   * The `stacked` variant (vs the default index layout).
   *
   *   index   — search LEFT in the toolbar, the Filter · Columns · Export ·
   *             Refresh cluster right, all of it ABOVE the table chrome.
   *   stacked — `toolbarLeft` (the search) renders full-width above the chrome;
   *             the actions cluster moves INSIDE the chrome, above a grey
   *             header band. For dense analytical tables where the search IS
   *             the primary control and the facets belong with the data.
   *
   * Same slots either way — a page changes layout, not its wiring.
   */
  stacked?: boolean;
  /**
   * Collapse the Columns/Export/Refresh actions into ONE right-aligned
   * horizontal kebab (⋯) instead of a row of buttons — for a dense toolbar
   * where the search + filter are the point and the table utilities should
   * step back. Opt-in, so every other table keeps its inline buttons. `filter`
   * and `toolbarLeft` are untouched; only the utility cluster folds up.
   */
  collapseActions?: boolean;
}) {
  const [visible, toggle] = useColumnVisibility(storageKey, columns);
  const shown = columns.filter((c) => c.fixed || !storageKey || visible.has(c.key));
  // Cursor position of a header right-click; null = column menu closed.
  const [colMenu, setColMenu] = useState<{ x: number; y: number } | null>(null);
  const pickerOptions = useMemo(
    () => columns.filter((c) => !c.fixed).map((c) => ({ key: c.key, label: c.label })),
    [columns],
  );

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

  const dataHead = shown.map((c) => {
    const inner = c.sortValue ? <SortableHead label={c.label} col={c.key} sort={sort} onSort={toggleSort} /> : c.label;
    if (c.align !== "right" && !c.headTitle) return inner;
    return (
      <div title={c.headTitle} className={c.align === "right" ? "flex justify-end" : undefined}>
        {inner}
      </div>
    );
  });

  // ── select-all ────────────────────────────────────────────────────────────
  // Scoped to the rows currently in view (post-filter), not the whole dataset:
  // "select all" must mean the same thing the user can see.
  const selectable = !!selected && !!onSelectedChange;
  const allSelected = selectable && rows.length > 0 && rows.every((r) => selected!.has(rowKey(r)));
  const toggleAll = () => {
    const next = new Set(selected);
    for (const r of rows) {
      const k = rowKey(r);
      if (allSelected) next.delete(k);
      else next.add(k);
    }
    onSelectedChange!(next);
  };
  const toggleOne = (key: string) => {
    const next = new Set(selected);
    if (!next.delete(key)) next.add(key);
    onSelectedChange!(next);
  };

  const head = [
    ...(selectable
      ? [<Checkbox key="__sel" aria-label="Select all" checked={allSelected} onChange={toggleAll} />]
      : []),
    ...dataHead,
    // Reserved for the kebab — deliberately unlabelled.
    ...(rowActions ? [""] : []),
  ];

  // ── tree ─────────────────────────────────────────────────────────────────
  // Expansion splices each open parent's children in directly after it, so
  // everything downstream — sort, batching, the jump-to-row anchor — keeps
  // operating on one flat list and needs to know nothing about depth. The sort
  // above ran on PARENTS only, which is what keeps a child attached to its
  // parent instead of being re-ranked away from it.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const treeRows = useMemo(() => {
    if (!subRows) return sortedRows;
    const out: T[] = [];
    for (const r of sortedRows) {
      out.push(r);
      if (expanded.has(rowKey(r))) out.push(...(subRows(r) ?? []));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedRows, expanded, subRows]);

  // ── batching + jump-to-row ────────────────────────────────────────────────
  // Hooks run unconditionally (rules of hooks); `lazy` only decides whether the
  // batched slice or the full set is rendered.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const batchSize = typeof lazy === "object" ? (lazy.batchSize ?? 100) : 100;

  // Index under the ACTIVE sort — re-sorting moves the target, so the anchor is
  // recomputed against the new order, not the old one.
  const targetIndex = useMemo(
    () => (scrollToKey ? treeRows.findIndex((r) => rowKey(r) === scrollToKey) : -1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scrollToKey, treeRows],
  );

  // A jump ANCHORS the batch just above the target instead of growing the batch
  // down to it. Growing is the obvious reading, but the target's index is its
  // rank under the sort: jumping to a mid-table row would mount thousands of
  // rows (measured: ~12k rows / 8.6s for a bottom-ranked match) — the exact
  // thing lazy rendering exists to prevent. Anchoring keeps the DOM at one
  // batch and still shows the row in place, with its neighbours around it.
  const anchor = targetIndex >= batchSize ? Math.max(0, targetIndex - 25) : 0;
  const windowRows = useMemo(() => (anchor ? treeRows.slice(anchor) : treeRows), [treeRows, anchor]);

  const { visible: batch, hasMore, sentinelRef } = useLazyBatch(windowRows, {
    batchSize,
    // Snap back to the first batch when the row set, the sort or the anchor moves.
    // treeRows.length moves when a group opens/closes, which must NOT reset the
    // batch — that would snap the user back to the top on every expand. Only the
    // parent set, the sort and the anchor reset it.
    resetKey: `${sort.col}:${sort.dir}:${rows.length}:${anchor}`,
  });
  const rendered = lazy ? batch : treeRows;

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

  const hasToolbar = !!(toolbarExtra || toolbarLeft || storageKey || filter || onExport || onRefresh);
  // Opening the column picker from the kebab: reuse the anchored ColumnPicker
  // (the one the header right-click uses), positioned under the kebab button.
  const kebabRef = useRef<HTMLSpanElement>(null);
  const openColMenuFromKebab = () => {
    const r = kebabRef.current?.getBoundingClientRect();
    setColMenu(r ? { x: r.right, y: r.bottom + 4 } : { x: 0, y: 0 });
  };
  // The same utilities in both variants — only where and how they render.
  // collapseActions folds Columns/Export/Refresh into one horizontal kebab.
  const utilities = collapseActions ? (
    <span ref={kebabRef} className="inline-flex">
      <KebabMenu label="Table options" icon="dots-horizontal">
        {storageKey && <MenuItem icon="columns-3" label="Columns" onClick={openColMenuFromKebab} />}
        {onExport && <MenuItem icon="download" label="Export" onClick={onExport} />}
        {onRefresh && <MenuItem icon="refresh-cw" label="Refresh" onClick={onRefresh} />}
      </KebabMenu>
    </span>
  ) : (
    <>
      {storageKey && <ColumnPicker options={pickerOptions} visible={visible} onToggle={toggle} />}
      {onExport && (
        <Button
          variant="secondary"
          size="sm"
          leftIcon="download"
          onClick={onExport}
          className="!border-field-border !text-text-body hover:!border-field-border-focus"
        >
          Export
        </Button>
      )}
      {onRefresh && (
        <Button
          variant="secondary"
          size="sm"
          leftIcon="refresh-cw"
          onClick={onRefresh}
          className="!border-field-border !text-text-body hover:!border-field-border-focus"
        >
          Refresh
        </Button>
      )}
    </>
  );
  const actionsCluster = (
    <>
      {toolbarExtra}
      {filter}
      {utilities}
    </>
  );

  return (
    // min-w-0 is load-bearing: without it this flex child grows past its
    // container and the PAGE scrolls horizontally instead of the Table
    // primitive's own overflow-auto wrapper (docs/TASK-TABLE-STANDARD.md).
    <div
      ref={wrapRef}
      className={`flex min-w-0 flex-col gap-3 ${fillHeight ? "min-h-0 flex-1" : ""} ${className ?? ""}`}
    >
      {/* `stacked` puts the search full-width above the chrome and moves this
          cluster inside it (see the variant note on the props). */}
      {stacked && toolbarLeft && <div className="shrink-0">{toolbarLeft}</div>}
      {!stacked && hasToolbar && (
        <Toolbar className="shrink-0 flex-wrap" actions={actionsCluster}>
          {toolbarLeft}
        </Toolbar>
      )}
      {/* Right-click ANY header for the column menu — the picker chip is the
          visible path, this is the fast one. Cursor-anchored + position:fixed,
          so the Table's overflow-auto cannot clip it. */}
      {storageKey && (
        <ColumnPicker
          at={colMenu}
          onDismiss={() => setColMenu(null)}
          options={pickerOptions}
          visible={visible}
          onToggle={toggle}
        />
      )}
      <Table
        head={head}
        stickyHeader={fillHeight}
        tintedHeader={stacked}
        toolbar={stacked && hasToolbar ? actionsCluster : undefined}
        onHeaderContextMenu={
          storageKey
            ? (e) => {
                e.preventDefault();
                setColMenu({ x: e.clientX, y: e.clientY });
              }
            : undefined
        }
        className={`min-w-0 ${fillHeight ? "min-h-0 flex-1" : ""}`}
      >
        {rendered.map((row) => {
          const key = rowKey(row);
          const kids = subRows?.(row);
          const canExpand = !!kids?.length;
          const sub = isSubRow?.(row) ?? false;
          const open = expanded.has(key);
          return (
            <Tr
              key={key}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              // Tr already transitions colors, so the flash fades out on its own.
              className={`${rowClassName?.(row) ?? ""}${flashKey === key ? " bg-teal-100" : ""}`}
            >
              {selectable && (
                // stopPropagation: selecting a row must not also open it.
                <Td className="w-10" onClick={(e) => e.stopPropagation()}>
                  <Checkbox aria-label="Select row" checked={selected!.has(key)} onChange={() => toggleOne(key)} />
                </Td>
              )}
              {shown.map((c, i) => (
                <Td
                  key={c.key}
                  // Only the first cell is tagged — scrollToKey resolves the row
                  // via this attribute, one node per row instead of one per cell.
                  data-rowkey={i === 0 ? key : undefined}
                  className={`${c.align === "right" ? "text-right tabular-nums " : ""}${c.cellClassName ?? "whitespace-nowrap"}`}
                >
                  {i === 0 && subRows ? (
                    <span className="flex min-w-0 items-center gap-1.5">
                      {canExpand ? (
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-label={open ? "Collapse" : "Expand"}
                          // Without this the click also fires onRowClick, so
                          // opening a group would navigate away from it.
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpanded((s) => {
                              const next = new Set(s);
                              if (!next.delete(key)) next.add(key);
                              return next;
                            });
                          }}
                          className="-my-1 shrink-0 rounded p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
                        >
                          <svg viewBox="0 0 16 16" className={`size-3 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>
                            <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      ) : (
                        // Reserve the control's width so leaves and children
                        // still align with the groups above them.
                        <span className={`shrink-0 ${sub ? "w-6" : "w-5"}`} aria-hidden />
                      )}
                      <span className="min-w-0 truncate">{c.render(row)}</span>
                    </span>
                  ) : (
                    c.render(row)
                  )}
                </Td>
              ))}
              {rowActions && (
                <Td className="w-12" onClick={(e) => e.stopPropagation()}>
                  {rowActions(row)}
                </Td>
              )}
            </Tr>
          );
        })}
        {lazy && hasMore && (
          <LoadMoreRow sentinelRef={sentinelRef} colSpan={shown.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)} />
        )}
      </Table>
      {footnote}
    </div>
  );
}
