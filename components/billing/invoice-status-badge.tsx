import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus } from "@/lib/types";

// Invoice status → Badge variant. paid=success · sent=info (primary tint) ·
// overdue=danger · draft/void=neutral.

const map: Record<InvoiceStatus, { variant: "neutral" | "success" | "danger" | "info"; label: string }> = {
  draft: { variant: "neutral", label: "Draft" },
  sent: { variant: "info", label: "Sent" },
  paid: { variant: "success", label: "Paid" },
  overdue: { variant: "danger", label: "Overdue" },
  void: { variant: "neutral", label: "Void" },
};

export function InvoiceStatusBadge({ status, className = "" }: { status: InvoiceStatus; className?: string }) {
  const s = map[status];
  return (
    <Badge variant={s.variant} className={status === "void" ? `line-through opacity-70 ${className}` : className}>
      {s.label}
    </Badge>
  );
}
