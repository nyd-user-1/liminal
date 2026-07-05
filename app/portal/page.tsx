import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { TextLink } from "@/components/ui/text-link";
import { formatDateLong, formatTime } from "@/lib/format";
import { listAppointments } from "@/lib/repos/appointments";
import { listResponses } from "@/lib/repos/forms";
import { authorNames } from "@/lib/repos/notes";
import { getService } from "@/lib/repos/services";
import { listThreads } from "@/lib/repos/threads";
import { requirePortalClient } from "./data";

// Portal Home — next appointment, pending-forms Banner, unread-messages Card.

export const dynamic = "force-dynamic";

export default async function PortalHomePage() {
  const { client } = await requirePortalClient();
  if (!client) {
    return (
      <>
        <PageHeader icon="grid" title="Home" className="mb-6" />
        <EmptyState icon="person-circle" title="No client record is linked to this login" subtext="Ask your practice to connect your portal account." />
      </>
    );
  }

  const now = new Date().toISOString();
  const [appointments, responses, threads] = await Promise.all([
    listAppointments({ clientId: client.id, from: now }),
    listResponses({ clientId: client.id }),
    listThreads({ clientId: client.id }),
  ]);

  const next = appointments.find((a) => a.status !== "cancelled" && a.status !== "no_show");
  const [service, names] = await Promise.all([
    next ? getService(next.serviceId) : null,
    next ? authorNames([next.practitionerId]) : ({} as Record<string, string>),
  ]);

  const pendingForms = responses.filter((r) => r.status !== "submitted");
  const unread = threads.reduce((n, t) => n + t.unreadFromStaff, 0);

  return (
    <>
      <PageHeader icon="grid" title={`Welcome back, ${client.firstName}`} className="mb-6" />

      {pendingForms.length > 0 && (
        <Banner
          variant="warning"
          className="mb-5"
          action={<TextLink href="/portal/forms">Open forms</TextLink>}
        >
          You have {pendingForms.length} form{pendingForms.length === 1 ? "" : "s"} to complete
          {pendingForms.length === 1 ? ` — "${pendingForms[0].formTitle}"` : ""}.
        </Banner>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Icon name="calendar-check" size={19} className="text-primary" />
            <h2 className="text-[19px] font-semibold text-text">Next appointment</h2>
          </div>
          {next ? (
            <>
              <div>
                <p className="text-[15px] font-semibold text-text">
                  {service?.name ?? "Appointment"}
                  {next.videoRoom && (
                    <Badge variant="info" className="ml-2">Telehealth</Badge>
                  )}
                </p>
                <p className="mt-0.5 text-[15px] text-text-body">
                  {formatDateLong(next.startsAt)} · {formatTime(next.startsAt)}–{formatTime(next.endsAt)}
                </p>
                <p className="text-sm text-text-muted">
                  with {names[next.practitionerId] ?? "your practitioner"}
                </p>
              </div>
              <div className="mt-auto flex items-center gap-3 pt-1">
                {next.videoRoom && (
                  <Link href={`/portal/call/${next.videoRoom}`}>
                    <Button size="sm" leftIcon="video">Join video call</Button>
                  </Link>
                )}
                <TextLink href="/portal/appointments">View all appointments</TextLink>
              </div>
            </>
          ) : (
            <>
              <p className="text-[15px] text-text-muted">Nothing scheduled — your care team will book with you.</p>
              <TextLink href="/portal/appointments" className="mt-auto">View appointments</TextLink>
            </>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Icon name="message" size={19} className="text-primary" />
            <h2 className="text-[19px] font-semibold text-text">Messages</h2>
          </div>
          <p className="text-[15px] text-text-body">
            {unread > 0 ? (
              <>
                You have <span className="font-semibold text-text">{unread} unread message{unread === 1 ? "" : "s"}</span> from your care team.
              </>
            ) : (
              "You're all caught up."
            )}
          </p>
          <div className="mt-auto pt-1">
            <Link href="/portal/messages">
              <Button size="sm" variant={unread > 0 ? "primary" : "secondary"} leftIcon="message">
                Open messages
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
