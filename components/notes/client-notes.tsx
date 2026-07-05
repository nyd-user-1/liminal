"use client";

import { useCallback, useEffect, useState } from "react";
import { NoteSheet } from "@/components/notes/note-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, MenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icons";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { Skeleton, Spinner } from "@/components/ui/spinner";
import { Tag, type TagHue } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatTime } from "@/lib/format";
import type { Note, NoteTemplateKind } from "@/lib/types";

// Client Documentation tab (contract: the Clients agent renders
// <ClientNotes clientId={id} />) — timeline of clinical notes grouped by
// date, with a "+ New note" template menu that opens the note editor sheet.

const TEMPLATE_LABEL: Record<NoteTemplateKind, { label: string; hue: TagHue }> = {
  soap: { label: "SOAP", hue: "teal" },
  dap: { label: "DAP", hue: "blue" },
  progress: { label: "Progress", hue: "violet" },
  intake: { label: "Intake", hue: "orange" },
  free: { label: "Free note", hue: "grey" },
};

const NEW_NOTE_KINDS: Array<{ kind: NoteTemplateKind; label: string }> = [
  { kind: "soap", label: "SOAP note" },
  { kind: "dap", label: "DAP note" },
  { kind: "progress", label: "Progress note" },
  { kind: "free", label: "Free note" },
];

export function ClientNotes({ clientId }: { clientId: string }) {
  const toast = useToast();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes?clientId=${clientId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load notes");
      setNotes(json.notes);
      setAuthors(json.authors ?? {});
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load notes", "danger");
      setNotes([]);
    }
  }, [clientId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function createNote(kind: NoteTemplateKind) {
    setCreating(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, template: kind }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not create note");
      await load();
      setOpenId(json.note.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not create note", "danger");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Note deleted", "success");
      load();
    } else {
      toast("Could not delete note", "danger");
    }
  }

  // group by calendar day, newest first (listNotes is already createdAt DESC)
  const groups: Array<{ day: string; items: Note[] }> = [];
  for (const n of notes ?? []) {
    const day = formatDate(n.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(n);
    else groups.push({ day, items: [n] });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[19px] font-semibold text-text">Notes</h2>
        <DropdownMenu
          label="New note"
          trigger={
            <>
              {creating ? <Spinner size={16} /> : <Icon name="plus" size={16} />}
              New note
            </>
          }
          triggerClassName="inline-flex h-8 items-center gap-2 rounded-field bg-primary px-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
        >
          {NEW_NOTE_KINDS.map((k) => (
            <MenuItem key={k.kind} icon="note" label={k.label} onClick={() => createNote(k.kind)} />
          ))}
        </DropdownMenu>
      </div>

      {notes === null && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {notes !== null && notes.length === 0 && (
        <EmptyState
          icon="note"
          title="No notes yet"
          subtext="Start a SOAP, DAP, or progress note — or let AI Scribe draft one from a session."
        />
      )}

      {groups.map((g) => (
        <div key={g.day} className="mb-5">
          {/* timeline date node */}
          <div className="mb-2.5 flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-[15px] font-semibold text-text">{g.day}</span>
          </div>
          <div className="ml-[3px] flex flex-col gap-2.5 border-l border-border pl-5">
            {g.items.map((n) => {
              const t = TEMPLATE_LABEL[n.template];
              return (
                <div
                  key={n.id}
                  className="group flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 shadow-card transition-colors hover:bg-canvas"
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(n.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <Tag hue={t.hue}>{t.label}</Tag>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-text">{n.title}</span>
                      <span className="block truncate text-[13px] text-text-muted">
                        {formatTime(n.createdAt)} · {authors[n.authorId] ?? "Practitioner"}
                      </span>
                    </span>
                  </button>
                  {n.status === "draft" ? (
                    <Badge variant="warning">Draft</Badge>
                  ) : (
                    <Badge variant="success" className="gap-1">
                      {n.status === "locked" && <Icon name="lock" size={12} />}
                      {n.status === "locked" ? "Locked" : "Signed"}
                    </Badge>
                  )}
                  <KebabMenu>
                    <MenuItem icon="eye" label="View" onClick={() => setOpenId(n.id)} />
                    {n.status !== "locked" && <MenuItem icon="edit" label="Edit" onClick={() => setOpenId(n.id)} />}
                    {n.status !== "locked" && (
                      <MenuItem icon="trash" label="Delete" danger onClick={() => remove(n.id)} />
                    )}
                  </KebabMenu>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {openId && <NoteSheet noteId={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}
