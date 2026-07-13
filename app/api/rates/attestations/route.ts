import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { attestAffiliation, getAttestations } from "@/lib/repos/rate-signals";

export const dynamic = "force-dynamic";

// The provider's own statement of affiliation status — not PHI in the clinical
// sense (it's about a business relationship, not a patient), but it IS a
// proprietary write path, so validate hard. No logEvent (not a PHI read/write).

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

/** GET /api/rates/attestations?npi= — latest attestation per TIN, newest first. */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const npi = req.nextUrl.searchParams.get("npi")?.trim() ?? "";
    if (!/^\d{10}$/.test(npi)) {
      return NextResponse.json({ error: "Provide a 10-digit NPI." }, { status: 400 });
    }
    const attestations = await getAttestations(npi);
    return NextResponse.json({ attestations });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}

/** POST /api/rates/attestations — {npi, tin, status, attestedMonth?, note?} — a WRITE. */
export async function POST(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const body = await req.json().catch(() => null);
    const npi = typeof body?.npi === "string" ? body.npi : "";
    const tin = typeof body?.tin === "string" ? body.tin : "";
    const status = body?.status;
    const attestedMonth = typeof body?.attestedMonth === "string" ? body.attestedMonth : undefined;
    const note = typeof body?.note === "string" ? body.note : undefined;
    const attestation = await attestAffiliation({ npi, tin, status, attestedMonth, note });
    return NextResponse.json({ attestation });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
