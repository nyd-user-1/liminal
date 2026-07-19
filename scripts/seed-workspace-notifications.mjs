#!/usr/bin/env node
// Seed the TopBar bell with the real events of the last two days — the reports
// that landed in docs/reports/2026-07-18|19, plus the platform changes that
// shipped alongside them. Every row points at a live route. Idempotent: an
// INSERT ... WHERE NOT EXISTS on (user_id, title) means a re-run adds nothing.
// Nothing here is invented and no row carries PHI.
//
//   node --env-file=.env.local scripts/seed-workspace-notifications.mjs
//
// Producer path mirrors lib/repos/notifications.ts (notifyAdmins): one row per
// admin user. read_at stays NULL so the rows land unread and the badge lights.

import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

// hoursAgo → an absolute timestamp, so "yesterday" / "today" read correctly in
// the bell's relative-time labels.
const at = (hours) => new Date(Date.now() - hours * 3_600_000);

// Real events only. Reports carry their file's H1 as the title and land on
// /workspace, where the fleet ledger lists them; platform changes land on the
// surface they changed.
const ROWS = [
  // Platform changes
  { kind: "event", title: "Workspace: /insights renamed to /workspace", body: "commit ee102dc", href: "/workspace", hours: 5 },
  { kind: "event", title: "Person-level provider merge applied (sql/052)", body: "NYS-34 · reversible merge-map", href: "/workspace", hours: 7 },
  { kind: "event", title: "Rate-intelligence marketing pages shipped", body: "founder correction round", href: "/pricing-data", hours: 26 },
  { kind: "event", title: "Form 5500-SF filings loaded", body: "NYS-146 · DOL plan registry", href: "/plans", hours: 28 },
  { kind: "event", title: "org_network_rates restored", body: "networks rate join back online", href: "/networks", hours: 30 },
  // Reports (title = file H1), landing on the fleet ledger
  { kind: "report", title: "2026-07-19 — data-agent T2 (TASK-DATA-FIREHOSE)", body: "docs/reports", href: "/workspace", hours: 3 },
  { kind: "report", title: "NYS-34 — Person-level merge across directory sources (design + reversible map)", body: "docs/reports", href: "/workspace", hours: 4 },
  { kind: "report", title: "/insights redesign: the ecosystem front door (NYS-125)", body: "docs/reports", href: "/workspace", hours: 27 },
  { kind: "report", title: "2026-07-18 — Lead review: all five reports ruled, Linear debt cleared", body: "docs/reports", href: "/workspace", hours: 29 },
];

const admins = await sql`SELECT id FROM users WHERE role = 'admin'`;
if (admins.length === 0) {
  console.error("No admin users to seed.");
  process.exit(1);
}

let inserted = 0;
let skipped = 0;
for (const u of admins) {
  for (const r of ROWS) {
    const res = await sql`
      INSERT INTO notifications (user_id, kind, title, body, href, created_at)
      SELECT ${u.id}, ${r.kind}, ${r.title}, ${r.body}, ${r.href}, ${at(r.hours)}
      WHERE NOT EXISTS (
        SELECT 1 FROM notifications WHERE user_id = ${u.id} AND title = ${r.title}
      )
      RETURNING id
    `;
    if (res.length) inserted += 1;
    else skipped += 1;
  }
}

console.log(`admins=${admins.length} rows=${ROWS.length} inserted=${inserted} skipped(existing)=${skipped}`);
