import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { updateTemplate } from "@/lib/repos/notes";

export const dynamic = "force-dynamic";

/** PATCH /api/templates/:id { name?, bodyMd? } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("practitioner");
    const { id } = await params;
    let body: { name?: unknown; bodyMd?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const template = await updateTemplate(id, {
      name: typeof body.name === "string" ? body.name.trim() : undefined,
      bodyMd: typeof body.bodyMd === "string" ? body.bodyMd : undefined,
    });
    if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });
    return NextResponse.json({ template });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
