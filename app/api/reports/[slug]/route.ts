import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One agent report's markdown, for the /workspace reports viewer. Admin-only
// (the fleet ledger is the founder's), read straight off docs/reports/. The
// slug is validated against the report filename shape so it can never escape
// the reports directory. No DB, no PHI.

type Params = { params: Promise<{ slug: string }> };

const SLUG_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*$/;

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireRole("admin");
    const { slug } = await params;
    if (!SLUG_RE.test(slug)) {
      return NextResponse.json({ error: "Unknown report." }, { status: 400 });
    }
    let md: string;
    try {
      md = await readFile(join(process.cwd(), "docs", "reports", `${slug}.md`), "utf8");
    } catch {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }
    const head = md.split("\n").find((l) => l.startsWith("# "));
    const title = head ? head.replace(/^#\s+/, "").trim() : slug;
    return NextResponse.json({ slug, title, bodyMd: md });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
