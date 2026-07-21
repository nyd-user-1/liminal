import { hasDb, sql } from "@/lib/db";
import { isoDateOnly } from "@/lib/format";

// Lead night reports (sql/037) — the multi-terminal digest the lead session
// writes for the founder, surfaced on /workspace as an editable note. Markdown
// body, one row per day. No PHI belongs in these: they describe the BUILD.

export type LeadReport = {
  reportDate: string; // ISO date
  title: string;
  bodyMd: string;
  updatedAt: string;
};

type Row = { report_date: Date; title: string; body_md: string; updated_at: Date };

const toReport = (r: Row): LeadReport => ({
  reportDate: isoDateOnly(r.report_date),
  title: r.title,
  bodyMd: r.body_md,
  updatedAt: r.updated_at.toISOString(),
});

/** Every night report, newest first — the /workspace Reports tab shows the whole
 *  run, not just the latest. Empty without a database (the mock store has no
 *  night reports; the tab renders its empty state). */
export async function listLeadReports(): Promise<LeadReport[]> {
  if (!hasDb) return [];
  const rows = (await sql`
    SELECT report_date, title, body_md, updated_at
    FROM lead_reports ORDER BY report_date DESC
  `) as Row[];
  return rows.map(toReport);
}

/** One report by its date — what the DocSheet opens and saves back to. */
export async function leadReport(reportDate: string): Promise<LeadReport | null> {
  if (!hasDb) return null;
  const rows = (await sql`
    SELECT report_date, title, body_md, updated_at
    FROM lead_reports WHERE report_date = ${reportDate}
  `) as Row[];
  return rows[0] ? toReport(rows[0]) : null;
}

export async function latestLeadReport(): Promise<LeadReport | null> {
  if (!hasDb) return null;
  const rows = (await sql`
    SELECT report_date, title, body_md, updated_at
    FROM lead_reports ORDER BY report_date DESC LIMIT 1
  `) as Row[];
  return rows[0] ? toReport(rows[0]) : null;
}

export async function saveLeadReport(reportDate: string, title: string, bodyMd: string): Promise<void> {
  if (!hasDb) return;
  await sql`
    INSERT INTO lead_reports (report_date, title, body_md, updated_at)
    VALUES (${reportDate}, ${title}, ${bodyMd}, now())
    ON CONFLICT (report_date)
    DO UPDATE SET title = excluded.title, body_md = excluded.body_md, updated_at = now()
  `;
}
