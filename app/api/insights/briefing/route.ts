import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { platformBriefing } from "@/lib/briefing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The Insights "Platform briefing" card, behind its on/off switch.
//   GET  — cached only. NEVER calls the model; safe to hit on every page view.
//   POST — generate fresh (the switch was flipped on, or Regenerate clicked).
// Admin-only, same as the observatory it narrates. Counts only — no PHI in
// the prompt by construction (see lib/briefing.ts buildFacts).

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

export async function GET() {
  try {
    await requireRole("admin");
    return NextResponse.json(await platformBriefing("cached"));
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function POST() {
  try {
    await requireRole("admin");
    return NextResponse.json(await platformBriefing("fresh"));
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
