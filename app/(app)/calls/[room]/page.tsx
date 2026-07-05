import { redirect } from "next/navigation";
import { CallStage, type CallAppointmentSummary } from "@/components/call/call-stage";
import { getUser } from "@/lib/auth";
import { formatDate, formatTime } from "@/lib/format";
import { getAppointment } from "@/lib/repos/appointments";
import { getClient } from "@/lib/repos/clients";
import { getService } from "@/lib/repos/services";
import type { Appointment } from "@/lib/types";

// Practitioner telehealth call — the room id IS the appointment id, so the
// header title and the Appointment side panel come from getAppointment(room).
// Unknown rooms still work as ad-hoc "Video call" rooms.

export const dynamic = "force-dynamic";

export default async function PractitionerCallPage({ params }: { params: Promise<{ room: string }> }) {
  const { room } = await params;
  const user = await getUser();
  if (!user) redirect("/sign-in"); // (app) layout guards too — belt and braces

  let appt: Appointment | null = null;
  try {
    appt = await getAppointment(room);
  } catch {
    appt = null;
  }

  let clientName: string | null = null;
  let serviceName: string | null = null;
  if (appt) {
    // best-effort hydration — a missing client/service never blocks the call
    try {
      const client = await getClient(appt.clientId);
      if (client) clientName = `${client.firstName} ${client.lastName}`;
    } catch {}
    try {
      serviceName = (await getService(appt.serviceId))?.name ?? null;
    } catch {}
  }

  const appointment: CallAppointmentSummary | null = appt
    ? {
        id: appt.id,
        startsAt: appt.startsAt,
        endsAt: appt.endsAt,
        status: appt.status,
        client: clientName ?? appt.clientId,
        service: serviceName ?? appt.serviceId,
        notesBrief: appt.notesBrief,
      }
    : null;

  return (
    <CallStage
      room={room}
      variant="practitioner"
      title={clientName ? `Call with ${clientName}` : (serviceName ?? "Video call")}
      subtitle={appt ? `${formatDate(appt.startsAt)} · ${formatTime(appt.startsAt)}` : null}
      otherPartyName={clientName ?? "Your client"}
      waitingFor={clientName ?? "your client"}
      otherPartyHue="blue"
      selfName={user.name}
      selfHue={user.avatarHue}
      exitHref="/calendar"
      appointment={appointment}
    />
  );
}
