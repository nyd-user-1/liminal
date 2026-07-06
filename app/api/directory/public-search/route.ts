import { NextResponse, type NextRequest } from "next/server";
import { searchPrograms, searchProviders } from "@/lib/repos/directory";

export const dynamic = "force-dynamic";

// Public, anon-allowed directory search for the marketing front door.
// Open-data only (no PHI); results capped at 50. Returns a unified shape so
// the client can render providers and programs in one result list.

const CAP = 50;

export type PublicResult = {
  id: string;
  kind: "provider" | "program";
  name: string;
  subtitle: string | null; // profession or program type
  agency: string | null;
  county: string | null;
  phone: string | null;
};

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const q = p.get("q") ?? undefined;
  const county = p.get("county") ?? undefined;
  const need = p.get("need") ?? undefined; // profession (providers) / type (programs)
  const kind = p.get("kind") ?? "all"; // all | providers | programs

  const results: PublicResult[] = [];

  if (kind !== "programs") {
    const providers = await searchProviders({ q, county, profession: need, page: 1, pageSize: CAP });
    for (const r of providers.items) {
      results.push({
        id: r.id,
        kind: "provider",
        name: r.name,
        subtitle: r.profession,
        agency: null,
        county: r.county,
        phone: r.phone,
      });
    }
  }

  if (kind !== "providers") {
    const programs = await searchPrograms({ q, county, type: need, page: 1, pageSize: CAP });
    for (const r of programs.items) {
      results.push({
        id: r.id,
        kind: "program",
        name: r.programName,
        subtitle: r.programType,
        agency: r.agency,
        county: r.county,
        phone: r.phone,
      });
    }
  }

  return NextResponse.json({ results: results.slice(0, CAP) });
}
