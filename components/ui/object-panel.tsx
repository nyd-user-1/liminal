import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

// The drill-down record's OBJECT PANEL — the anchor card that names the record
// in the left rail beside the DrillDownScaffold's content. One anatomy for
// every entity (org, provider, employer, …): a Card whose scrolling body opens
// with a bold wrapping title + an optional kebab in the top-right corner (its
// menu slot) and an optional muted subtitle, over a flat gap-4 column of
// label-over-value fields the caller composes, closed by an optional provenance
// footer. The footer's py-2.5 matches the table footer beside it (Table
// standard) so the two bottoms line up.
//
// No hooks / no "use client": a server component (OrgRail, EmployerRail) can
// render it directly and pass a client `menu` (KebabMenu) as a prop.
export function ObjectPanel({
  title,
  subtitle,
  menu,
  footer,
  children,
}: {
  /** The record's name — bold, wraps (never truncated). */
  title: ReactNode;
  /** Muted line under the title (a credential, an identifier). */
  subtitle?: ReactNode;
  /** Top-right kebab (a `KebabMenu`) — the panel's action home. */
  menu?: ReactNode;
  /** Provenance line — data source / freshness. */
  footer?: ReactNode;
  /** `ObjectField` rows and caller-composed sections. */
  children: ReactNode;
}) {
  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden !p-0">
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mb-5">
          <div className="flex items-start gap-2.5">
            <h2 className="min-w-0 flex-1 text-[16px] font-semibold leading-snug text-text">{title}</h2>
            {menu && <div className="-mr-1.5 -mt-1 shrink-0">{menu}</div>}
          </div>
          {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
        </div>

        <div className="flex flex-col gap-4">{children}</div>
      </div>

      {footer && (
        <div className="shrink-0 border-t border-border px-6 py-2.5 text-[13px] text-text-muted">{footer}</div>
      )}
    </Card>
  );
}

// A label-over-value row (the object panel's field idiom; mirrors the shared
// FieldDisplay). Value defaults to text-text; pass any node — a link, a badge.
export function ObjectField({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="text-sm text-text-muted">{label}</div>
      <div className="mt-0.5 text-[15px] leading-relaxed text-text">{children}</div>
    </div>
  );
}
