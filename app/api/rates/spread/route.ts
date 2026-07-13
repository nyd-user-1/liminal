import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { computeSpread, type SpreadEntry } from "@/lib/repos/rate-signals";

export const dynamic = "force-dynamic";

// The caller sends THEIR numbers (platform remit, weekly volume); the payer
// medians and all arithmetic stay server-side in the repo. Not PHI — no logEvent.

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

const MAX_ENTRIES = 8;

/** POST /api/rates/spread — {entries:[{billingCode,remit,sessionsPerWeek}],weeksPerYear?}. */
export async function POST(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const body = await req.json().catch(() => null);
    const raw = Array.isArray(body?.entries) ? body.entries : [];
    const entries: SpreadEntry[] = raw
      .slice(0, MAX_ENTRIES)
      .map((e: unknown) => {
        const o = e as Record<string, unknown>;
        return {
          billingCode: typeof o?.billingCode === "string" ? o.billingCode.trim() : "",
          remit: Number(o?.remit),
          sessions: Number(o?.sessions),
          cadence: (o?.cadence === "month" ? "month" : "week") as "week" | "month",
        };
      })
      .filter(
        (e: SpreadEntry) =>
          /^\d{5}$/.test(e.billingCode) &&
          Number.isFinite(e.remit) &&
          e.remit >= 0 &&
          e.remit <= 10000 &&
          Number.isFinite(e.sessions) &&
          e.sessions >= 0 &&
          e.sessions <= 500,
      );
    if (entries.length === 0) {
      return NextResponse.json(
        { error: "Provide at least one entry: a 5-digit CPT, your per-session remit, and sessions per week." },
        { status: 400 },
      );
    }
    const weeksPerYear = Number.isFinite(Number(body?.weeksPerYear)) ? Number(body.weeksPerYear) : undefined;
    const result = await computeSpread(entries, { weeksPerYear });
    return NextResponse.json({ result });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}
