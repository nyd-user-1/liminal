"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { Toggle } from "@/components/ui/toggle";
import { loadScribeSettings, ScribePanel } from "@/components/notes/scribe-panel";
import { CallControls } from "@/components/call/call-controls";
import { CallHeader } from "@/components/call/call-header";
import { useWebRTC } from "@/components/call/use-webrtc";
import { VideoTile } from "@/components/call/video-tile";
import type { AppointmentStatus, AvatarHue } from "@/lib/types";

// Full-viewport telehealth stage (near-black `--color-stage`, catalog §3b·67)
// shared by the practitioner page and the portal page. States: pre-join lobby
// (camera preview + mic/cam toggles + AI Scribe card + Join) → waiting →
// connected. Practitioner variant docks the AI Scribe panel on the right
// (open by default, collapsible from the top-right); client variant adds the
// visibility caption instead.

export interface CallAppointmentSummary {
  id: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  client: string;
  service: string;
  notesBrief: string | null;
}

/** Diagonal expand/collapse arrows — not in the foundation set, local SVG. */
function PanelArrowsSvg({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {open ? (
        // collapse: arrows pointing inward
        <>
          <path d="M10 3v7H3" />
          <path d="M10 10L3 3" />
          <path d="M14 21v-7h7" />
          <path d="M14 14l7 7" />
        </>
      ) : (
        // expand: arrows pointing outward
        <>
          <path d="M15 3h6v6" />
          <path d="M21 3l-7 7" />
          <path d="M9 21H3v-6" />
          <path d="M3 21l7-7" />
        </>
      )}
    </svg>
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
  const [copied, setCopied] = useState(false);
  // AI Scribe panel — docked beside the stage, open by default; the panel
  // owns the scribe state and reports the actual transcribing state back up.
  const [panelOpen, setPanelOpen] = useState(variant === "practitioner");
  const [recording, setRecording] = useState(false);
  const [scribeOnJoin, setScribeOnJoin] = useState(true); // lobby toggle
  const [alwaysOnDefault, setAlwaysOnDefault] = useState(true);
  const [autoStartScribe, setAutoStartScribe] = useState(false);
  const selfStream = call.displayStream ?? call.localStream;

  // Seed the lobby toggle from persisted scribe settings (after mount).
  useEffect(() => {
    if (variant !== "practitioner") return;
    const s = loadScribeSettings();
    setScribeOnJoin(s.alwaysOn);
    setAlwaysOnDefault(s.alwaysOn);
  }, [variant]);

  const join = () => {
    if (variant === "practitioner" && scribeOnJoin) {
      setAutoStartScribe(true);
      setPanelOpen(true);
    }
    void call.join();
  };

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
        {variant === "practitioner" && (
          <Card className="w-full max-w-2xl !p-5">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-text">Stenographer</p>
                <p className="text-sm text-text-muted">Provides live transcription.</p>
              </div>
              <Toggle checked={scribeOnJoin} onChange={setScribeOnJoin} />
            </div>
            <Divider className="my-4" />
            <div className="flex flex-col gap-2.5 text-sm text-text-body">
              <span className="flex items-center gap-2.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden />
                Stable connection
              </span>
              <span className="flex items-center gap-2.5">
                <Icon name="gear" size={16} className="shrink-0 text-text-muted" />
                AI Scribe is {alwaysOnDefault ? "always switched on" : "switched off by default"} for
                appointments
              </span>
            </div>
          </Card>
        )}
        <div className="flex flex-col items-center gap-3">
          <Button size="xl" leftIcon="video" className="min-w-56" onClick={join}>
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
    <div className="fixed inset-0 z-40 flex bg-stage">
      <div className="relative h-full min-w-0 flex-1 p-3 pt-16 pb-24 sm:p-4 sm:pt-16 sm:pb-24">
        <CallHeader
          title={title}
          startedAt={call.startedAt}
          participants={connected ? 2 : 1}
          visibilityNote={variant === "practitioner" ? "Only visible to you" : null}
          recording={variant === "practitioner" && recording}
          right={
            variant === "practitioner" ? (
              <button
                type="button"
                aria-label={panelOpen ? "Hide AI Scribe panel" : "Show AI Scribe panel"}
                title={panelOpen ? "Hide AI Scribe panel" : "Show AI Scribe panel"}
                onClick={() => setPanelOpen((o) => !o)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-field bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <PanelArrowsSvg open={panelOpen} />
              </button>
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

        {/* wrapper owns the positioning — VideoTile's root is `relative` */}
        <div className="absolute bottom-24 right-4 sm:right-6">
          <VideoTile
            stream={selfStream}
            name={selfName}
            hue={selfHue}
            size="thumbnail"
            label="You"
            muted
            mirrored={!call.sharing}
            videoOff={!call.camOn && !call.sharing}
          />
        </div>

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

      {/* Docked scribe panel — stays mounted while collapsed so a recording
          session keeps transcribing in the background. */}
      {variant === "practitioner" && (
        <aside
          className={`h-full w-[400px] shrink-0 border-l border-border bg-surface ${panelOpen ? "" : "hidden"}`}
        >
          <ScribePanel
            appointmentId={room}
            appointment={appointment}
            autoStart={autoStartScribe}
            onCollapse={() => setPanelOpen(false)}
            onRecordingChange={setRecording}
          />
        </aside>
      )}
    </div>
  );
}
