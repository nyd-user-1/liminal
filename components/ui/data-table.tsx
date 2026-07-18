"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ColumnPicker } from "@/components/ui/column-picker";
import { FilterChip } from "@/components/ui/filter-chip";
import { Icon, type IconName } from "@/components/ui/icons";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { DropdownMenu, MenuDivider, MenuItem, MenuSectionLabel } from "@/components/ui/dropdown-menu";
import { LoadMoreRow, Table, Td, Tr, useLazyBatch, useSentinel, useSort, type SortState } from "@/components/ui/table";
import { Toolbar } from "@/components/ui/toolbar";

// Catalog `DataTable` — the canonical table standard (docs/TASK-TABLE-STANDARD.md)
// as one composed primitive instead of a per-page copy-paste: per-column header
// MENUS (click a header → Sort asc/desc · Filter by value · Hide column — the
// NYS-147 canonical; active filters surface as clearable toolbar chips), an
// optional column picker (ColumnPicker, persisted to localStorage; header
// right-click still opens it), single-line rows by default (every cell defaults
// to `whitespace-nowrap` — pass `cellClassName: "max-w-56 truncate"` for
// anything that can run long, paired with a `title` in your `render()`), a
// floating bulk-action bar over a non-empty selection (`bulkActions` +
// `BulkAction`), the `EmptyCell` helper (a missing value renders a label or
// CTA, never blank), and the horizontal-scroll containment the Table primitive
// already owns. Column definitions carry their own render/sort/filter — this
// stays a thin composition of existing primitives, not a new one; see
// individual column render fns for row-specific cells (badges, links, logos,
// whatever the page needs).

export interface DataTableColumn<T> {
  key: string;
  label: string;
  /** Native tooltip on the header — lets an abbreviated `label` (a CPT code, a
   *  unit) stay one row instead of wrapping its meaning onto a second line. */
  headTitle?: string;
  render: (row: T) => ReactNode;
  /** Presence alone enables Sort asc/desc in the column's header menu. */
  sortValue?: (row: T) => string | number;
  /** Enables "Filter" in the header menu: map a row to the facet value the
   *  filter groups on (a label, not free text — keep cardinality low). Active
   *  filters render as clearable chips in the toolbar. */
  filterValue?: (row: T) => string;
  align?: "left" | "right";
  /** Starts hidden; still toggleable from the column picker. */
  defaultHidden?: boolean;
  /** Always rendered, never appears in the column picker (e.g. a leading identity column). */
  fixed?: boolean;
  /** Defaults to `whitespace-nowrap` — override for a truncating column, e.g. "max-w-56 truncate". */
  cellClassName?: string;
}

/** One level of the group-by tree (NYS-147 §5). Levels nest in array order —
 *  e.g. Insurer → Network — and every leaf row renders in the SAME columns,
 *  indented under its count headers. */
export interface DataTableGroupLevel<T> {
  /** Matches a column key when the level mirrors a column — sorting that
   *  column then reorders the GROUPS, not just the rows inside them. */
  key: string;
  label: string;
  value: (row: T) => string;
  /** Start this level collapsed — a big tree leads with its counts. */
  defaultCollapsed?: boolean;
}

