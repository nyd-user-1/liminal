import type { ReactNode } from "react";

// Catalog `Toolbar` (page variant) — the strip above an index Table:
// SearchInput + FilterChips (children) + right actions.
// `count`/`countLabel` are accepted for API compatibility but no longer
// rendered (the result count was dropped from the toolbar).

export function Toolbar({
  count: _count,
  countLabel: _countLabel,
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
      {children}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}
