"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NotesEditor, type NotesEditorHandle } from "@/components/notes-editor";
import { AskAiPanel } from "@/components/notes/ask-ai-panel";
import { ChapterList, deriveChapters, TranscriptPanel, TrendList, type TrendItem } from "@/components/notes/ai-bits";
import { AccordionSection } from "@/components/ui/accordion-section";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Icon, IconSquare } from "@/components/ui/icons";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { Modal } from "@/components/ui/modal";
import { Skeleton, Spinner } from "@/components/ui/spinner";
import { Tabs } from "@/components/ui/tabs";
import { TextLink } from "@/components/ui/text-link";
import { useToast } from "@/components/ui/toast";
import { formatDateTime, formatDateTimeNumeric } from "@/lib/format";
import type { Note, Transcript } from "@/lib/types";

// Catalog `BottomSheet` — full-screen slide-up document surface: dark top
// strip (× close / minimize-restore), client-name header + note meta, right
// actions (Save · Sign → confirm Modal), Tabs, page-like editor body with a
// hover KebabMenu on the note card, and an optional left `AIPanel` rail when
// the note's appointment has a transcript.

// Diagonal expand/collapse arrows (⤢) — not in the foundation icon set →
// local inline SVG (FLAG). Triggers minimize/restore.
const ExpandCollapseIcon = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="15 4 20 4 20 9" />
    <line x1="20" y1="4" x2="14" y2="10" />
    <polyline points="9 20 4 20 4 15" />
    <line x1="4" y1="20" x2="10" y2="14" />
  </svg>
);

interface SheetData {
  note: Note;
  author: string;
  client: string;
  transcript: Transcript | null;
}

function summaryTrends(transcript: Transcript): TrendItem[] {
  const ptsd = transcript.segments.some((s) => /prazosin|nightmare/i.test(s.text));
  return ptsd
    ? [
        { trend: "up", text: "Nightmares down to ~1/week on prazosin (from nightly)" },
        { trend: "done", text: "Orthostatic lightheadedness resolved after dose change" },
        { trend: "down", text: "Hypervigilance in crowds persists (subway at rush hour)" },
        { trend: "flat", text: "Grounding skills partially effective; continuing practice" },
      ]
    : [
        { trend: "up", text: "Baseline anxiety reduced after 2 weeks on sertraline 50 mg" },
        { trend: "done", text: "Early GI upset resolved; sleep normalized at ~7 hours" },
        { trend: "down", text: "Anticipatory spikes persist before work meetings" },
        { trend: "flat", text: "Afternoon flatness — monitoring, no dose change yet" },
      ];
}

