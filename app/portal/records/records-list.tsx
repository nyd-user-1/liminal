"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { LibraryCard } from "@/components/ui/library-card";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Tag, type TagHue } from "@/components/ui/tag";
import { Toolbar } from "@/components/ui/toolbar";
import { formatDate } from "@/lib/format";

// Portal Records — content tabs (All / Clinical notes / Documents) over a
// records list, with a Table view (default, TABLE STANDARD v2) and a Card grid
// behind a view toggle. A row opens the record: notes → a view-only Modal,
// documents → a download through the authenticated proxy.
//
// EVERY ROW IS A REAL OBJECT. This list used to pad itself with "Sample" rows
// for record types we expect to capture later; those are gone. What the client
// has is what shows, and when they have nothing the empty state says so — the
// honesty lives in the label, never in a fabricated row.

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
  uploaderName: string;
  /** Seeded demo rows are real files with real bytes, but they weren't put
   *  here by the practice — the row says so rather than passing as clinical. */
  isDemo: boolean;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

function toMs(d: string | null): number | null {
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isNaN(t) ? null : t;
}

// Bytes come from the authenticated proxy, never a blob URL — an anchor rather
// than a location change so a multi-row selection can download in one gesture.
function downloadFile(id: string) {
  const a = document.createElement("a");
  a.href = `/api/files/download?id=${encodeURIComponent(id)}`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
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

// Extension → a short type tag (label + hue) for document rows.
function fileTag(name: string): { label: string; hue: TagHue } {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return { label: "PDF", hue: "blue" };
  if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)) return { label: ext.toUpperCase(), hue: "teal" };
  if (["doc", "docx"].includes(ext)) return { label: "DOC", hue: "violet" };
  return { label: "File", hue: "grey" };
}

type RecordRow = {
  id: string;
  title: string;
  description: string;
  dateLabel: string;
  dateMs: number | null;
  typeLabel: string;
  hue: TagHue;
  sharedBy: string;
  isDemo: boolean;
  /** Set for a clinical note — opens the view-only modal. */
  note: NoteItem | null;
  /** Set for a document — downloads through the proxy. */
  fileId: string | null;
};

const cardGrid = (children: ReactNode) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
);

