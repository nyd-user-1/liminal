"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ColumnPicker } from "@/components/ui/column-picker";
import { SortableHead, Table, Td, Tr, useSort, type SortState } from "@/components/ui/table";
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
    return c.align === "right" ? <div className="flex justify-end">{inner}</div> : inner;
  });

  return (
    // min-w-0 is load-bearing: without it this flex child grows past its
    // container and the PAGE scrolls horizontally instead of the Table
    // primitive's own overflow-auto wrapper (docs/TASK-TABLE-STANDARD.md).
    <div className={`flex min-w-0 flex-col gap-3 ${className ?? ""}`}>
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
        {sortedRows.map((row) => (
          <Tr key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined} className={rowClassName?.(row)}>
            {shown.map((c) => (
              <Td key={c.key} className={`${c.align === "right" ? "text-right tabular-nums " : ""}${c.cellClassName ?? "whitespace-nowrap"}`}>
                {c.render(row)}
              </Td>
            ))}
          </Tr>
        ))}
      </Table>
      {footnote}
    </div>
  );
}
