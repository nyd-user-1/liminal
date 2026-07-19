"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NotesEditor } from "@/components/notes-editor";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icons";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";

// Opens one agent report in the note editor's document window — the same paper
// surface, read-only. All-white canvas (no card, no border, no gray margin), a
// dark title strip for the window chrome, and a ⋮ menu to copy the markdown.

interface ReportData {
  slug: string;
  title: string;
  bodyMd: string;
}

export function ReportSheet({ slug, onClose }: { slug: string; onClose: () => void }) {
  const toast = useToast();
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/reports/${slug}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load report");
        if (alive) setData(json);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [slug]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-scrim" aria-hidden onClick={onClose} />
      <div className="sheet-rise fixed inset-0 z-50 m-auto flex h-[85vh] max-h-[860px] w-[92vw] max-w-[1000px] flex-col overflow-hidden rounded-2xl bg-surface shadow-menu">
        {/* dark title strip — window chrome, matches the note editor */}
        <div className="flex h-11 shrink-0 items-center justify-between gap-1 bg-sidebar-bg pl-3 pr-1">
          <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-sidebar-text">
            <Icon name="file-text" size={15} className="shrink-0" />
            <span className="truncate">Report</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report"
            className="inline-flex h-8 w-8 items-center justify-center rounded-field text-sidebar-text transition-colors hover:bg-sidebar-active hover:text-white"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* all-white canvas below the strip */}
        <div className="flex min-h-0 flex-1 flex-col bg-surface">
          {error && <p className="p-10 text-center text-[15px] text-danger">{error}</p>}
          {!error && !data && (
            <div className="flex flex-1 items-center justify-center text-primary">
              <Spinner size={28} />
            </div>
          )}
          {data && (
            <>
              <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-text">{data.title}</p>
                  <p className="font-mono text-[12px] text-text-muted">{data.slug}</p>
                </div>
                <KebabMenu>
                  <MenuItem
                    icon="copy"
                    label="Copy as Markdown"
                    onClick={() => {
                      navigator.clipboard?.writeText(data.bodyMd);
                      toast("Copied report markdown", "success");
                    }}
                  />
                </KebabMenu>
              </div>
              <main className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto max-w-3xl px-8 py-6">
                  <NotesEditor value={data.bodyMd} readOnly onChange={() => {}} />
                </div>
              </main>
            </>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
