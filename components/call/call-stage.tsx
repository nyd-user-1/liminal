"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { SidePanel } from "@/components/ui/side-panel";
import { Spinner } from "@/components/ui/spinner";
import { ScribePanel } from "@/components/notes/scribe-panel";
import { CallControls } from "@/components/call/call-controls";
import { CallHeader } from "@/components/call/call-header";
import { useWebRTC } from "@/components/call/use-webrtc";
import { VideoTile } from "@/components/call/video-tile";
import { formatDateLong, formatTime } from "@/lib/format";
import type { AppointmentStatus, AvatarHue } from "@/lib/types";

// Full-viewport telehealth stage (near-black `--color-stage`, catalog §3b·67)
// shared by the practitioner page and the portal page. States: pre-join lobby
// (camera preview + mic/cam toggles + Join) → waiting (spinner over the
// remote tile) → connected. Practitioner variant adds the AI Scribe and
// Appointment SidePanels; client variant adds the visibility caption.

export interface CallAppointmentSummary {
  id: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  client: string;
  service: string;
  notesBrief: string | null;
}

const statusVariant: Record<AppointmentStatus, "info" | "success" | "neutral" | "danger" | "warning"> = {
  scheduled: "info",
  confirmed: "success",
  arrived: "info",
  completed: "neutral",
  cancelled: "danger",
  no_show: "warning",
};

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-text-muted">{label}</span>
      <span className="text-[15px] text-text">{children}</span>
    </div>
  );
}

