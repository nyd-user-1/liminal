"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LibraryCard } from "@/components/ui/library-card";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs } from "@/components/ui/tabs";
import { Tag, type TagHue } from "@/components/ui/tag";
import { Toolbar } from "@/components/ui/toolbar";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";

// Portal Records — mirrors the provider Library layout: content tabs
// (All / Clinical notes / Documents) over a shared LibraryCard grid with a
// persistent search toolbar. Real notes open a view-only Modal; real files
// download. The grid is padded with "Sample" cards for the record types we
// know will land over time — so the page shows its eventual shape today.

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
  sizeBytes: number;
  createdAt: string;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

// ── markdown renderer for the note-view Modal (## headings, - lists, **bold**) ──
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

// Extension → a short type tag (label + hue) for document cards.
function fileTag(name: string): { label: string; hue: TagHue } {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return { label: "PDF", hue: "blue" };
  if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)) return { label: ext.toUpperCase(), hue: "teal" };
  if (["doc", "docx"].includes(ext)) return { label: "DOC", hue: "violet" };
  return { label: "File", hue: "grey" };
}

// Record types we know are coming but don't capture yet — shown as "Sample"
// cards so the page reads at its eventual density and we can design backward.
const SAMPLE_NOTES: Array<{ title: string; date: string }> = [
  { title: "Intake assessment", date: "Jun 2, 2026" },
  { title: "Treatment plan", date: "Jun 2, 2026" },
  { title: "Progress note — 6/16", date: "Jun 16, 2026" },
  { title: "Medication review", date: "Jun 30, 2026" },
  { title: "Safety plan", date: "Jun 16, 2026" },
  { title: "Discharge summary", date: "—" },
];

const SAMPLE_DOCS: Array<{ title: string; meta: string }> = [
  { title: "Consent to treat.pdf", meta: "Signed intake packet" },
  { title: "Release of information.pdf", meta: "Care coordination" },
  { title: "Good Faith Estimate.pdf", meta: "Cost estimate" },
  { title: "Superbill — June 2026.pdf", meta: "For your insurer" },
  { title: "PHQ-9 results.pdf", meta: "Assessment score" },
  { title: "insurance-card-back.jpg", meta: "On file" },
];

type RecordCard = {
  id: string;
  title: string;
  description: string;
  date: ReactNode;
  tag: ReactNode;
  sample: boolean;
  onOpen: () => void;
};

const cardGrid = (children: ReactNode) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
);

export function RecordsList({ notes, files }: { notes: NoteItem[]; files: FileItem[] }) {
  const toast = useToast();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [openNote, setOpenNote] = useState<NoteItem | null>(null);

  const comingSoon = () => toast("This record isn't available yet.", "info");

  const noteCards: RecordCard[] = useMemo(
    () => [
      ...notes.map((n) => ({
        id: n.id,
        title: n.title,
        description: `Signed by ${n.authorName}`,
        date: n.signedAt ? formatDate(n.signedAt) : "—",
        tag: <Tag hue="pink">Clinical note</Tag>,
        sample: false,
        onOpen: () => setOpenNote(n),
      })),
      ...SAMPLE_NOTES.map((s) => ({
        id: `sample-note-${s.title}`,
        title: s.title,
        description: "Appears here once your practitioner signs it.",
        date: s.date,
        tag: <Tag hue="pink">Clinical note</Tag>,
        sample: true,
        onOpen: comingSoon,
      })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notes],
  );

  const docCards: RecordCard[] = useMemo(
    () => [
      ...files.map((f) => {
        const t = fileTag(f.name);
        return {
          id: f.id,
          title: f.name,
          description: formatSize(f.sizeBytes),
          date: formatDate(f.createdAt),
          tag: <Tag hue={t.hue}>{t.label}</Tag>,
          sample: false,
          onOpen: () => {
            window.location.href = `/api/files/download?id=${f.id}`;
          },
        };
      }),
      ...SAMPLE_DOCS.map((s) => {
        const t = fileTag(s.title);
        return {
          id: `sample-doc-${s.title}`,
          title: s.title,
          description: s.meta,
          date: "—",
          tag: <Tag hue={t.hue}>{t.label}</Tag>,
          sample: true,
          onOpen: comingSoon,
        };
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files],
  );

  const q = search.trim().toLowerCase();
  const matches = (c: RecordCard) => !q || c.title.toLowerCase().includes(q);

  const card = (c: RecordCard) => (
    <LibraryCard
      key={c.id}
      title={c.title}
      description={c.description}
      date={c.date}
      tags={
        <>
          {c.tag}
          {c.sample && <Badge variant="neutral">Sample</Badge>}
        </>
      }
      onOpen={c.onOpen}
    />
  );

  const SECTIONS = [
    { key: "notes", title: "Clinical notes", emptyIcon: "note" as const, emptyTitle: "No signed notes yet", items: noteCards },
    { key: "documents", title: "Documents", emptyIcon: "file-text" as const, emptyTitle: "No documents yet", items: docCards },
  ];

  // On "All" each section shows a header (title + count) and up to six cards
  // with a "View more"; on a section tab the header is dropped and all show.
  const renderSection = (s: (typeof SECTIONS)[number], full: boolean) => {
    const items = s.items.filter(matches);
    const shown = full ? items : items.slice(0, 6);
    return (
      <section key={s.key}>
        {!full && (
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-[19px] font-bold text-text">{s.title}</h2>
            <span className="ml-auto text-[15px] font-semibold text-text-body">{items.length}</span>
          </div>
        )}
        {items.length === 0 ? (
          <div className="rounded-card border border-border bg-surface shadow-card">
            <EmptyState icon={s.emptyIcon} title={q ? "No matches" : s.emptyTitle} />
          </div>
        ) : (
          cardGrid(shown.map(card))
        )}
        {!full && items.length > 6 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setTab(s.key)}
              className="text-[15px] font-semibold text-primary hover:text-primary-hover"
            >
              View more
            </button>
          </div>
        )}
      </section>
    );
  };

  const active = SECTIONS.find((s) => s.key === tab);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs
        className="mb-4 shrink-0"
        active={tab}
        onChange={setTab}
        items={[{ key: "all", label: "All" }, ...SECTIONS.map((s) => ({ key: s.key, label: s.title }))]}
      />

      <Toolbar className="mb-4 shrink-0 flex-wrap">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search records…"
          className="max-w-md flex-1"
        />
      </Toolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "all" ? (
          <div className="space-y-12">{SECTIONS.map((s) => renderSection(s, false))}</div>
        ) : active ? (
          renderSection(active, true)
        ) : null}
      </div>

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
