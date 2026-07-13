import { useEffect, useRef, useState, type ReactNode, type TdHTMLAttributes } from "react";
import { Icon } from "@/components/ui/icons";

// Catalog `Table` — teal 14/600 header text on a surface-fill row, white
// rows with hairline dividers + hover fill. Compose: <Table
// head={["Name","Status",""]}><Tr><Td>…</Td></Tr></Table>. No pagination —
// pair with lazy-loaded batches (see `useLazyBatch`/`useSentinel` below) and
// a sentinel row instead. Pass `stickyHeader` (with a height-bounded
// `className`, e.g. `flex-1 min-h-0`) for a fixed header the rows scroll
// under — the header fill sits on the `th` cells so it stays opaque through
// the scroll. For sortable columns, pass a `SortableHead` element as that
// column's head entry (pairs with the `useSort` hook).

export function Table({
  head,
  className = "",
  stickyHeader = false,
  children,
}: {
  head: ReactNode[];
  className?: string;
  stickyHeader?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`no-scrollbar overflow-auto rounded-card border border-border bg-surface shadow-card ${className}`}>
      <table className="w-full border-collapse text-left">
        <thead className={stickyHeader ? "sticky top-0 z-10" : ""}>
          <tr>
            {head.map((h, i) => (
              <th key={i} className="border-b border-border bg-surface px-4 py-3 text-sm font-semibold text-primary">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Tr({
  onClick,
  className = "",
  children,
}: {
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-border transition-colors last:border-b-0 hover:bg-canvas ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {children}
    </tr>
  );
}

export function Td({ className = "", children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-4 py-3.5 text-[15px] text-text-body ${className}`} {...rest}>
      {children}
    </td>
  );
}

// ── sorting ──────────────────────────────────────────────────────────────────
// Click a header to sort by it; click the active column again to flip
// direction. One shared mechanic (state + the header button) — sort
// comparators stay per-page since row shapes differ.

export type SortDir = "asc" | "desc";
export interface SortState<Col extends string> {
  col: Col;
  dir: SortDir;
}

export function useSort<Col extends string>(initial: SortState<Col>) {
  const [sort, setSort] = useState<SortState<Col>>(initial);
  const toggleSort = (col: Col) =>
    setSort((s) => (s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" }));
  return [sort, toggleSort] as const;
}

/** Clickable, sort-aware column header — pass as a `head` entry. Faint
 *  chevron hints sortability; solid chevron shows the active column + direction. */
export function SortableHead<Col extends string>({
  label,
  col,
  sort,
  onSort,
  className = "",
}: {
  label: string;
  col: Col;
  sort: SortState<Col>;
  onSort: (col: Col) => void;
  className?: string;
}) {
  const active = sort.col === col;
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className={`-mx-1 flex items-center gap-1 whitespace-nowrap rounded px-1 transition-colors hover:text-primary-hover ${className}`}
    >
      {label}
      <Icon name={active && sort.dir === "asc" ? "chevron-up" : "chevron-down"} size={14} className={active ? "" : "opacity-30"} />
    </button>
  );
}

// ── lazy-load ────────────────────────────────────────────────────────────────
// No pagination anywhere — grow the rendered set when a sentinel row (last
// child of the table body) scrolls into view.

/** Observes a sentinel `<tr>` and fires `onIntersect` while `enabled`. The
 *  callback ref avoids re-subscribing on every render. */
export function useSentinel(onIntersect: () => void, enabled: boolean) {
  const ref = useRef<HTMLTableRowElement>(null);
  const cbRef = useRef(onIntersect);
  cbRef.current = onIntersect;
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) cbRef.current();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);
  return ref;
}

/** Client-side batch growth over an already-filtered/sorted array. Pass
 *  `resetKey` (e.g. a join of active filter values) to snap back to the
 *  first batch when filters change. */
export function useLazyBatch<T>(items: T[], opts?: { batchSize?: number; resetKey?: unknown }) {
  const batchSize = opts?.batchSize ?? 50;
  const [limit, setLimit] = useState(batchSize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setLimit(batchSize), [opts?.resetKey]);

  const visible = items.slice(0, limit);
  const hasMore = items.length > limit;
  const sentinelRef = useSentinel(() => setLimit((l) => l + batchSize), hasMore);

  return { visible, hasMore, sentinelRef };
}

/** Loading-more sentinel row — render as the last child inside `<Table>` when `hasMore`. */
export function LoadMoreRow({ sentinelRef, colSpan }: { sentinelRef: React.RefObject<HTMLTableRowElement | null>; colSpan: number }) {
  return (
    <tr ref={sentinelRef}>
      <td colSpan={colSpan} className="px-4 py-3 text-center text-sm text-text-muted">
        Loading more…
      </td>
    </tr>
  );
}
