"use client";

import { useMemo, useState } from "react";
import { LibraryCard } from "@/components/ui/library-card";
import { Tag } from "@/components/ui/tag";
import { formatDate } from "@/lib/format";
import { DocSheet } from "../doc-sheet";

// The Docs gallery — LibraryCard per markdown file, grouped by top-level folder;
// clicking a card opens it in the DocSheet editor (GET/PATCH /api/docs). The
// folder groups sort General (the docs/ root) first, the big reports archive
// last, everything else alphabetically between.

export interface DocMeta {
  /** Path relative to docs/, e.g. "reports/2026-07-19-ui.md". */
  path: string;
  title: string;
  /** Top-level folder, or "General" for a root-level file. */
  group: string;
  updatedAt: string;
}

const GROUP_LABELS: Record<string, string> = {
  General: "General",
  ops: "Operations",
  data: "Data",
  reference: "Reference",
  reports: "Agent reports",
};

/** General first, reports (the archive) last, the rest alphabetical. */
function groupRank(g: string): string {
  if (g === "General") return "0";
  if (g === "reports") return "z";
  return `1${g}`;
}

/** The DocSheet endpoint for a doc — each path segment encoded so a space or
 *  other odd character in a filename still resolves to the catch-all route. */
function endpointFor(path: string): string {
  return `/api/docs/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function DocsGallery({ docs }: { docs: DocMeta[] }) {
  const [open, setOpen] = useState<DocMeta | null>(null);

  const groups = useMemo(() => {
    const by = new Map<string, DocMeta[]>();
    for (const d of docs) {
      const list = by.get(d.group) ?? [];
      list.push(d);
      by.set(d.group, list);
    }
    return [...by.entries()]
      .map(([key, list]) => ({
        key,
        label: GROUP_LABELS[key] ?? key,
        list: list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      }))
      .sort((a, b) => groupRank(a.key).localeCompare(groupRank(b.key)));
  }, [docs]);

  if (docs.length === 0) {
    return <p className="text-sm text-text-muted">No documents found under docs/.</p>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      {groups.map((g) => (
        <section key={g.key} className="flex min-w-0 flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-semibold text-text">{g.label}</h2>
            <span className="text-[13px] tabular-nums text-text-muted">{g.list.length}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {g.list.map((d) => (
              <LibraryCard
                key={d.path}
                title={d.title}
                description={<span className="font-mono text-[12px]">docs/{d.path}</span>}
                date={formatDate(d.updatedAt)}
                tags={<Tag hue="grey">Markdown</Tag>}
                onOpen={() => setOpen(d)}
              />
            ))}
          </div>
        </section>
      ))}
      {open && <DocSheet endpoint={endpointFor(open.path)} label={open.title} onClose={() => setOpen(null)} />}
    </div>
  );
}
