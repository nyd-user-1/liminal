import { hasDb, sql } from "@/lib/db";
import { isoDateOnly } from "@/lib/format";

// Lead night reports (sql/037) — the multi-terminal digest the lead session
// writes for the founder, surfaced on /insights as an editable note. Markdown
// body, one row per day. No PHI belongs in these: they describe the BUILD.

export type LeadReport = {
  reportDate: string; // ISO date
  title: string;
  bodyMd: string;
  updatedAt: string;
};

export async function latestLeadReport(): Promise<LeadReport | null> {
  if (!hasDb) return null;
  const rows = (await sql`
    SELECT report_date, title, body_md, updated_at
    FROM lead_reports ORDER BY report_date DESC LIMIT 1
  `) as Array<{ report_date: Date; title: string; body_md: string; updated_at: Date }>;
  const r = rows[0];
  if (!r) return null;
  return {
    reportDate: isoDateOnly(r.report_date),
    title: r.title,
    bodyMd: r.body_md,
    updatedAt: r.updated_at.toISOString(),
  };
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
