import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { SettingsCard } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { Tag } from "@/components/ui/tag";
import { TextLink } from "@/components/ui/text-link";
import { RECORD_RAIL_W } from "@/components/records/record-layout";
import { formatCents, formatDate, formatTime } from "@/lib/format";
import type { Appointment, Client, Invoice, Referral, ReferralStatus } from "@/lib/types";
import { ApptStatusBadge, FieldDisplay, InvoiceStatusBadge, formatDob, tagHue } from "../ui";
import { ContactMenu } from "./contact-menu";

const REFERRAL_BADGE: Record<ReferralStatus, "neutral" | "info" | "success" | "danger"> = {
  draft: "neutral",
  sent: "info",
  accepted: "success",
  declined: "danger",
};

// Overview tab — identity rail left, content right, the same shape the
// practitioner's record uses: the Contact card takes the record rail's width
// (RECORD_RAIL_W, shared with client-record.tsx) and the right column splits
// that card's height between Upcoming appointments and Billing summary, so the
// two columns end level. Referrals spans the full width beneath them.
// Server component; appointment and invoice data come from the sibling
// repos via page.tsx.
//
// The four sections are exported individually because the client BOARD mounts
// them as separate cards — the tab was always four cards in a grid, and a board
// is that grid with the arrangement handed to the practitioner. OverviewTab
// still composes them exactly as it did, which is what the patient portal
// renders. `bare` drops a section's own SettingsCard chrome for a host that is
// already a card and is drawing the title itself.

/** A section is a SettingsCard on the tab and a plain body on the board. */
function Section({
  bare,
  icon,
  title,
  action,
  className = "",
  fill = false,
  children,
}: {
  bare?: boolean;
  icon: "person-circle" | "calendar" | "dollar" | "globe";
  title: string;
  action?: ReactNode;
  className?: string;
  /**
   * This card is sized by its host, not its content (the Overview grid gives
   * the right column a half-share of the Contact card's height). The heading
   * stays pinned and the body scrolls, so a card that is handed less room than
   * its content wants shortens instead of pushing the column past its neighbour.
   */
  fill?: boolean;
  children: ReactNode;
}) {
  if (bare) return <>{children}</>;
  return (
    <SettingsCard
      icon={icon}
      title={title}
      action={action}
      className={`${fill ? "flex flex-col overflow-hidden" : ""} ${className}`}
    >
      {fill ? (
        <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">{children}</div>
      ) : (
        children
      )}
    </SettingsCard>
  );
}

export function ContactSection({
  client,
  practitionerName,
  readOnly = false,
  bare = false,
}: {
  client: Client;
  practitionerName: string | null;
  readOnly?: boolean;
  bare?: boolean;
}) {
  return (
    <Section
      bare={bare}
      icon="person-circle"
      title="Contact"
      className="h-full"
      action={readOnly ? undefined : <ContactMenu clientId={client.id} email={client.email} phone={client.phone} />}
    >
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
    </Section>
  );
}

export function UpcomingAppointments({
  appointments,
  bare = false,
  className,
  fill,
}: {
  appointments: Appointment[];
  bare?: boolean;
  className?: string;
  fill?: boolean;
}) {
  const now = Date.now();
  const upcoming = appointments
    .filter((a) => new Date(a.startsAt).getTime() >= now && a.status !== "cancelled" && a.status !== "no_show")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 5);
  const pastCount = appointments.filter((a) => new Date(a.startsAt).getTime() < now).length;

  return (
    <Section bare={bare} icon="calendar" title="Upcoming appointments" className={className} fill={fill}>
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
    </Section>
  );
}

export function BillingSummary({
  invoices,
  bare = false,
  action,
  className,
  fill,
}: {
  invoices: Invoice[];
  bare?: boolean;
  /** Overrides "View billing" — the board's Billing card is a card, not a tab. */
  action?: ReactNode;
  className?: string;
  fill?: boolean;
}) {
  const outstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + i.totalCents, 0);
  const paid = invoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.totalCents, 0);
  const recent = [...invoices]
    .sort((a, b) => (b.issuedOn ?? b.createdAt).localeCompare(a.issuedOn ?? a.createdAt))
    .slice(0, 3);

  return (
    <Section
      bare={bare}
      icon="dollar"
      title="Billing summary"
      action={action ?? <TextLink href="?tab=billing">View billing</TextLink>}
      className={className}
      fill={fill}
    >
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
                <span className="block text-sm text-text-muted">{i.issuedOn ? formatDate(i.issuedOn) : "Not issued"}</span>
              </span>
              <span className="text-[15px] font-semibold text-text">{formatCents(i.totalCents)}</span>
              <InvoiceStatusBadge status={i.status} />
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

export function ReferralsSection({ referrals, bare = false }: { referrals: Referral[]; bare?: boolean }) {
  return (
    <Section bare={bare} icon="globe" title="Referrals">
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
                <span className="block truncate text-[15px] font-semibold text-text">{r.targetName ?? "Referral"}</span>
                <span className="block text-sm text-text-muted">{formatDate(r.createdAt)}</span>
              </span>
              <Badge variant={REFERRAL_BADGE[r.status]}>{r.status[0].toUpperCase() + r.status.slice(1)}</Badge>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

export function OverviewTab({
  client,
  appointments,
  invoices,
  referrals,
  practitionerName,
  readOnly = false,
}: {
  client: Client;
  appointments: Appointment[];
  invoices: Invoice[];
  referrals: Referral[];
  practitionerName: string | null;
  /** Patient-portal variant: drops the staff ContactMenu (copy/email/log actions). */
  readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Contact is the identity rail — same width as the practitioner record's
          (RECORD_RAIL_W, imported rather than respelled) and, being the taller
          column, it sets the row height. The right column takes that height and
          splits it between two cards, so the two columns end flush instead of
          one trailing past the other. `min-h-0` is what lets the halves be
          halves: without it each card floors at its content height and the
          bottoms go ragged again. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
        <div className={`shrink-0 ${RECORD_RAIL_W}`}>
          <ContactSection client={client} practitionerName={practitionerName} readOnly={readOnly} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <UpcomingAppointments appointments={appointments} className="min-h-0 lg:flex-1" fill />
          <BillingSummary invoices={invoices} className="min-h-0 lg:flex-1" fill />
        </div>
      </div>
      <ReferralsSection referrals={referrals} />
    </div>
  );
}
