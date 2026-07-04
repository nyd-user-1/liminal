"use client";

import { IconButton } from "@/components/ui/icon-button";

// Catalog `Pagination` — prev/next chevrons + range label under a Table.

export function Pagination({
  page,
  pageCount,
  onPageChange,
  className = "",
}: {
  page: number; // 1-based
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-end gap-2 ${className}`}>
      <span className="text-sm text-text-muted">
        Page {page} of {Math.max(pageCount, 1)}
      </span>
      <IconButton icon="chevron-left" label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)} />
      <IconButton
        icon="chevron-right"
        label="Next page"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      />
    </div>
  );
}