export function RecordsList({ notes, files }: { notes: NoteItem[]; files: FileItem[] }) {
  const [tab, setTab] = useState("all");
  const [view, setView] = useState<"table" | "cards">("table");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openNote, setOpenNote] = useState<NoteItem | null>(null);

  const noteRows: RecordRow[] = useMemo(
    () =>
      notes.map((n) => ({
        id: n.id,
        title: n.title,
        description: `Signed by ${n.authorName}`,
        dateLabel: n.signedAt ? formatDate(n.signedAt) : "—",
        dateMs: toMs(n.signedAt),
        typeLabel: "Clinical note",
        hue: "pink" as TagHue,
        sharedBy: n.authorName,
        isDemo: false,
        note: n,
        fileId: null,
      })),
    [notes],
  );

  const docRows: RecordRow[] = useMemo(
    () =>
      files.map((f) => {
        const t = fileTag(f.name);
        return {
          id: f.id,
          title: f.name,
          description: formatSize(f.sizeBytes),
          dateLabel: formatDate(f.createdAt),
          dateMs: toMs(f.createdAt),
          typeLabel: t.label,
          hue: t.hue,
          sharedBy: f.uploaderName,
          isDemo: f.isDemo,
          note: null,
          fileId: f.id,
        };
      }),
    [files],
  );

  const q = search.trim().toLowerCase();
  const matches = (r: RecordRow) => !q || r.title.toLowerCase().includes(q);

  const open = (r: RecordRow) => {
    if (r.note) setOpenNote(r.note);
    else if (r.fileId) downloadFile(r.fileId);
  };

  const SECTIONS = [
    { key: "notes", title: "Clinical notes", emptyIcon: "note" as const, emptyTitle: "No signed notes yet", items: noteRows },
    { key: "documents", title: "Documents", emptyIcon: "file-text" as const, emptyTitle: "No documents yet", items: docRows },
  ];

  const rows = (tab === "notes" ? noteRows : tab === "documents" ? docRows : [...noteRows, ...docRows]).filter(matches);

  // Newest first by default; a record with no date sinks to the bottom.
  const sorted = [...rows].sort((a, b) => {
    if (a.dateMs == null || b.dateMs == null) {
      if (a.dateMs == null && b.dateMs == null) return a.title.localeCompare(b.title);
      return a.dateMs == null ? 1 : -1;
    }
    return b.dateMs - a.dateMs || a.title.localeCompare(b.title);
  });

  const total = noteRows.length + docRows.length;
  const latestMs = [...noteRows, ...docRows].reduce<number | null>(
    (max, r) => (r.dateMs != null && (max == null || r.dateMs > max) ? r.dateMs : max),
    null,
  );

  // Bulk download acts on the documents in the selection; notes open one at a
  // time, so the button counts only what it can actually deliver.
  const selectedFileIds = sorted.filter((r) => selected.has(r.id) && r.fileId).map((r) => r.fileId!);

  const columns: DataTableColumn<RecordRow>[] = [
    {
      key: "name",
      label: "Name",
      fixed: true,
      cellClassName: "max-w-[24rem] truncate",
      render: (r) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-text" title={r.title}>
            {r.title}
          </span>
          {r.isDemo && <Badge variant="neutral">Demo data</Badge>}
        </span>
      ),
      sortValue: (r) => r.title.toLowerCase(),
    },
    {
      key: "date",
      label: "Date",
      render: (r) => <span className="text-text-muted">{r.dateLabel}</span>,
      sortValue: (r) => r.dateMs ?? 0,
    },
    {
      key: "type",
      label: "Type",
      render: (r) => <Tag hue={r.hue}>{r.typeLabel}</Tag>,
      sortValue: (r) => r.typeLabel.toLowerCase(),
    },
    {
      key: "sharedBy",
      label: "Shared by",
      render: (r) => <span className="text-text-muted">{r.sharedBy}</span>,
      sortValue: (r) => r.sharedBy.toLowerCase(),
    },
    {
      key: "size",
      label: "Size",
      align: "right",
      defaultHidden: true,
      render: (r) => <span className="text-text-muted">{r.fileId ? r.description : "—"}</span>,
      sortValue: (r) => r.description,
    },
  ];

  const controls = (
    <>
      <SearchInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search records…"
        className="w-56"
      />
      <Select
        aria-label="Records view"
        className="w-28"
        options={[
          { value: "table", label: "Table" },
          { value: "cards", label: "Cards" },
        ]}
        value={view}
        onValueChange={(v) => setView(v as "table" | "cards")}
      />
    </>
  );

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
          cardGrid(
            shown.map((r) => (
              <LibraryCard
                key={r.id}
                title={r.title}
                description={r.description}
                date={r.dateLabel}
                tags={
                  <>
                    <Tag hue={r.hue}>{r.typeLabel}</Tag>
                    {r.isDemo && <Badge variant="neutral">Demo data</Badge>}
                  </>
                }
                onOpen={() => open(r)}
              />
            )),
          )
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
    <div className="flex h-full min-w-0 flex-col">
      <Tabs
        className="mb-4 shrink-0"
        active={tab}
        onChange={setTab}
        items={[{ key: "all", label: "All" }, ...SECTIONS.map((s) => ({ key: s.key, label: s.title }))]}
      />

      {view === "table" ? (
        // Height-bounded so the card ends above the viewport and the rows scroll
        // under the sticky header. min-w-0 all the way down: the page never
        // scrolls sideways, the table owns its own overflow.
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {total === 0 ? (
            <div className="rounded-card border border-border bg-surface shadow-card">
              <EmptyState
                icon="file-text"
                title="No records yet"
                subtext="Signed notes and documents your care team shares with you appear here."
              />
            </div>
          ) : (
            <DataTable
              stacked
              fillHeight
              className="min-h-0 flex-1"
              storageKey="portal-records-columns"
              title="Records"
              status={{ variant: "success", label: `${total} shared with you` }}
              columns={columns}
              rows={sorted}
              rowKey={(r) => r.id}
              defaultSort={{ col: "date", dir: "desc" }}
              onRowClick={open}
              selected={selected}
              onSelectedChange={setSelected}
              toolbarExtra={controls}
              toolbarLeft={
                selectedFileIds.length > 0 ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon="download"
                    onClick={() => selectedFileIds.forEach(downloadFile)}
                  >
                    Download {selectedFileIds.length}
                  </Button>
                ) : undefined
              }
              rowActions={(r) => (
                <KebabMenu>
                  {r.note && <MenuItem icon="eye" label="View note" onClick={() => setOpenNote(r.note!)} />}
                  {r.fileId && <MenuItem icon="download" label="Download" onClick={() => downloadFile(r.fileId!)} />}
                </KebabMenu>
              )}
              source="Signed notes and documents shared by your care team"
              updatedAt={latestMs != null ? `Latest ${formatDate(new Date(latestMs).toISOString())}` : undefined}
            />
          )}
        </div>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Toolbar className="mb-4 shrink-0 flex-wrap justify-end">{controls}</Toolbar>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "all" ? (
              <div className="space-y-12">{SECTIONS.map((s) => renderSection(s, false))}</div>
            ) : active ? (
              renderSection(active, true)
            ) : null}
          </div>
        </div>
      )}

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
