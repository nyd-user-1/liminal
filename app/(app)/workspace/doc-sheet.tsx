"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NotesEditor } from "@/components/notes-editor";
import { Button } from "@/components/ui/button";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icons";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";

// A markdown document — an agent report or an agent identity file — opened in
// the note editor's document window. Same all-white paper surface, and editable:
// GET {title, subtitle, bodyMd} from `endpoint`, PATCH {bodyMd} back to it on
// Save. Reused by the reports table and the fleet's agent cards.

interface DocData {
  title: string;
  subtitle: string;
  bodyMd: string;
}

export function DocSheet({
  endpoint,
  label,
  onClose,
}: {
  /** GET → {title, subtitle, bodyMd}; PATCH {bodyMd} to save. */
  endpoint: string;
  /** Window-chrome label, e.g. "Report" or "Agent". */
  label: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [data, setData] = useState<DocData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(endpoint)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load");
        if (!alive) return;
        setData(json);
        setBody(json.bodyMd);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [endpoint]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyMd: body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setDirty(false);
      toast("Saved", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "danger");
    } finally {
      setSaving(false);
    }
  }, [endpoint, body, toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !dirty && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, dirty]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-scrim" aria-hidden onClick={() => !dirty && onClose()} />
      <div className="sheet-rise fixed inset-0 z-50 m-auto flex h-[85vh] max-h-[860px] w-[92vw] max-w-[1000px] flex-col overflow-hidden rounded-2xl bg-surface shadow-menu">
        <div className="flex h-11 shrink-0 items-center justify-between gap-1 bg-sidebar-bg pl-3 pr-1">
          <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-sidebar-text">
            <Icon name="file-text" size={15} className="shrink-0" />
            <span className="truncate">{label}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${label.toLowerCase()}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-field text-sidebar-text transition-colors hover:bg-sidebar-active hover:text-white"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

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
                  <p className="font-mono text-[12px] text-text-muted">{data.subtitle}</p>
                </div>
                <span className="hidden text-[13px] text-text-muted sm:block">
                  {saving ? "Saving…" : dirty ? "Unsaved changes" : "Saved changes"}
                </span>
                <Button variant="secondary" size="sm" onClick={save} disabled={saving || !dirty}>
                  Save
                </Button>
                <KebabMenu>
                  <MenuItem
                    icon="copy"
                    label="Copy as Markdown"
                    onClick={() => {
                      navigator.clipboard?.writeText(body);
                      toast("Copied markdown", "success");
                    }}
                  />
                </KebabMenu>
              </div>
              <main className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto max-w-3xl px-8 py-6">
                  <NotesEditor
                    key={endpoint}
                    value={body}
                    onChange={(md) => {
                      setBody(md);
                      setDirty(true);
                    }}
                    onSave={save}
                  />
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