export function CallStage({
  room,
  variant,
  title,
  subtitle,
  otherPartyName,
  waitingFor,
  otherPartyHue = "blue",
  selfName,
  selfHue = "teal",
  exitHref,
  appointment = null,
}: {
  room: string;
  variant: "practitioner" | "client";
  title: string;
  subtitle?: string | null;
  otherPartyName: string;
  waitingFor?: string; // mid-sentence form for "Waiting for … to join"
  otherPartyHue?: AvatarHue;
  selfName: string;
  selfHue?: AvatarHue;
  exitHref: string;
  appointment?: CallAppointmentSummary | null;
}) {
  const router = useRouter();
  const call = useWebRTC(room);
  const [panel, setPanel] = useState<"scribe" | "appointment" | null>(null);
  const [copied, setCopied] = useState(false);
  const selfStream = call.displayStream ?? call.localStream;

  const endCall = () => {
    call.leave();
    router.push(exitHref);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — no-op
    }
  };

  // ── pre-join lobby ──────────────────────────────────────────────────────────
  if (call.status === "lobby") {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 overflow-y-auto bg-stage p-6">
        <div className="text-center">
          <h1 className="text-[28px] font-bold text-white">Ready to join?</h1>
          <p className="mt-1 text-[15px] text-white/60">
            {title}
            {subtitle ? ` · ${subtitle}` : ""}
          </p>
        </div>
        <div className="aspect-video w-full max-w-2xl">
          <VideoTile
            stream={call.localStream}
            name={selfName}
            hue={selfHue}
            label="You"
            muted
            mirrored
            videoOff={!call.camOn}
          >
            {call.mediaError && (
              <p className="absolute inset-x-4 top-4 rounded-field bg-black/60 px-3 py-2 text-center text-[13px] text-white/80">
                {call.mediaError}
              </p>
            )}
            <CallControls
              micOn={call.micOn}
              camOn={call.camOn}
              onToggleMic={call.toggleMic}
              onToggleCam={call.toggleCam}
              className="absolute inset-x-0 bottom-4"
            />
          </VideoTile>
        </div>
        <div className="flex flex-col items-center gap-3">
          <Button size="xl" leftIcon="video" className="min-w-56" onClick={() => void call.join()}>
            Join call
          </Button>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white/60 transition-colors hover:text-white"
          >
            <Icon name={copied ? "check" : "link"} size={16} />
            {copied ? "Link copied" : "Copy link to share call"}
          </button>
        </div>
      </div>
    );
  }

  // ── left / ended ────────────────────────────────────────────────────────────
  if (call.status === "ended") {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-stage p-6">
        <h1 className="text-[28px] font-bold text-white">You left the call</h1>
        <Button variant="secondary" onClick={() => router.push(exitHref)}>
          Back to {variant === "practitioner" ? "calendar" : "portal"}
        </Button>
      </div>
    );
  }

  // ── in call (waiting / connecting / connected) ──────────────────────────────
  const connected = call.status === "connected";
  return (
    <div className="fixed inset-0 z-40 bg-stage">
      <div className="relative h-full w-full p-3 pt-16 pb-24 sm:p-4 sm:pt-16 sm:pb-24">
        <CallHeader
          title={title}
          startedAt={call.startedAt}
          participants={connected ? 2 : 1}
          visibilityNote={variant === "practitioner" ? "Only visible to you" : null}
          recording={variant === "practitioner" && panel === "scribe"}
          right={
            variant === "practitioner" ? (
              <>
                <Button size="sm" leftIcon="sparkle" onClick={() => setPanel("scribe")}>
                  AI Scribe
                </Button>
                <Button size="sm" variant="secondary" leftIcon="calendar" onClick={() => setPanel("appointment")}>
                  Appointment
                </Button>
              </>
            ) : null
          }
        />

        <VideoTile
          stream={call.remoteStream}
          name={otherPartyName}
          hue={otherPartyHue}
          videoOff={!connected}
        >
          {!connected && (
            <div className="absolute inset-x-0 bottom-1/4 flex flex-col items-center gap-3 text-white/70">
              <Spinner size={28} />
              <p className="text-[15px]">Waiting for {waitingFor ?? otherPartyName} to join…</p>
            </div>
          )}
        </VideoTile>

        <VideoTile
          stream={selfStream}
          name={selfName}
          hue={selfHue}
          size="thumbnail"
          label="You"
          muted
          mirrored={!call.sharing}
          videoOff={!call.camOn && !call.sharing}
          className="absolute bottom-24 right-4 sm:right-6"
        />

        {variant === "client" && (
          <p className="pointer-events-none absolute inset-x-0 bottom-[4.5rem] text-center text-[13px] text-white/50">
            Your practitioner can see and hear you
          </p>
        )}

        <CallControls
          micOn={call.micOn}
          camOn={call.camOn}
          sharing={call.sharing}
          onToggleMic={call.toggleMic}
          onToggleCam={call.toggleCam}
          onToggleShare={() => void call.toggleShare()}
          onEnd={endCall}
          className="absolute inset-x-0 bottom-5"
        />
      </div>

      {variant === "practitioner" && (
        <>
          <SidePanel
            open={panel === "scribe"}
            onClose={() => setPanel(null)}
            title="AI Scribe"
            icon="sparkle"
            width="max-w-md"
          >
            <ScribePanel appointmentId={room} />
          </SidePanel>
          <SidePanel
            open={panel === "appointment"}
            onClose={() => setPanel(null)}
            title="Appointment"
            icon="calendar"
            width="max-w-md"
          >
            {appointment ? (
              <div className="flex flex-col gap-5">
                <DetailRow label="Time">
                  {formatDateLong(appointment.startsAt)}
                  <br />
                  {formatTime(appointment.startsAt)} – {formatTime(appointment.endsAt)}
                </DetailRow>
                <DetailRow label="Status">
                  <Badge variant={statusVariant[appointment.status]} className="capitalize">
                    {appointment.status.replace("_", " ")}
                  </Badge>
                </DetailRow>
                <DetailRow label="Client">{appointment.client}</DetailRow>
                <DetailRow label="Service">{appointment.service}</DetailRow>
                {appointment.notesBrief && <DetailRow label="Notes">{appointment.notesBrief}</DetailRow>}
              </div>
            ) : (
              <p className="text-[15px] text-text-body">
                No appointment is linked to this call — the room id doesn&apos;t match a scheduled appointment.
              </p>
            )}
          </SidePanel>
        </>
      )}
    </div>
  );
}
