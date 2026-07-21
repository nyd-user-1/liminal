import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { leadReport, saveLeadReport } from "@/lib/repos/lead-reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ONE night report, addressed by its date — what a card in the /workspace
// Reports tab opens in the DocSheet. The sibling route (../route.ts) serves
// only the latest; the tab lists every report, so each needs its own endpoint.
// Same {title, subtitle, bodyMd} contract the sheet reads everywhere else.
// Admin-only; these describe the build, never a patient.

type Params = { params: Promise<{ date: string }> };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireRole("admin");
    const { date } = await params;
    if (!ISO_DATE.test(date)) return NextResponse.json({ error: "Bad report date." }, { status: 400 });
    const r = await leadReport(date);
    if (!r) return NextResponse.json({ error: "No report for that date." }, { status: 404 });
    return NextResponse.json({ title: r.title, subtitle: r.reportDate, bodyMd: r.bodyMd });
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireRole("admin");
    const { date } = await params;
    if (!ISO_DATE.test(date)) return NextResponse.json({ error: "Bad report date." }, { status: 400 });
    const { bodyMd } = (await req.json()) as { bodyMd?: unknown };
    if (typeof bodyMd !== "string") return NextResponse.json({ error: "bodyMd required." }, { status: 400 });
    const r = await leadReport(date);
    if (!r) return NextResponse.json({ error: "No report to edit." }, { status: 404 });
    await saveLeadReport(r.reportDate, r.title, bodyMd);
    return NextResponse.json({ title: r.title, subtitle: r.reportDate, bodyMd });
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
