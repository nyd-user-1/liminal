import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { askDirectory, directoryAgentConfigured, type DirectoryTurn } from "@/lib/ai/directory-agent";

// POST /api/ai/directory — the care-directory agent (prototype).
//   { question, history?: [{role:"user"|"assistant", content}] }
//     → { answer, trace, inputTokens, outputTokens }
//
// Reference data only (providers, networks, published rates) — no PHI touches
// this route, so there is no logEvent here; the audit boundary is clinical
// records, not public-directory questions. Auth-gated all the same: it burns
// API tokens, so it is not an anonymous endpoint. Making it truly public later
// means adding rate limiting + a spend cap, not removing requireUser lightly.

export const dynamic = "force-dynamic";
export const maxDuration = 120; // tool loop on a hard question can run a while

export async function POST(req: Request) {
  try {
    await requireUser();
    if (!directoryAgentConfigured()) {
      return NextResponse.json({ error: "Directory assistant is not configured." }, { status: 503 });
    }

    let body: { question?: unknown; history?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
    }
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) return NextResponse.json({ error: "question is required." }, { status: 400 });

    // History is capped and sanitized — plain text turns only, newest last.
    const history: DirectoryTurn[] = Array.isArray(body.history)
      ? body.history
          .filter(
            (t): t is DirectoryTurn =>
              !!t && typeof t === "object" &&
              ((t as DirectoryTurn).role === "user" || (t as DirectoryTurn).role === "assistant") &&
              typeof (t as DirectoryTurn).content === "string",
          )
          .slice(-12)
      : [];

    const result = await askDirectory(question, history);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("ai/directory failed", (err as Error)?.name ?? "error");
    return NextResponse.json({ error: "The directory assistant is temporarily unavailable." }, { status: 502 });
  }
}
