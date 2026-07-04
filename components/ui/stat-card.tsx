import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

// Catalog `StatCard` — KPI card: value 32/700 + muted label + optional
// top-right slot (Tag/Badge). Rows of them head dashboards.

export function StatCard({
  label,
  value,
  corner,
  className = "",
}: {
  label: string;
  value: ReactNode;
  corner?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-5 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-text-muted">{label}</span>
        {corner}
      </div>
      <div className="mt-1 text-[32px] font-bold leading-tight text-text">{value}</div>
    </Card>
  );
}
