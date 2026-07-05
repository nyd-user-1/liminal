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
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";
import type { Note, Transcript } from "@/lib/types";

// Catalog `BottomSheet` — full-screen slide-up document surface: dark top
// strip (× close / minimize), doc title + meta, right actions (Save · Sign →
// confirm Modal · Download · KebabMenu), Tabs, page-like editor body, and an
// optional left `AIPanel` rail when the note's appointment has a transcript.

// "minimize" is not in the foundation icon set → local inline SVG (FLAG).
const MinimizeIcon = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
    <line x1="5" y1="19" x2="19" y2="19" />
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

  // Download stub — exports the markdown source; PDF export comes later.
  function download() {
    if (!note) return;
    const blob = new Blob([`# ${title}\n\n${bodyMd}`], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/[^\w\d -]+/g, "").trim() || "note"}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (typeof document === "undefined") return null;

  if (minimized) {
    return createPortal(
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-card border border-border bg-surface py-2 pl-4 pr-2 shadow-menu">
        <Icon name="note" size={18} className="text-primary" />
        <span className="max-w-56 truncate text-sm font-semibold text-text">{title || "Untitled note"}</span>
        {dirty && <span className="text-[12px] text-text-muted">· unsaved</span>}
        <IconButton icon="chevron-up" label="Restore note" onClick={() => setMinimized(false)} />
        <IconButton icon="x" label="Close note" onClick={onClose} />
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
    <div className="fixed inset-0 z-50 flex flex-col">
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
          <MinimizeIcon />
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
            {/* doc header */}
            <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-6 py-3">
              <IconSquare name="note" />
              <div className="min-w-0 flex-1">
                <input
                  value={title}
                  readOnly={locked}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setDirty(true);
                  }}
                  aria-label="Note title"
                  className="w-full max-w-xl bg-transparent text-[19px] font-semibold text-text outline-none placeholder:text-text-muted"
                  placeholder="Untitled note"
                />
                <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-text-muted">
                  <span className="font-medium text-text-body">{data.client}</span>
                  <span>·</span>
                  <span>{formatDateTime(note.createdAt)}</span>
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
                <IconButton icon="download" label="Download (.md)" onClick={download} />
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
                  {!locked && <MenuItem icon="trash" label="Delete note" danger onClick={remove} />}
                </KebabMenu>
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
                  <div className="mx-auto my-6 min-h-[70%] max-w-3xl rounded-card border border-border bg-surface p-8 shadow-card">
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
                ) : (
                  data.transcript && (
                    <div className="mx-auto my-6 max-w-3xl rounded-card border border-border bg-surface p-8 shadow-card">
                      <h3 className="mb-4 text-[16px] font-semibold text-text">Chapters</h3>
                      <ChapterList chapters={deriveChapters(data.transcript.segments)} />
                      <div className="my-6 h-px bg-border" />
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-[16px] font-semibold text-text">Transcript</h3>
                        <IconButton
                          icon="copy"
                          label="Copy transcript"
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
                  )
                )}

                {/* floating Ask pill */}
                {tab === "note" && !locked && (
                  <div className="pointer-events-none sticky bottom-6 flex justify-end pr-6">
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon="sparkle"
                      className="pointer-events-auto rounded-full shadow-menu"
                      onClick={() => {
                        setAskContext(editorRef.current?.getSelectionText() ?? "");
                        setAskOpen(true);
                      }}
                    >
                      Ask AI
                    </Button>
                  </div>
                )}
              </main>
            </div>
          </>
        )}
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
