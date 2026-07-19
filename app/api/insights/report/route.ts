import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { latestLeadReport, saveLeadReport } from "@/lib/repos/lead-reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The /workspace night report — GET the latest, save the founder's edits. It
// backs the DocSheet editor now, so GET returns the {title, subtitle, bodyMd}
// shape the sheet reads and PATCH takes {bodyMd} (the legacy PUT stays for any
// caller that still sends the full record). Admin-only; build notes, never PHI.

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

export async function GET() {
  try {
    await requireRole("admin");
    const r = await latestLeadReport();
    if (!r) return NextResponse.json({ error: "No night report yet." }, { status: 404 });
    return NextResponse.json({ title: r.title, subtitle: r.reportDate, bodyMd: r.bodyMd });
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireRole("admin");
    const { bodyMd } = (await req.json()) as { bodyMd?: unknown };
    if (typeof bodyMd !== "string") return NextResponse.json({ error: "bodyMd required." }, { status: 400 });
    const r = await latestLeadReport();
    if (!r) return NextResponse.json({ error: "No night report to edit." }, { status: 404 });
    await saveLeadReport(r.reportDate, r.title, bodyMd);
    return NextResponse.json({ title: r.title, subtitle: r.reportDate, bodyMd });
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireRole("admin");
    const { reportDate, title, bodyMd } = (await req.json()) as { reportDate?: string; title?: string; bodyMd?: string };
    if (!reportDate || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate) || typeof bodyMd !== "string") {
      return NextResponse.json({ error: "reportDate (YYYY-MM-DD) and bodyMd are required." }, { status: 400 });
    }
    await saveLeadReport(reportDate, title ?? `Night report — ${reportDate}`, bodyMd);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
