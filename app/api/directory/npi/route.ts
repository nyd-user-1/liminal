import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Live NPI verification proxy → federal NPPES registry (no bulk; single lookup
// by number). Keeps the CMS host out of the browser and normalizes the result.

export async function GET(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const number = req.nextUrl.searchParams.get("number")?.replace(/\D/g, "") ?? "";
    if (number.length !== 10) {
      return NextResponse.json({ error: "A 10-digit NPI is required." }, { status: 400 });
    }
    const res = await fetch(`https://npiregistry.cms.hhs.gov/api/?version=2.1&number=${number}`);
    if (!res.ok) return NextResponse.json({ error: "NPPES lookup failed." }, { status: 502 });
    const data = await res.json();
    const rec = data?.results?.[0];
    if (!rec) return NextResponse.json({ found: false });
    const basic = rec.basic ?? {};
    const taxonomy = (rec.taxonomies ?? []).find((t: { primary?: boolean }) => t.primary) ?? rec.taxonomies?.[0];
    return NextResponse.json({
      found: true,
      npi: String(rec.number),
      name:
        basic.organization_name ||
        [basic.first_name, basic.last_name].filter(Boolean).join(" ") ||
        "Unknown",
      status: basic.status === "A" ? "Active" : basic.status || "Unknown",
      taxonomy: taxonomy?.desc ?? null,
      state: taxonomy?.state ?? rec.addresses?.[0]?.state ?? null,
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