/** Synthetic entry spliced into the row stream for a group's count header. */
interface GroupHeaderEntry {
  __group: true;
  path: string;
  label: string;
  depth: number;
  count: number;
  collapsed: boolean;
}
const isGroupHeader = (x: unknown): x is GroupHeaderEntry =>
  typeof x === "object" && x !== null && (x as GroupHeaderEntry).__group === true;

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
  tableFooter,
  onEndReached,
  className,
  lazy,
  scrollToKey,
  fillHeight,
  subRows,
  isSubRow,
  groupBy,
  selected,
  onSelectedChange,
  rowActions,
  bulkActions,
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
  /** A summary line rendered as a sticky footer INSIDE the table card (via the
   *  Table `footer` slot), instead of `footnote` below it. */
  tableFooter?: ReactNode;
  /** Fired when the user scrolls to the bottom of the rows — for server-paged
   *  tables that grow on scroll instead of a "Load more" button. Guard the
   *  callback (skip when already loading or exhausted). */
  onEndReached?: () => void;
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
   * The GROUP-BY tree (NYS-147 §5): collapsible count-header rows over the
   * data rows, one level per array entry (Insurer → Network → …), same
   * columns top to bottom. Group order follows the label (and flips with the
   * sort when the sort column IS the grouped dimension); leaves inside keep
   * the active sort. A "Group · …" toolbar chip shows the active grouping and
   * its × flattens the table (the chip re-applies it). Takes precedence over
   * `subRows` when both are set.
   */
  groupBy?: DataTableGroupLevel<T>[];
  /**
   * THE INDEX-PAGE STANDARD (see /clients). Leading select column + trailing
   * kebab column + the Filter/Columns/Export/Refresh cluster. All opt-in, so
   * the analytical tables that are just a grid of numbers stay a grid.
   */
  selected?: Set<string>;
  onSelectedChange?: (next: Set<string>) => void;
  /** Trailing kebab cell. Its own click-stop is handled here. */
  rowActions?: (row: T) => ReactNode;
  /**
   * Actions for the floating bulk bar ("N selected · … · ×") that rises over
   * the table bottom while the selection is non-empty. Compose from
   * `BulkAction` buttons. Requires `selected`/`onSelectedChange`; the count
   * and the clear button are built in. Pairs naturally with `fillHeight`
   * (the bar floats inside the table's own bounds).
   */
  bulkActions?: ReactNode;
  /** The page's filter chip — sits left of Columns in the actions cluster. */
  filter?: ReactNode;
  onExport?: () => void;
  onRefresh?: () => void;
  /**
   * The `stacked` variant (vs the default index layout).
   *
   *   index   — search LEFT in the toolbar, the Filter · Columns · Export ·
   *             Refresh cluster right, all of it ABOVE the table chrome.
   *   stacked — the WHOLE toolbar lives INSIDE the table card as its header
   *             section, above a grey column-header band: search + filter
   *             left, the utilities kebab right. One bordered card wrapping
   *             toolbar → headers → rows. For the analytical /rates tables.
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

  // No sort active until the user picks one — `col: ""` matches no column key,
  // so sortedRows below falls through to the given row order (whatever the
  // caller curated) instead of silently re-sorting on mount.
  const [sort, , setSort] = useSort<string>(defaultSort ?? { col: "", dir: "asc" });

  // ── per-column filters (the header menu's "Filter") ───────────────────────
  const [colFilters, setColFilters] = useState<Record<string, Set<string>>>({});
  const toggleColFilter = (key: string, value: string) =>
    setColFilters((f) => {
      const next = new Set(f[key] ?? []);
      if (!next.delete(value)) next.add(value);
      return { ...f, [key]: next };
    });
  const clearColFilter = (key: string) =>
    setColFilters((f) => {
      const next = { ...f };
      delete next[key];
      return next;
    });

  const filteredRows = useMemo(() => {
    const active = columns.filter((c) => c.filterValue && colFilters[c.key]?.size);
    if (!active.length) return rows;
    return rows.filter((r) => active.every((c) => colFilters[c.key]!.has(c.filterValue!(r))));
  }, [rows, colFilters, columns]);
  const activeFilterCols = columns.filter((c) => colFilters[c.key]?.size);
  // Serialized filter state — part of the lazy-batch resetKey, so a filter
  // change snaps back to the first batch even when the row COUNT is unchanged.
  const filterKey = activeFilterCols.map((c) => `${c.key}=${[...colFilters[c.key]!].sort().join("¦")}`).join("|");

  const sortedRows = useMemo(() => {
    const col = columns.find((c) => c.key === sort.col);
    if (!col?.sortValue) return filteredRows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      return typeof va === "number" && typeof vb === "number" ? (va - vb) * dir : String(va).localeCompare(String(vb)) * dir;
    });
  }, [filteredRows, sort, columns]);

  // Every header is a MENU (NYS-147): Sort asc/desc when sortable, Filter when
  // the column declares `filterValue`, Hide when the picker is enabled. A
  // column offering none of the three keeps a plain label.
  const dataHead = shown.map((c) => {
    const canSort = !!c.sortValue;
    const canFilter = !!c.filterValue;
    const canHide = !!storageKey && !c.fixed;
    const sortActive = sort.col === c.key;
    const filterActive = !!colFilters[c.key]?.size;
    const inner =
      !canSort && !canFilter && !canHide ? (
        c.label
      ) : (
        <DropdownMenu
          label={`${c.label} column options`}
          align={c.align === "right" ? "right" : "left"}
          width="w-60"
          triggerClassName="-mx-1 flex items-center gap-1 whitespace-nowrap rounded px-1 transition-colors hover:text-primary-deep"
          trigger={
            <>
              {c.label}
              {filterActive && <Icon name="list-filter" size={12} className="text-primary" />}
              <Icon
                name={sortActive && sort.dir === "asc" ? "chevron-up" : "chevron-down"}
                size={14}
                className={sortActive ? "" : "opacity-30"}
              />
            </>
          }
        >
          <HeaderMenu
            col={c}
            rows={rows}
            sort={sort}
            setSort={setSort}
            filter={colFilters[c.key]}
            onFilterToggle={(v) => toggleColFilter(c.key, v)}
            onFilterClear={() => clearColFilter(c.key)}
            canHide={canHide}
            onHide={() => toggle(c.key)}
          />
        </DropdownMenu>
      );
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
  const allSelected = selectable && filteredRows.length > 0 && filteredRows.every((r) => selected!.has(rowKey(r)));
  const toggleAll = () => {
    const next = new Set(selected);
    for (const r of filteredRows) {
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

  // ── group-by tree ─────────────────────────────────────────────────────────
  // Count-header entries spliced into the row stream. `groupToggled` inverts a
  // level's default state per path, so default-collapsed levels work without
  // enumerating every path up front. `grouping` is the chip's on/off.
  const [grouping, setGrouping] = useState(true);
  const [groupToggled, setGroupToggled] = useState<Set<string>>(new Set());
  const toggleGroup = (path: string) =>
    setGroupToggled((s) => {
      const next = new Set(s);
      if (!next.delete(path)) next.add(path);
      return next;
    });
  const grouped = !!groupBy?.length && grouping;
  const displayRows = useMemo<Array<T | GroupHeaderEntry>>(() => {
    if (!grouped) return treeRows;
    const out: Array<T | GroupHeaderEntry> = [];
    const walk = (list: T[], depth: number, prefix: string) => {
      const level = groupBy![depth];
      if (!level) {
        out.push(...list);
        return;
      }
      const buckets = new Map<string, T[]>();
      for (const r of list) {
        const v = level.value(r);
        const b = buckets.get(v);
        if (b) b.push(r);
        else buckets.set(v, [r]);
      }
      // Alphabetical groups; the direction flips only when the active sort IS
      // this dimension (so "sort Insurer desc" visibly reorders the groups).
      const dirMul = level.key === sort.col && sort.dir === "desc" ? -1 : 1;
      const names = [...buckets.keys()].sort((a, b) => a.localeCompare(b) * dirMul);
      for (const name of names) {
        const kids = buckets.get(name)!;
        const path = `${prefix}${name}`;
        const collapsed = level.defaultCollapsed ? !groupToggled.has(path) : groupToggled.has(path);
        out.push({ __group: true, path, label: name, depth, count: kids.length, collapsed });
        if (!collapsed) walk(kids, depth + 1, `${path}¦`);
      }
    };
    walk(sortedRows, 0, "");
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grouped, groupBy, sortedRows, treeRows, groupToggled, sort]);

  // ── batching + jump-to-row ────────────────────────────────────────────────
  // Hooks run unconditionally (rules of hooks); `lazy` only decides whether the
  // batched slice or the full set is rendered.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const batchSize = typeof lazy === "object" ? (lazy.batchSize ?? 100) : 100;

  // Index under the ACTIVE sort — re-sorting moves the target, so the anchor is
  // recomputed against the new order, not the old one.
  const targetIndex = useMemo(
    () => (scrollToKey ? displayRows.findIndex((r) => !isGroupHeader(r) && rowKey(r) === scrollToKey) : -1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scrollToKey, displayRows],
  );

  // A jump ANCHORS the batch just above the target instead of growing the batch
  // down to it. Growing is the obvious reading, but the target's index is its
  // rank under the sort: jumping to a mid-table row would mount thousands of
  // rows (measured: ~12k rows / 8.6s for a bottom-ranked match) — the exact
  // thing lazy rendering exists to prevent. Anchoring keeps the DOM at one
  // batch and still shows the row in place, with its neighbours around it.
  const anchor = targetIndex >= batchSize ? Math.max(0, targetIndex - 25) : 0;
  const windowRows = useMemo(() => (anchor ? displayRows.slice(anchor) : displayRows), [displayRows, anchor]);

  const { visible: batch, hasMore, sentinelRef } = useLazyBatch(windowRows, {
    batchSize,
    // Snap back to the first batch when the row set, the sort or the anchor moves.
    // treeRows.length moves when a group opens/closes, which must NOT reset the
    // batch — that would snap the user back to the top on every expand. Only the
    // parent set, the sort and the anchor reset it.
    resetKey: `${sort.col}:${sort.dir}:${filteredRows.length}:${filterKey}:${anchor}`,
  });
  const rendered = lazy ? batch : displayRows;

  // Server-paged infinite scroll: once client batching has nothing left to
  // reveal (or lazy is off entirely), a bottom sentinel asks the caller for the
  // next page. Kept separate from the lazy sentinel so the two never fight.
  const endSentinelRef = useSentinel(() => onEndReached?.(), !!onEndReached && !(lazy && hasMore));

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

  const hasToolbar = !!(toolbarExtra || toolbarLeft || storageKey || filter || onExport || onRefresh || activeFilterCols.length || groupBy?.length);
  // Grouping made visible: the chip names the levels, its × flattens the
  // table, and the unapplied chip re-applies the tree.
  const groupChip = groupBy?.length ? (
    <FilterChip
      label="Group"
      icon="corner-down-right"
      value={grouping ? groupBy.map((g) => g.label).join(" → ") : undefined}
      onClear={() => setGrouping(false)}
      onClick={grouping ? undefined : () => setGrouping(true)}
    />
  ) : null;
  // One clearable chip per header-menu filter — the filter state stays visible
  // (and killable) without reopening the header.
  const filterChips = activeFilterCols.map((c) => {
    const set = colFilters[c.key]!;
    return (
      <FilterChip
        key={c.key}
        label={c.label}
        icon="list-filter"
        value={set.size === 1 ? [...set][0] : `${set.size} values`}
        onClear={() => clearColFilter(c.key)}
      />
    );
  });
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
      className={`relative flex min-w-0 flex-col gap-3 ${fillHeight ? "min-h-0 flex-1" : ""} ${className ?? ""}`}
    >
      {/* `stacked` renders the whole toolbar INSIDE the table chrome (below) —
          nothing floats above the card. The default index layout keeps the
          toolbar above the chrome. */}
      {!stacked && hasToolbar && (
        <Toolbar className="shrink-0 flex-wrap" actions={actionsCluster}>
          {toolbarLeft}
          {groupChip}
          {filterChips}
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
        footer={tableFooter}
        toolbar={
          // Stacked: the toolbar IS the card's header section — search + filter
          // flex-grow on the left, the utilities kebab pinned right. The column
          // header band stays white with teal text (Table's default), not tinted.
          stacked && hasToolbar ? (
            <>
              <div className="flex flex-1 flex-wrap items-center gap-2.5">
                {toolbarLeft}
                {filter}
                {groupChip}
                {filterChips}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {toolbarExtra}
                {utilities}
              </div>
            </>
          ) : undefined
        }
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
        {rendered.map((entry) => {
          if (isGroupHeader(entry)) {
            return (
              <Tr key={`group:${entry.path}`}>
                <Td colSpan={shown.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)} className="bg-canvas py-2">
                  <button
                    type="button"
                    aria-expanded={!entry.collapsed}
                    onClick={() => toggleGroup(entry.path)}
                    className="flex w-full items-center gap-1.5 text-left"
                    style={entry.depth ? { paddingLeft: entry.depth * 24 } : undefined}
                  >
                    <svg viewBox="0 0 16 16" className={`size-3 shrink-0 text-text-muted transition-transform ${entry.collapsed ? "" : "rotate-90"}`} aria-hidden>
                      <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="font-semibold text-text">{entry.label}</span>
                    <span className="text-[13px] font-medium tabular-nums text-text-muted">{entry.count.toLocaleString("en-US")}</span>
                  </button>
                </Td>
              </Tr>
            );
          }
          const row = entry;
          const key = rowKey(row);
          const kids = subRows?.(row);
          const canExpand = !grouped && !!kids?.length;
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
                  {i === 0 && grouped ? (
                    // Leaves sit one indent step under their deepest count header.
                    <span className="flex min-w-0 items-center" style={{ paddingLeft: groupBy!.length * 24 }}>
                      <span className="min-w-0 truncate">{c.render(row)}</span>
                    </span>
                  ) : i === 0 && subRows ? (
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
        {filteredRows.length === 0 && rows.length > 0 && (
          // Header-menu filters reduced a non-empty table to nothing — teach the
          // way out instead of showing bare chrome. (The caller still owns the
          // truly-empty state via its own footnote/EmptyState.)
          <tr>
            <td colSpan={shown.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)} className="px-4 py-8 text-center text-sm text-text-muted">
              No rows match the active column filters.{" "}
              <button type="button" onClick={() => setColFilters({})} className="font-medium text-primary hover:underline">
                Clear filters
              </button>
            </td>
          </tr>
        )}
        {lazy && hasMore && (
          <LoadMoreRow sentinelRef={sentinelRef} colSpan={shown.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)} />
        )}
        {onEndReached && !(lazy && hasMore) && (
          <LoadMoreRow sentinelRef={endSentinelRef} colSpan={shown.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)} />
        )}
      </Table>
      {footnote}
      {/* ── floating bulk-action bar (NYS-147) ──────────────────────────────
          Rises over the table bottom while anything is selected. Navy pill on
          the brand ink so it reads as a mode, not a row; the count + clear are
          built in, the actions come from the caller. */}
      {selectable && selected!.size > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center">
          <div className="bulk-bar-rise pointer-events-auto flex items-center gap-1 rounded-full bg-sidebar-bg py-1.5 pl-4 pr-1.5 text-white shadow-menu">
            <span className="text-sm font-medium tabular-nums">{selected!.size.toLocaleString("en-US")} selected</span>
            {bulkActions && <span aria-hidden className="mx-2 h-4 w-px bg-white/20" />}
            {bulkActions}
            <button
              type="button"
              aria-label="Clear selection"
              onClick={() => onSelectedChange!(new Set())}
              className="ml-1 rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── header menu ──────────────────────────────────────────────────────────────
// The per-column dropdown behind every header click. Rendered inside
// DropdownMenu's portal, so the distinct-value scan below only runs while the
// menu is actually open.
function HeaderMenu<T>({
  col,
  rows,
  sort,
  setSort,
  filter,
  onFilterToggle,
  onFilterClear,
  canHide,
  onHide,
}: {
  col: DataTableColumn<T>;
  rows: T[];
  sort: SortState<string>;
  setSort: (s: SortState<string>) => void;
  filter: Set<string> | undefined;
  onFilterToggle: (v: string) => void;
  onFilterClear: () => void;
  canHide: boolean;
  onHide: () => void;
}) {
  const sortActive = sort.col === col.key;
  // Distinct values over the CALLER's rows (search applied, column filters
  // not) — an unchecked value must stay listed or it could never be re-checked.
  const counts = useMemo(() => {
    if (!col.filterValue) return null;
    const m = new Map<string, number>();
    for (const r of rows) {
      const v = col.filterValue(r);
      m.set(v, (m.get(v) ?? 0) + 1);
    }
    return m;
  }, [col, rows]);
  const values = counts ? [...counts.keys()].sort((a, b) => a.localeCompare(b)) : null;
  return (
    <>
      {col.sortValue && (
        <>
          <MenuItem
            icon="chevron-up"
            label="Sort ascending"
            selected={sortActive && sort.dir === "asc"}
            onClick={() => setSort({ col: col.key, dir: "asc" })}
          />
          <MenuItem
            icon="chevron-down"
            label="Sort descending"
            selected={sortActive && sort.dir === "desc"}
            onClick={() => setSort({ col: col.key, dir: "desc" })}
          />
          {sortActive && <MenuItem icon="x" label="Clear sort" onClick={() => setSort({ col: "", dir: "asc" })} />}
        </>
      )}
      {values && values.length > 0 && (
        <>
          {col.sortValue && <MenuDivider />}
          <MenuSectionLabel>Filter</MenuSectionLabel>
          <div className="max-h-56 overflow-y-auto">
            {values.map((v) => (
              <label
                key={v}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-field px-2.5 py-1.5 text-[15px] text-text transition-colors hover:bg-[#F3F4F6]"
              >
                <Checkbox aria-label={`Filter ${col.label}: ${v}`} checked={filter?.has(v) ?? false} onChange={() => onFilterToggle(v)} />
                <span className="min-w-0 flex-1 truncate" title={v}>
                  {v}
                </span>
                <span className="shrink-0 text-[13px] tabular-nums text-text-muted">{counts!.get(v)!.toLocaleString("en-US")}</span>
              </label>
            ))}
          </div>
          {!!filter?.size && <MenuItem icon="x" label="Clear filter" onClick={onFilterClear} />}
        </>
      )}
      {canHide && (
        <>
          {(col.sortValue || (values && values.length > 0)) && <MenuDivider />}
          <MenuItem icon="eye-off" label="Hide column" onClick={onHide} />
        </>
      )}
    </>
  );
}

/** NYS-147 — a missing value never renders as a blank cell. Default form is a
 *  quiet semantic label ("Insurer-run", "No notes"); pass `onClick` or `href`
 *  and the empty cell becomes the CTA that fills it ("+ Add rate"). */
export function EmptyCell({
  label,
  title,
  onClick,
  href,
}: {
  label: string;
  /** Native tooltip expanding the label ("No TPA — the insurer administers this network"). */
  title?: string;
  onClick?: () => void;
  href?: string;
}) {
  if (onClick || href) {
    const cls =
      "inline-flex items-center gap-1 rounded text-sm text-text-muted underline decoration-border decoration-dashed underline-offset-4 transition-colors hover:text-primary hover:decoration-primary";
    const inner = (
      <>
        <Icon name="plus" size={13} />
        {label}
      </>
    );
    return href ? (
      <Link href={href} title={title} className={cls} onClick={(e) => e.stopPropagation()}>
        {inner}
      </Link>
    ) : (
      <button
        type="button"
        title={title}
        className={cls}
        onClick={(e) => {
          e.stopPropagation();
          onClick!();
        }}
      >
        {inner}
      </button>
    );
  }
  return (
    <span className="text-sm text-text-muted" title={title}>
      {label}
    </span>
  );
}

/** One action in the floating bulk bar — white-on-navy ghost button. */
export function BulkAction({
  icon,
  label,
  onClick,
  danger,
}: {
  icon?: IconName;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium transition-colors hover:bg-white/10 ${
        danger ? "text-red-300 hover:text-red-200" : "text-white/90 hover:text-white"
      }`}
    >
      {icon && <Icon name={icon} size={14} />}
      {label}
    </button>
  );
}
