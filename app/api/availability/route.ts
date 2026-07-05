import { NextResponse } from "next/server";
import { logEvent } from "@/lib/audit";
import { AuthError, requireRole, requireUser } from "@/lib/auth";
import {
  listAvailability,
  replaceAvailability,
  type AvailabilityRule,
} from "@/lib/repos/services";

export const dynamic = "force-dynamic";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function authResponse(e: unknown): NextResponse | null {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  return null;
}

export async function GET(req: Request) {
  try {
    await requireUser();
    const practitionerId = new URL(req.url).searchParams.get("practitionerId") ?? undefined;
    const availability = await listAvailability(practitionerId);
    return NextResponse.json({ availability });
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Could not list availability." }, { status: 500 });
  }
}

/** Replace a practitioner's weekly rules (the availability editor saves whole weeks). */
export async function PUT(req: Request) {
  try {
    const user = await requireRole("practitioner");
    let body: { practitionerId?: unknown; rules?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const practitionerId = typeof body.practitionerId === "string" ? body.practitionerId : "";
    if (!practitionerId) return NextResponse.json({ error: "practitionerId is required." }, { status: 400 });
    if (!Array.isArray(body.rules)) return NextResponse.json({ error: "rules must be an array." }, { status: 400 });

    const rules: AvailabilityRule[] = [];
    for (const r of body.rules as Array<Record<string, unknown>>) {
      const weekday = typeof r.weekday === "number" ? r.weekday : NaN;
      const startTime = typeof r.startTime === "string" ? r.startTime : "";
      const endTime = typeof r.endTime === "string" ? r.endTime : "";
      if (
        !Number.isInteger(weekday) || weekday < 0 || weekday > 6 ||
        !HHMM.test(startTime) || !HHMM.test(endTime) || startTime >= endTime
      ) {
        return NextResponse.json({ error: "Each rule needs weekday 0–6 and HH:MM start < end." }, { status: 400 });
      }
      rules.push({ weekday, startTime, endTime });
    }

    const availability = await replaceAvailability(practitionerId, rules);
    await logEvent({
      actorId: user.id,
      action: "availability.replace",
      entity: "availability",
      entityId: practitionerId,
      meta: { ruleCount: rules.length },
    });
    return NextResponse.json({ availability });
  } catch (e) {
    return authResponse(e) ?? NextResponse.json({ error: "Could not save availability." }, { status: 500 });
  }
}
