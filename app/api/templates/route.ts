import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { createTemplate, listClientOptions, listTemplates } from "@/lib/repos/notes";
import type { NoteTemplateKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const KINDS: NoteTemplateKind[] = ["soap", "dap", "progress", "intake", "free"];

function onAuthError(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  throw e;
}

/** GET /api/templates → { templates, clients } (clients feed the Use-template picker). */
export async function GET() {
  try {
    await requireRole("practitioner");
    const [templates, clients] = await Promise.all([listTemplates(), listClientOptions()]);
    return NextResponse.json({ templates, clients });
  } catch (e) {
    return onAuthError(e);
  }
}

/** POST /api/templates { name, template?, bodyMd } */
export async function POST(req: Request) {
  try {
    await requireRole("practitioner");
    let body: { name?: unknown; template?: unknown; bodyMd?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const bodyMd = typeof body.bodyMd === "string" ? body.bodyMd : "";
    if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    const template = KINDS.includes(body.template as NoteTemplateKind)
      ? (body.template as NoteTemplateKind)
      : "free";
    const created = await createTemplate({ name, template, bodyMd });
    return NextResponse.json({ template: created }, { status: 201 });
  } catch (e) {
    return onAuthError(e);
  }
}
