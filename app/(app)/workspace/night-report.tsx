"use client";

import { useState } from "react";
import { LibraryCard } from "@/components/ui/library-card";
import { Tag } from "@/components/ui/tag";
import { formatDate } from "@/lib/format";
import type { LeadReport } from "@/lib/repos/lead-reports";
import { DocSheet } from "./doc-sheet";

// The night's work — what every terminal shipped while the founder slept,
// written by the lead session. It reads as one more card in the fleet gallery
// (the LibraryCard primitive); clicking it opens the report in the same editable
// document window the agent reports use (DocSheet → /api/insights/report), so
// the founder can annotate, strike through and reorganize in place. Edits save.

/** A one-line lede from the report body — the first real line, markdown stripped. */
function lede(md: string): string {
  const line = md
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#"));
  return line
    ? line.replace(/^[-*]\s+/, "").replace(/[*_`>]/g, "").trim()
    : "Last night's cross-terminal digest — open to read and annotate.";
}

export function NightWork({ report }: { report: LeadReport }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <LibraryCard
          title={report.title}
          description={lede(report.bodyMd)}
          date={formatDate(report.updatedAt)}
          tags={<Tag hue="green">Editable</Tag>}
          onOpen={() => setOpen(true)}
        />
      </div>
      {open && <DocSheet endpoint="/api/insights/report" label="Night report" onClose={() => setOpen(false)} />}
    </>
  );
}
