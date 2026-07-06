import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { searchProviders } from "@/lib/repos/directory";

export const dynamic = "force-dynamic";

/** GET /api/directory/providers?q=&zip=&county=&profession=&subspecialty=&gender=&type=&page= */
export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const p = req.nextUrl.searchParams;
    const page = await searchProviders({
      q: p.get("q") ?? undefined,
      zip: p.get("zip") ?? undefined,
      county: p.get("county") ?? undefined,
      profession: p.get("profession") ?? undefined,
      subspecialty: p.get("subspecialty") ?? undefined,
      gender: p.get("gender") ?? undefined,
      providerType: p.get("type") ?? undefined, // therapist | psychiatrist | prescriber
      page: Number(p.get("page")) || 1,
    });
    return NextResponse.json(page);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
