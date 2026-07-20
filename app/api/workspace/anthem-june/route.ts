import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { listAnthemJuneRows } from "@/lib/repos/rate-signals";

export const dynamic = "force-dynamic";

// GET /api/workspace/anthem-june?npi=&limit=&offset=  → { rows, total }
//
// The /workspace Operations "Anthem-June" tab: the June Empire 39F0 load (476,114
// rows) read straight off provider_rate_signals, server-paginated. Public-record
// payer data (TiC MRFs), not PHI — no logEvent, same as /api/rates/services. Gated
// to admin: the whole Operations panel is admin-only, and this is its rawest read.

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

const num = (v: string | null, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export async function GET(req: NextRequest) {
  try {
    await requireRole("admin");
    const p = req.nextUrl.searchParams;
    const { rows, total } = await listAnthemJuneRows({
      npi: p.get("npi") ?? undefined,
      limit: num(p.get("limit"), 50),
      offset: num(p.get("offset"), 0),
    });
    return NextResponse.json({ rows, total });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}