export function NoteSheet({
  noteId,
  onClose,
  onChanged,
}: {
  noteId: string;
  onClose: () => void;
  /** Called after save / sign / delete so list surfaces can refresh. */
  onChanged?: () => void;
}) {
  const toast = useToast();
  const editorRef = useRef<NotesEditorHandle>(null);
  const [data, setData] = useState<SheetData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [signing, setSigning] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [tab, setTab] = useState("note");
  const [editorFocused, setEditorFocused] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [askContext, setAskContext] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`/api/notes/${noteId}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load note");
        if (!alive) return;
        setData(json);
        setTitle(json.note.title);
        setBodyMd(json.note.bodyMd);
        // AIPanel session summary "generates" briefly (skeleton per design)
        setTimeout(() => alive && setSummaryLoading(false), 900);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [noteId]);

  const note = data?.note ?? null;
  const locked = note?.status === "locked";

  const save = useCallback(async (): Promise<boolean> => {
    if (!note || locked) return true;
    setSaving(true);
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, bodyMd }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setData((d) => (d ? { ...d, note: json.note } : d));
      setDirty(false);
      onChanged?.();
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "danger");
      return false;
    } finally {
      setSaving(false);
    }
  }, [note, locked, title, bodyMd, onChanged, toast]);

  async function confirmSign() {
    if (!note) return;
    setSigning(true);
    try {
      if (dirty && !(await save())) return;
      const res = await fetch(`/api/notes/${note.id}/sign`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Sign failed");
      setData((d) => (d ? { ...d, note: json.note } : d));
      setSignOpen(false);
      onChanged?.();
      toast(json.note.status === "locked" ? "Note signed and locked" : "Note signed", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Sign failed", "danger");
    } finally {
      setSigning(false);
    }
  }

  async function remove() {
    if (!note) return;
    await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
    toast("Note deleted", "success");
    onChanged?.();
    onClose();
  }

  async function download() {
    if (!note) return;
    if (dirty && !locked && !(await save())) return;
    window.open(`/notes/${note.id}/print`, "_blank");
  }

  if (typeof document === "undefined") return null;

  // Minimized — a Gmail-style dock in the bottom-right corner, roughly a
  // quarter of the viewport, so the note stays visible (and its content
  // glanceable) instead of shrinking to a forgettable pill.
  if (minimized) {
    const preview = bodyMd.replace(/[#>*`_-]/g, "").trim();
    return createPortal(
      <div className="fixed bottom-0 right-4 z-50 flex h-[70vh] max-h-[520px] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-menu sm:right-6">
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 bg-sidebar-bg pl-3 pr-1">
          <button
            type="button"
            onClick={() => setMinimized(false)}
            aria-label="Restore note"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-field py-1 text-left"
          >
            <Icon name="note" size={16} className="shrink-0 text-sidebar-text" />
            <span className="truncate text-[13px] font-medium text-sidebar-text">{title || "Untitled note"}</span>
            {dirty && <span className="shrink-0 text-[11px] text-sidebar-text/70">· unsaved</span>}
          </button>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => setMinimized(false)}
              aria-label="Restore note"
              className="inline-flex h-8 w-8 items-center justify-center rounded-field text-sidebar-text transition-colors hover:bg-sidebar-active hover:text-white"
            >
              <Icon name="chevron-up" size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close note"
              className="inline-flex h-8 w-8 items-center justify-center rounded-field text-sidebar-text transition-colors hover:bg-sidebar-active hover:text-white"
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setMinimized(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setMinimized(false);
          }}
          className="min-h-0 flex-1 cursor-pointer overflow-hidden p-4 text-left transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          <p className="mb-1 truncate text-[13px] font-semibold text-text">{data?.client ?? "Loading…"}</p>
          <p className="line-clamp-6 whitespace-pre-line text-[13px] text-text-muted">
            {preview || "No content yet."}
          </p>
        </div>
      </div>,
      document.body,
    );
  }

  const statusBadge =
    note &&
    (note.status === "draft" ? (
      <Badge variant="warning">Draft</Badge>
    ) : (
      <Badge variant="success" className="gap-1">
        {note.status === "locked" && <Icon name="lock" size={12} />}
        {note.status === "locked" ? "Locked" : "Signed"}
      </Badge>
    ));

  return createPortal(
    <div className="fixed inset-0 z-50 bg-scrim">
      {/* nearly full-screen sheet — slides up from the bottom, small gap left at
          the top so it still reads as a sheet rather than a hard page swap */}
      <div className="sheet-rise absolute inset-x-0 bottom-0 top-6 flex flex-col overflow-hidden rounded-t-2xl shadow-menu sm:top-10">
      {/* dark top strip */}
      <div className="flex h-11 shrink-0 items-center justify-between bg-sidebar-bg px-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close note"
          className="inline-flex h-8 w-8 items-center justify-center rounded-field text-sidebar-text transition-colors hover:bg-sidebar-active hover:text-white"
        >
          <Icon name="x" size={18} />
        </button>
        <span className="text-[13px] font-medium text-sidebar-text">Clinical note</span>
        <button
          type="button"
          onClick={() => setMinimized(true)}
          aria-label="Minimize note"
          className="inline-flex h-8 w-8 items-center justify-center rounded-field text-sidebar-text transition-colors hover:bg-sidebar-active hover:text-white"
        >
          <ExpandCollapseIcon />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col bg-canvas">
        {error && <p className="p-10 text-center text-[15px] text-danger">{error}</p>}
        {!error && !note && (
          <div className="flex flex-1 items-center justify-center text-primary">
            <Spinner size={28} />
          </div>
        )}
        {note && data && (
          <>
            {/* doc header — client name (→ record Documentation tab) over note meta */}
            <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-6 py-3">
              <IconSquare name="note" />
              <div className="min-w-0 flex-1">
                <TextLink
                  href={`/clients/${note.clientId}?tab=documentation`}
                  onClick={onClose}
                  className="max-w-full truncate"
                >
                  {data.client}
                </TextLink>
                <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-text-muted">
                  <span>Note</span>
                  <span>·</span>
                  <span>{formatDateTimeNumeric(note.createdAt)}</span>
                  <span>·</span>
                  <span>{data.author}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {statusBadge}
                <span className="hidden text-[13px] text-text-muted sm:block">
                  {saving ? "Saving…" : dirty ? "Unsaved changes" : "Saved changes"}
                </span>
                {!locked && (
                  <>
                    <Button variant="secondary" size="sm" onClick={save} disabled={saving || !dirty}>
                      Save
                    </Button>
                    <Button size="sm" onClick={() => setSignOpen(true)} disabled={saving}>
                      {note.status === "draft" ? "Sign" : "Sign & lock"}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {data.transcript && (
              <div className="border-b border-border bg-surface px-6">
                <Tabs
                  className="!border-b-0"
                  active={tab}
                  onChange={setTab}
                  items={[
                    { key: "note", label: "Note" },
                    { key: "transcript", label: "Chapters & transcript" },
                  ]}
                />
              </div>
            )}

            <div className="relative flex min-h-0 flex-1">
              {/* AIPanel — left rail when a session transcript exists */}
              {data.transcript && (
                <aside className="hidden w-80 shrink-0 overflow-y-auto border-r border-border bg-surface p-4 lg:block">
                  <div className="mb-4 flex items-center gap-2.5">
                    <Avatar name={data.client} hue="teal" size="md" />
                    <span className="text-[15px] font-semibold text-text">{data.client}</span>
                  </div>
                  <Card className="mb-4 !p-4">
                    <p className="mb-3 text-sm font-semibold text-text">Session summary</p>
                    {summaryLoading ? (
                      <div className="space-y-2.5">
                        <Skeleton className="h-3.5 w-full" />
                        <Skeleton className="h-3.5 w-5/6" />
                        <Skeleton className="h-3.5 w-4/6" />
                        <Skeleton className="h-3.5 w-5/6" />
                      </div>
                    ) : (
                      <TrendList items={summaryTrends(data.transcript)} />
                    )}
                  </Card>
                  <AccordionSection title="Prior appointment" className="border-b border-border pb-4" defaultOpen={false}>
                    <p className="text-sm text-text-muted">No prior-appointment briefing yet.</p>
                  </AccordionSection>
                  <AccordionSection title="Chief complaint" className="pt-4" defaultOpen={false}>
                    <p className="text-sm text-text-body">
                      Follow-up on sleep, medication response, and daytime symptoms.
                    </p>
                  </AccordionSection>
                </aside>
              )}

              <main className="min-h-0 flex-1 overflow-y-auto">
                {tab === "note" ? (
                  <div
                    className={`group relative mx-auto my-6 min-h-[70%] max-w-3xl rounded-card border bg-surface p-8 shadow-card transition-colors ${
                      editorFocused ? "border-primary" : "border-border"
                    }`}
                  >
                    {/* hover kebab — top-right of the note card; stays visible while open */}
                    <div className="absolute right-3 top-3 z-10 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 has-[[aria-expanded=true]]:opacity-100">
                      <KebabMenu>
                        <MenuItem
                          icon="sparkle"
                          label="Ask AI"
                          onClick={() => {
                            setAskContext(editorRef.current?.getSelectionText() ?? "");
                            setAskOpen(true);
                          }}
                        />
                        <MenuItem
                          icon="copy"
                          label="Copy as Markdown"
                          onClick={() => {
                            navigator.clipboard?.writeText(bodyMd);
                            toast("Copied note markdown", "success");
                          }}
                        />
                        <MenuItem icon="download" label="Download / print PDF" onClick={download} />
                        {!locked && <MenuItem icon="trash" label="Delete note" danger onClick={remove} />}
                      </KebabMenu>
                    </div>
                    <div
                      onFocus={() => setEditorFocused(true)}
                      onBlur={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget)) setEditorFocused(false);
                      }}
                    >
                      <NotesEditor
                        key={`${note.id}:${locked}`}
                        ref={editorRef}
                        value={bodyMd}
                        readOnly={locked}
                        onChange={(md) => {
                          setBodyMd(md);
                          setDirty(true);
                        }}
                        onSave={save}
                      />
                    </div>
                  </div>
                ) : (
                  data.transcript && (
                    <div className="mx-auto my-6 max-w-3xl rounded-card border border-border bg-surface p-8 shadow-card">
                      <h3 className="mb-4 text-[16px] font-semibold text-text">Chapters</h3>
                      <ChapterList chapters={deriveChapters(data.transcript.segments)} />
                      <div className="my-6 h-px bg-border" />
                      {/* Transcript section — copy appears top-right on hover */}
                      <div className="group/transcript relative">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-[16px] font-semibold text-text">Transcript</h3>
                          <IconButton
                            icon="copy"
                            label="Copy transcript"
                            className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover/transcript:opacity-100"
                            onClick={() => {
                              navigator.clipboard?.writeText(
                                data.transcript!.segments.map((s) => `${s.speaker}: ${s.text}`).join("\n"),
                              );
                              toast("Copied transcript", "success");
                            }}
                          />
                        </div>
                        <TranscriptPanel segments={data.transcript.segments} />
                      </div>
                    </div>
                  )
                )}
              </main>
            </div>
          </>
        )}
      </div>
      </div>

      {/* sign / lock confirmation */}
      {note && (
        <Modal
          open={signOpen}
          onClose={() => setSignOpen(false)}
          title={note.status === "draft" ? "Sign this note?" : "Sign and lock?"}
          icon="lock"
          footer={
            <>
              <Button variant="secondary" onClick={() => setSignOpen(false)}>
                Cancel
              </Button>
              <Button onClick={confirmSign} loading={signing}>
                {note.status === "draft" ? "Sign note" : "Sign and lock"}
              </Button>
            </>
          }
        >
          <p className="text-[15px] text-text-body">
            {note.status === "draft"
              ? "Signing stamps this note with your name and the current time. You can still make corrections until it is locked."
              : "Locking makes this note a finalised record in the client's profile. It cannot be edited afterwards."}
          </p>
          <div className="mt-4 rounded-card border border-border p-4">
            <div className="flex items-center gap-2.5">
              <Avatar name={data?.client ?? "Client"} hue="teal" size="md" />
              <div>
                <p className="text-sm font-semibold text-text">{data?.client}</p>
                <p className="text-[13px] text-text-muted">{note && formatDateTime(note.createdAt)}</p>
              </div>
            </div>
            <div className="my-3 h-px bg-border" />
            <p className="text-[13px] text-text-muted">
              {note.status === "draft" ? "Signed" : "Completed"} by {data?.author} · {formatDateTime(new Date())}
            </p>
          </div>
        </Modal>
      )}

      <AskAiPanel
        open={askOpen}
        onClose={() => setAskOpen(false)}
        noteId={note?.id ?? null}
        context={askContext}
        onInsert={(md) => editorRef.current?.insertMarkdown(md)}
        onReplace={(md) => {
          if (askContext) editorRef.current?.replaceSelection(md);
          else editorRef.current?.insertMarkdown(md);
        }}
      />
    </div>,
    document.body,
  );
}
