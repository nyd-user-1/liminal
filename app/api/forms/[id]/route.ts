import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { deleteForm, getForm, saveForm } from "@/lib/repos/forms";
import type { FormBlock, FormStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function fail(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("practitioner");
    const { id } = await params;
    const form = await getForm(id);
    if (!form) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json(form);
  } catch (e) {
    return fail(e);
  }
}

/** Save the builder state (title, description, blocks, draft/published). */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("practitioner");
    const { id } = await params;
    const existing = await getForm(id);
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const { title, description, schema, status } = (await req.json()) as {
      title?: string;
      description?: string | null;
      schema?: FormBlock[];
      status?: FormStatus;
    };
    const form = await saveForm({
      id,
      title: title?.trim() || existing.title,
      description: description !== undefined ? description : existing.description,
      schema: Array.isArray(schema) ? schema : existing.schema,
      status: status === "published" || status === "draft" ? status : existing.status,
    });
    return NextResponse.json(form);
  } catch (e) {
    return fail(e);
  }
}

/** Delete a form template (and its responses). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("practitioner");
    const { id } = await params;
    const existing = await getForm(id);
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    await deleteForm(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
