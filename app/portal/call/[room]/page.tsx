import { redirect } from "next/navigation";
import { CallStage } from "@/components/call/call-stage";
import { getUser } from "@/lib/auth";
import { formatDate, formatTime } from "@/lib/format";
import { getAppointment } from "@/lib/repos/appointments";
import { listPractitioners } from "@/lib/repos/clients";
import type { Appointment } from "@/lib/types";

// Client-portal telehealth call — same stage minus the scribe/appointment
// panels; the client just sees the video, controls, and the visibility note.

export const dynamic = "force-dynamic";

export default async function PortalCallPage({ params }: { params: Promise<{ room: string }> }) {
  const { room } = await params;
  const user = await getUser();
  if (!user) redirect("/sign-in"); // portal layout guards too — belt and braces

  let appt: Appointment | null = null;
  try {
    appt = await getAppointment(room);
  } catch {
    appt = null;
  }

  let practitionerName: string | null = null;
  if (appt) {
    try {
      practitionerName = (await listPractitioners()).find((p) => p.id === appt.practitionerId)?.name ?? null;
    } catch {}
  }

  return (
    <CallStage
      room={room}
      variant="client"
      title={practitionerName ? `Call with ${practitionerName}` : "Video call"}
      subtitle={appt ? `${formatDate(appt.startsAt)} · ${formatTime(appt.startsAt)}` : null}
      otherPartyName={practitionerName ?? "Your practitioner"}
      waitingFor={practitionerName ?? "your practitioner"}
      otherPartyHue="teal"
      selfName={user.name}
      selfHue={user.avatarHue}
      exitHref="/portal"
    />
  );
}
