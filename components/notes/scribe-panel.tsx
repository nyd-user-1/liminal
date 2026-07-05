"use client";

import { useEffect, useRef, useState } from "react";
import { mmss, TranscriptPanel } from "@/components/notes/ai-bits";
import { NoteSheet } from "@/components/notes/note-sheet";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { FieldLabel } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import type { TranscriptSegment } from "@/lib/types";

// AI Scribe (catalog §3b) — lives in the practitioner call's SidePanel.
// Contract: <ScribePanel appointmentId={string} /> (room id IS the
// appointment id). Flow: settings (note type / perspective / detail
// ChoiceChips) → Start → recording (pulse + timer + live TranscriptPanel
// polling the transcribe stub) → End session → generate-note → success
// Banner whose View opens the drafted note in the NoteSheet.

type Phase = "setup" | "recording" | "generating" | "done";

const NOTE_TYPES = [
  { value: "soap", label: "SOAP" },
  { value: "dap", label: "DAP" },
  { value: "progress", label: "Progress" },
] as const;
const PERSPECTIVES = ["Third person", "First person"] as const;
const DETAIL = ["Concise", "Standard", "Detailed"] as const;

const POLL_EVERY_S = 3; // live-transcript poll cadence (stub replays a script)

function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: readonly T[] | ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.value;
          const l = typeof o === "string" ? o : o.label;
          return (
            <ChoiceChip
              key={v}
              label={l}
              selected={value === v}
              onSelect={() => !disabled && onChange(v)}
              className={disabled ? "pointer-events-none opacity-60" : ""}
            />
          );
        })}
      </div>
    </div>
  );
}

export function ScribePanel({ appointmentId }: { appointmentId: string }) {
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>("setup");
  const [noteType, setNoteType] = useState<(typeof NOTE_TYPES)[number]["value"]>("soap");
  const [perspective, setPerspective] = useState<(typeof PERSPECTIVES)[number]>("Third person");
  const [detail, setDetail] = useState<(typeof DETAIL)[number]>("Standard");
  const [elapsed, setElapsed] = useState(0);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [scriptDone, setScriptDone] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);

  // Poll bookkeeping lives in refs so the 1s ticker stays a single interval.
  const pollBusy = useRef(false);
  const pollDone = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase !== "recording") return;
    pollDone.current = false;
    const startedAt = Date.now();

    const poll = async (secs: number) => {
      if (pollBusy.current || pollDone.current) return;
      pollBusy.current = true;
      try {
        // STUB backend — wire ASR key in app/api/ai/transcribe (replays a script).
        const res = await fetch("/api/ai/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appointmentId, elapsed: secs }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Transcription failed");
        setSegments(json.segments);
        if (json.done) {
          pollDone.current = true;
          setScriptDone(true);
        }
      } catch {
        // transient poll failure — next tick retries
      } finally {
        pollBusy.current = false;
      }
    };

    poll(0);
    const timer = setInterval(() => {
      const secs = Math.round((Date.now() - startedAt) / 1000);
      setElapsed(secs);
      if (secs % POLL_EVERY_S === 0) void poll(secs);
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, appointmentId]);

  // Keep the live transcript pinned to the newest utterance.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [segments]);

  function start() {
    setSegments([]);
    setElapsed(0);
    setScriptDone(false);
    setPhase("recording");
  }

  async function endSession() {
    setPhase("generating");
    try {
      // STUB backend — wire LLM key in app/api/ai/generate-note.
      const res = await fetch("/api/ai/generate-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          template: noteType,
          perspective: perspective.toLowerCase().replace(" ", "-"),
          verbosity: detail.toLowerCase(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Note generation failed");
      if (!json.note) throw new Error("Could not match this session to a client record.");
      setNoteId(json.note.id);
      setPhase("done");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Note generation failed", "danger");
      setPhase("recording");
    }
  }

  return (
    <div className="flex h-full flex-col gap-5">
      {phase === "setup" && (
        <>
          <p className="text-[15px] text-text-body">
            AI Scribe listens to the session, builds a live transcript, and drafts a clinical note
            when you end. Nothing is filed until you review and sign.
          </p>
          <ChipRow label="Note type" options={NOTE_TYPES} value={noteType} onChange={setNoteType} />
          <ChipRow label="Perspective" options={PERSPECTIVES} value={perspective} onChange={setPerspective} />
          <ChipRow label="Detail level" options={DETAIL} value={detail} onChange={setDetail} />
          <Button leftIcon="mic" fullWidth onClick={start} className="mt-1">
            Start session
          </Button>
          <p className="text-[13px] text-text-muted">
            Make sure the client has consented to AI-assisted note taking.
          </p>
        </>
      )}

      {(phase === "recording" || phase === "generating") && (
        <>
          <div className="flex items-center gap-3 rounded-card border border-border bg-canvas px-4 py-3">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-danger" />
            </span>
            <span className="text-[15px] font-semibold text-text">
              {phase === "generating" ? "Session ended" : "Recording"}
            </span>
            <span className="ml-auto font-mono text-sm text-text-muted">{mmss(elapsed)}</span>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto rounded-card border border-border p-4">
            {segments.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-text-muted">
                <Icon name="mic" size={16} className="text-primary" />
                Listening — the transcript will appear here…
              </p>
            ) : (
              <TranscriptPanel segments={segments} />
            )}
            {scriptDone && (
              <p className="mt-4 text-[13px] text-text-muted">Session audio idle — ready to end.</p>
            )}
          </div>

          {phase === "recording" ? (
            <Button variant="danger-solid" leftIcon="stop" fullWidth onClick={endSession}>
              End session &amp; draft note
            </Button>
          ) : (
            <div className="flex items-center justify-center gap-2.5 py-2 text-[15px] font-medium text-primary">
              <Spinner size={18} />
              Drafting {NOTE_TYPES.find((t) => t.value === noteType)?.label} note…
            </div>
          )}
        </>
      )}

      {phase === "done" && (
        <>
          <Banner
            variant="success"
            action={
              <Button variant="secondary" size="sm" onClick={() => setViewing(true)}>
                View note
              </Button>
            }
          >
            Draft note created from this session.
          </Banner>
          <div className="rounded-card border border-border p-4">
            <p className="mb-2 text-sm font-semibold text-text">Session transcript</p>
            <div className="max-h-64 overflow-y-auto">
              <TranscriptPanel segments={segments} />
            </div>
          </div>
          <Button variant="ghost" leftIcon="mic" onClick={start}>
            Start another session
          </Button>
        </>
      )}

      {viewing && noteId && <NoteSheet noteId={noteId} onClose={() => setViewing(false)} />}
    </div>
  );
}
