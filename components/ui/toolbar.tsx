import type { ReactNode } from "react";

// Catalog `Toolbar` (page variant) — the strip above an index Table:
// result count + SearchInput + FilterChips (children) + right actions.

export function Toolbar({
  count,
  countLabel = "results",
  actions,
  className = "",
  children,
}: {
  count?: number;
  countLabel?: string;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {count !== undefined && (
        <span className="text-sm text-text-muted">
          {count} {countLabel}
        </span>
      )}
      {children}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}
