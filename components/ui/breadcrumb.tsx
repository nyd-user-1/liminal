"use client";

import Link from "next/link";

// Catalog `Breadcrumb` — muted link trail + › separators above PageHeader;
// current page is the last, unlinked item. Items link via href or, for
// in-place views (library form builder), act via onClick.

export function Breadcrumb({
  items,
  className = "",
}: {
  items: Array<{ label: string; href?: string; onClick?: () => void }>;
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-1.5 text-sm ${className}`}>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-text-muted">›</span>}
          {item.href ? (
            <Link href={item.href} className="text-text-muted transition-colors hover:text-primary">
              {item.label}
            </Link>
          ) : item.onClick ? (
            <button
              type="button"
              onClick={item.onClick}
              className="text-text-muted transition-colors hover:text-primary"
            >
              {item.label}
            </button>
          ) : (
            <span className="font-medium text-text-body">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
