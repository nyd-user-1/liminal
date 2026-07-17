"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NotesEditor } from "@/components/notes-editor";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import type { LeadReport } from "@/lib/repos/lead-reports";

// The night report — what every terminal shipped while the founder slept,
// written by the lead session, rendered INLINE on /insights (not a modal) in
// the same interactive editor clinical notes use. Edits autosave: annotate,
// strike through, reorganize — it's a working document, not a printout.

export function NightReport({ report }: { report: LeadReport }) {
  const [body, setBody] = useState(report.bodyMd);
  const [state, setState] = useState<"saved" | "saving" | "dirty" | "error">("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(report.bodyMd);

  const save = useCallback(async (md: string) => {
    setState("saving");
    try {
      const res = await fetch("/api/insights/report", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportDate: report.reportDate, title: report.title, bodyMd: md }),
      });
      if (!res.ok) throw new Error();
      setState(latest.current === md ? "saved" : "dirty");
    } catch {
      setState("error");
    }
  }, [report.reportDate, report.title]);

  const onChange = useCallback(
    (md: string) => {
      setBody(md);
      latest.current = md;
      setState("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(md), 900);
    },
    [save],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[15px] font-semibold text-text">
          <Icon name="note" size={16} className="text-primary" />
          {report.title}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[13px] text-text-muted">
            {state === "saving" ? "Saving…" : state === "dirty" ? "Unsaved edits" : state === "error" ? "Save failed — edits kept locally" : `Saved · ${formatDate(report.updatedAt)}`}
          </span>
          <Badge variant="info">Editable</Badge>
        </span>
      </div>
      <div className="min-w-0 rounded-field border border-border bg-surface px-4 py-2">
        <NotesEditor value={body} onChange={onChange} placeholder="The night report." />
      </div>
    </Card>
  );
}
