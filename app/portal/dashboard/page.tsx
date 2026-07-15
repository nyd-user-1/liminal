import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon, type IconName } from "@/components/ui/icons";
import { StatCard } from "@/components/ui/stat-card";
import { TextLink } from "@/components/ui/text-link";
import { formatCents, formatDate, formatDateLong, formatTime } from "@/lib/format";
import { listAppointments } from "@/lib/repos/appointments";
import { listFiles } from "@/lib/repos/files";
import { listResponses } from "@/lib/repos/forms";
import { clientBillingSummary } from "@/lib/repos/invoices";
import { authorNames, listNotes } from "@/lib/repos/notes";
import { listLocations, listServices } from "@/lib/repos/services";
import { listThreads } from "@/lib/repos/threads";
import { requirePortalClient } from "../data";

// Portal Dashboard — a warm client dashboard: greeting, next appointment
// (agenda visual language, coloured by visit type), a quick-stats/links row,
// and an upcoming mini-list. Server component; every tile deep-links into its
// page.
//
// This was /portal until the client record took over as home; it now sits at
// the foot of the portal nav as "Dashboard".

export const dynamic = "force-dynamic";

// Same visit-type palette as the appointments page: teal telehealth, amber
// in-person.
const VISIT_COLOR = { telehealth: "#3F8290", inPerson: "#E07B3C" } as const;
const colorFor = (videoRoom: string | null) => (videoRoom ? VISIT_COLOR.telehealth : VISIT_COLOR.inPerson);

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function PortalDashboardPage() {
  const { client } = await requirePortalClient();
  if (!client) {
    return (
      <EmptyState
        icon="person-circle"
        title="No client record is linked to this login"
        subtext="Ask your practice to connect your portal account."
      />
    );
  }

  const now = new Date().toISOString();
  const [appointments, responses, threads, billing, notes, files, services, locations] = await Promise.all([
    listAppointments({ clientId: client.id, from: now }),
    listResponses({ clientId: client.id }),
    listThreads({ clientId: client.id }),
    clientBillingSummary(client.id),
    listNotes({ clientId: client.id, status: "signed" }),
    listFiles(client.id),
    listServices(),
    listLocations(),
  ]);

  const upcoming = appointments
    .filter((a) => a.status !== "cancelled" && a.status !== "no_show")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const next = upcoming[0] ?? null;
  const names = await authorNames([...new Set(upcoming.map((a) => a.practitionerId))]);
  const serviceById = new Map(services.map((s) => [s.id, s]));
  const locationById = new Map(locations.map((l) => [l.id, l]));

  const serviceName = (id: string) => serviceById.get(id)?.name ?? "Appointment";
  const practitioner = (id: string) => names[id] ?? "your practitioner";

  const pendingForms = responses.filter((r) => r.status !== "submitted");
  const unread = threads.reduce((n, t) => n + t.unreadFromStaff, 0);
  const recordsCount = notes.length + files.length;
  const balance = billing.balanceCents;

  const stats: Array<{ label: string; value: ReactNode; href: string; icon: IconName; accent?: boolean }> = [
    {
      label: "Balance due",
      value: <span className={balance > 0 ? "text-danger" : undefined}>{formatCents(balance)}</span>,
      href: "/portal/invoices",
      icon: "credit-card",
      accent: balance > 0,
    },
    { label: "Unread messages", value: unread, href: "/portal/messages", icon: "message", accent: unread > 0 },
    {
      label: "Forms pending",
      value: pendingForms.length,
      href: "/portal/forms",
      icon: "file-text",
      accent: pendingForms.length > 0,
    },
    { label: "Records", value: recordsCount, href: "/portal/records", icon: "note" },
  ];

  const hour = new Date().getHours();

  return (
    <div className="space-y-6">
      {/* Greeting — not a page H1 (that lives in the TopBar strip) */}
      <div>
        <p className="text-[22px] font-bold tracking-tight text-text">
          {greeting(hour)}, {client.firstName}
        </p>
        <p className="mt-0.5 text-[15px] text-text-muted">Here&rsquo;s a look at your care.</p>
      </div>

      {pendingForms.length > 0 && (
        <Banner variant="warning" action={<TextLink href="/portal/forms">Open forms</TextLink>}>
          You have {pendingForms.length} form{pendingForms.length === 1 ? "" : "s"} to complete
          {pendingForms.length === 1 ? ` — “${pendingForms[0].formTitle}”` : ""}.
        </Banner>
      )}

      {/* Quick stats — each tile links into its page */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.href} href={s.href} className="block h-full">
            <StatCard
              className="h-full transition-shadow hover:shadow-menu"
              label={s.label}
              value={s.value}
              corner={<Icon name={s.icon} size={18} className={s.accent ? "text-primary" : "text-text-muted"} />}
            />
          </Link>
        ))}
      </div>

      {/* Next appointment + upcoming mini-list */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="flex flex-col gap-4 lg:col-span-3">
          <div className="flex items-center gap-2">
            <Icon name="calendar-check" size={19} className="text-primary" />
            <h2 className="text-[17px] font-semibold text-text">Next appointment</h2>
          </div>
          {next ? (
            <div className="flex items-stretch gap-3">
              <span className="w-1.5 shrink-0 rounded-full" style={{ background: colorFor(next.videoRoom) }} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[17px] font-semibold text-text">{serviceName(next.serviceId)}</span>
                  <Badge variant={next.videoRoom ? "info" : "warning"}>{next.videoRoom ? "Telehealth" : "In person"}</Badge>
                </div>
                <p className="mt-1 text-[15px] text-text-body">
                  {formatDateLong(next.startsAt)} · {formatTime(next.startsAt)}–{formatTime(next.endsAt)}
                </p>
                <p className="text-sm text-text-muted">
                  with {practitioner(next.practitionerId)}
                  {next.locationId && !next.videoRoom ? ` · ${locationById.get(next.locationId)?.name ?? ""}` : ""}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {next.videoRoom && (
                    <Link href={`/portal/call/${next.videoRoom}`}>
                      <Button size="sm" leftIcon="video">Join video call</Button>
                    </Link>
                  )}
                  <Link href={`/portal/appointments?appointment=${next.id}`}>
                    <Button size="sm" variant="secondary">View details</Button>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[7rem] flex-col justify-center">
              <p className="text-[15px] text-text-muted">Nothing scheduled — your care team will book with you.</p>
              <TextLink href="/portal/appointments" className="mt-2">
                View appointments
              </TextLink>
            </div>
          )}
        </Card>

        <Card className="flex flex-col gap-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold text-text">Upcoming</h2>
            <TextLink href="/portal/appointments">All</TextLink>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-[15px] text-text-muted">Nothing scheduled.</p>
          ) : (
            <div className="space-y-0.5">
              {upcoming.slice(0, 5).map((a) => (
                <Link
                  key={a.id}
                  href={`/portal/appointments?appointment=${a.id}`}
                  className="flex items-stretch gap-2.5 rounded-field px-2 py-1.5 transition-colors hover:bg-canvas"
                >
                  <span className="w-1 shrink-0 rounded-full" style={{ background: colorFor(a.videoRoom) }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-text">{serviceName(a.serviceId)}</span>
                    <span className="block truncate text-[13px] text-text-muted">
                      {formatDate(a.startsAt)} · {formatTime(a.startsAt)} · {practitioner(a.practitionerId)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
