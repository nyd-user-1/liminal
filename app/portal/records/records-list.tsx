"use client";

import { useState, type ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { IconSquare } from "@/components/ui/icons";
import { ListRow } from "@/components/ui/list-row";
import { Modal } from "@/components/ui/modal";
import { TextLink } from "@/components/ui/text-link";
import { formatDate } from "@/lib/format";

// Signed-note list (view-only Modal) + files. Notes arrive as markdown;
// a tiny renderer covers the note-template subset (##, -, **bold**).

interface NoteItem {
  id: string;
  title: string;
  bodyMd: string;
  signedAt: string | null;
  authorName: string;
}

interface FileItem {
  id: string;
  name: string;
  url: string;
  sizeBytes: number;
  createdAt: string;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-text">{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function Markdown({ md }: { md: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = (key: string) => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={key} className="list-disc space-y-1 pl-5 text-[15px] text-text-body">
        {list.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </ul>,
    );
    list = [];
  };
  md.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (line.startsWith("- ") || line.startsWith("* ")) {
      list.push(line.slice(2));
      return;
    }
    flush(`ul-${i}`);
    if (!line) return;
    if (line.startsWith("### ")) blocks.push(<h4 key={i} className="pt-1 text-[15px] font-semibold text-text">{line.slice(4)}</h4>);
    else if (line.startsWith("## ")) blocks.push(<h3 key={i} className="pt-1 text-base font-semibold text-text">{line.slice(3)}</h3>);
    else if (line.startsWith("# ")) blocks.push(<h2 key={i} className="pt-1 text-[17px] font-bold text-text">{line.slice(2)}</h2>);
    else blocks.push(<p key={i} className="text-[15px] text-text-body">{inline(line)}</p>);
  });
  flush("ul-end");
  return <div className="space-y-2.5">{blocks}</div>;
}

export function RecordsList({ notes, files }: { notes: NoteItem[]; files: FileItem[] }) {
  const [openNote, setOpenNote] = useState<NoteItem | null>(null);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-[19px] font-semibold text-text">Clinical notes</h2>
        {notes.length === 0 ? (
          <EmptyState icon="note" title="No signed notes yet" subtext="Notes appear here once your practitioner signs them." />
        ) : (
          <div className="space-y-2.5">
            {notes.map((n) => (
              <ListRow
                key={n.id}
                onClick={() => setOpenNote(n)}
                leading={<IconSquare name="note" />}
                title={n.title}
                meta={`Signed ${n.signedAt ? formatDate(n.signedAt) : "—"} · ${n.authorName}`}
                trailing={<TextLink icon="eye">View</TextLink>}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-[19px] font-semibold text-text">Documents</h2>
        {files.length === 0 ? (
          <EmptyState icon="file-text" title="No documents yet" subtext="Files your care team shares will appear here." />
        ) : (
          <div className="space-y-2.5">
            {files.map((f) => (
              <ListRow
                key={f.id}
                leading={<IconSquare name="file-text" />}
                title={f.name}
                meta={`${formatSize(f.sizeBytes)} · ${formatDate(f.createdAt)}`}
                trailing={
                  <TextLink href={f.url} icon="download" download>
                    Download
                  </TextLink>
                }
              />
            ))}
          </div>
        )}
      </section>

      {openNote && (
        <Modal open onClose={() => setOpenNote(null)} title={openNote.title} icon="note" width="max-w-2xl">
          <p className="mb-4 text-sm text-text-muted">
            Signed {openNote.signedAt ? formatDate(openNote.signedAt) : "—"} by {openNote.authorName} · view only
          </p>
          <Markdown md={openNote.bodyMd} />
        </Modal>
      )}
    </div>
  );
}
