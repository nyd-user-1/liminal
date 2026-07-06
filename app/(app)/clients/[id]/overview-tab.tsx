import { Badge } from "@/components/ui/badge";
import { SettingsCard } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { Tag } from "@/components/ui/tag";
import { formatCents, formatDate, formatTime } from "@/lib/format";
import type { Appointment, Client, Invoice, Referral, ReferralStatus } from "@/lib/types";
import { ApptStatusBadge, FieldDisplay, InvoiceStatusBadge, formatDob, tagHue } from "../ui";

const REFERRAL_BADGE: Record<ReferralStatus, "neutral" | "info" | "success" | "danger"> = {
  draft: "neutral",
  sent: "info",
  accepted: "success",
  declined: "danger",
};

// Overview tab — 2:1 grid: upcoming appointments + billing summary (left)
// beside a contact FieldDisplay card (right). Server component; appointment
// and invoice data come from the sibling repos via page.tsx.

export function OverviewTab({
  client,
  appointments,
  invoices,
  referrals,
  practitionerName,
}: {
  client: Client;
  appointments: Appointment[];
  invoices: Invoice[];
  referrals: Referral[];
  practitionerName: string | null;
}) {
  const now = Date.now();
  const upcoming = appointments
    .filter((a) => new Date(a.startsAt).getTime() >= now && a.status !== "cancelled" && a.status !== "no_show")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 5);
  const pastCount = appointments.filter((a) => new Date(a.startsAt).getTime() < now).length;

  const outstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + i.totalCents, 0);
  const paid = invoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.totalCents, 0);
  const recent = [...invoices]
    .sort((a, b) => (b.issuedOn ?? b.createdAt).localeCompare(a.issuedOn ?? a.createdAt))
    .slice(0, 3);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <SettingsCard icon="calendar" title="Upcoming appointments">
          {upcoming.length === 0 ? (
            <p className="text-[15px] text-text-muted">No upcoming appointments.</p>
          ) : (
            <div className="divide-y divide-border">
              {upcoming.map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-teal-100 text-primary">
                    <Icon name={a.videoRoom ? "video" : "calendar-check"} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-text">
                      {formatDate(a.startsAt)} · {formatTime(a.startsAt)} – {formatTime(a.endsAt)}
                    </span>
                    <span className="block truncate text-sm text-text-muted">
                      {a.videoRoom ? "Telehealth" : "In office"}
                      {a.notesBrief ? ` · ${a.notesBrief}` : ""}
                    </span>
                  </span>
                  <ApptStatusBadge status={a.status} />
                </div>
              ))}
            </div>
          )}
          {pastCount > 0 && (
            <p className="mt-4 border-t border-border pt-3 text-[13px] text-text-muted">
              {pastCount} past appointment{pastCount === 1 ? "" : "s"} on record
            </p>
          )}
        </SettingsCard>

        <SettingsCard icon="dollar" title="Billing summary">
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div className="rounded-field bg-canvas px-4 py-3">
              <div className="text-sm text-text-muted">Outstanding</div>
              <div className={`text-xl font-bold ${outstanding > 0 ? "text-danger" : "text-text"}`}>
                {formatCents(outstanding)}
              </div>
            </div>
            <div className="rounded-field bg-canvas px-4 py-3">
              <div className="text-sm text-text-muted">Paid to date</div>
              <div className="text-xl font-bold text-text">{formatCents(paid)}</div>
            </div>
          </div>
          {recent.length === 0 ? (
            <p className="text-[15px] text-text-muted">No invoices yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {recent.map((i) => (
                <div key={i.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-text">{i.number}</span>
                    <span className="block text-sm text-text-muted">
                      {i.issuedOn ? formatDate(i.issuedOn) : "Not issued"}
                    </span>
                  </span>
                  <span className="text-[15px] font-semibold text-text">{formatCents(i.totalCents)}</span>
                  <InvoiceStatusBadge status={i.status} />
                </div>
              ))}
            </div>
          )}
        </SettingsCard>

        <SettingsCard icon="globe" title="Referrals">
          {referrals.length === 0 ? (
            <p className="text-[15px] text-text-muted">No referrals yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {referrals.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-teal-100 text-primary">
                    <Icon name={r.targetKind === "provider" ? "person-circle" : "globe"} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-text">
                      {r.targetName ?? "Referral"}
                    </span>
                    <span className="block text-sm text-text-muted">{formatDate(r.createdAt)}</span>
                  </span>
                  <Badge variant={REFERRAL_BADGE[r.status]}>
                    {r.status[0].toUpperCase() + r.status.slice(1)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </SettingsCard>
      </div>

      <SettingsCard icon="person-circle" title="Contact" className="self-start">
        <div className="flex flex-col gap-4">
          <FieldDisplay label="Email" value={client.email} />
          <FieldDisplay label="Phone" value={client.phone} />
          <FieldDisplay label="Address" value={client.address} />
          <FieldDisplay label="Date of birth" value={client.dob ? formatDob(client.dob) : null} />
          <FieldDisplay label="Gender" value={client.gender} />
          <FieldDisplay label="Pronouns" value={client.pronouns} />
          <FieldDisplay label="Primary practitioner" value={practitionerName} />
          <FieldDisplay
            label="Tags"
            value={
              client.tags.length > 0 ? (
                <span className="mt-1 flex flex-wrap gap-1">
                  {client.tags.map((t) => (
                    <Tag key={t} hue={tagHue(t)}>
                      {t}
                    </Tag>
                  ))}
                </span>
              ) : null
            }
          />
        </div>
      </SettingsCard>
    </div>
  );
}
