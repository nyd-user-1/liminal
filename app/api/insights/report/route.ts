import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { latestLeadReport, saveLeadReport } from "@/lib/repos/lead-reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The /insights night report — GET the latest, PUT the founder's edits.
// Admin-only both ways; build notes, never PHI.

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

export async function GET() {
  try {
    await requireRole("admin");
    return NextResponse.json({ report: await latestLeadReport() });
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
