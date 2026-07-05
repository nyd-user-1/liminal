import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icons";
import type { TagHue } from "@/components/ui/tag";
import { isoDateOnly } from "@/lib/format";
import type { AppointmentStatus, AvatarHue, ClientStatus, InvoiceStatus, PolicyStatus } from "@/lib/types";

// Clients-area presentation helpers: FieldDisplay (catalog §3 molecule — the
// UI kit doesn't ship it) + stable hue/variant mappings.

/** Catalog `FieldDisplay` — label (14 muted) over value (15); "–" when empty. */
export function FieldDisplay({ label, value }: { label: string; value?: ReactNode }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div>
      <div className="text-sm text-text-muted">{label}</div>
      <div className="mt-0.5 text-[15px] text-text">{empty ? "–" : value}</div>
    </div>
  );
}

const CLIENT_STATUS: Record<ClientStatus, { label: string; variant: "info" | "success" | "neutral" }> = {
  lead: { label: "Lead", variant: "info" },
  active: { label: "Active", variant: "success" },
  archived: { label: "Archived", variant: "neutral" },
};

export function ClientStatusBadge({
  status,
  withChevron,
  className = "",
}: {
  status: ClientStatus;
  withChevron?: boolean;
  className?: string;
}) {
  const s = CLIENT_STATUS[status];
  return (
    <Badge variant={s.variant} className={className}>
      {s.label}
      {withChevron && <Icon name="chevron-down" size={14} />}
    </Badge>
  );
}

const POLICY_STATUS: Record<PolicyStatus, { label: string; variant: "success" | "warning" | "neutral" }> = {
  verified: { label: "Verified", variant: "success" },
  unverified: { label: "Unverified", variant: "warning" },
  inactive: { label: "Inactive", variant: "neutral" },
};

export function PolicyStatusBadge({ status }: { status: PolicyStatus }) {
  const s = POLICY_STATUS[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

const APPT_STATUS: Record<
  AppointmentStatus,
  { label: string; variant: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  scheduled: { label: "Scheduled", variant: "neutral" },
  confirmed: { label: "Confirmed", variant: "info" },
  arrived: { label: "Arrived", variant: "info" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "danger" },
  no_show: { label: "No show", variant: "warning" },
};

export function ApptStatusBadge({ status }: { status: AppointmentStatus }) {
  const s = APPT_STATUS[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

const INVOICE_STATUS: Record<InvoiceStatus, { label: string; variant: "neutral" | "info" | "success" | "danger" }> = {
  draft: { label: "Draft", variant: "neutral" },
  sent: { label: "Sent", variant: "info" },
  paid: { label: "Paid", variant: "success" },
  overdue: { label: "Overdue", variant: "danger" },
  void: { label: "Void", variant: "neutral" },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const s = INVOICE_STATUS[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const AVATAR_HUES: AvatarHue[] = ["teal", "amber", "pink", "blue"];

/** Stable per-client avatar hue (clients have no avatar_hue column). */
export function clientHue(id: string): AvatarHue {
  return AVATAR_HUES[hash(id) % AVATAR_HUES.length];
}

const TAG_HUES: TagHue[] = ["yellow", "pink", "green", "teal", "cyan", "blue", "orange", "violet"];

/** Stable pastel hue for a taxonomy tag. */
export function tagHue(tag: string): TagHue {
  return TAG_HUES[hash(tag) % TAG_HUES.length];
}

/** "1994-03-18" → "Mar 18, 1994 (32)" — dob is a plain date, not a timestamp.
 * Defensive: also accepts a Date (DB drivers) or a malformed value → "–". */
export function formatDob(dob: string | Date): string {
  const [y, m, d] = (isoDateOnly(dob) ?? "").split("-").map(Number);
  if (!y || Number.isNaN(y)) return "–";
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const now = new Date();
  let age = now.getFullYear() - y;
  const birthdayPassed =
    now.getMonth() > date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() >= date.getDate());
  if (!birthdayPassed) age -= 1;
  const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${label} (${age})`;
}
