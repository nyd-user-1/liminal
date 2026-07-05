import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { listForms, saveForm } from "@/lib/repos/forms";
import { threadClients } from "@/lib/repos/threads";
import type { FormBlock, FormStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function fail(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

/** Form templates + client options for the "Send to client" modal. */
export async function GET() {
  try {
    await requireRole("practitioner");
    const [forms, clients] = await Promise.all([listForms(), threadClients()]);
    return NextResponse.json({ forms, clients });
  } catch (e) {
    return fail(e);
  }
}

/** Create a form (new draft, "duplicate"). */
export async function POST(req: NextRequest) {
  try {
    await requireRole("practitioner");
    const { title, description, schema, status } = (await req.json()) as {
      title?: string;
      description?: string | null;
      schema?: FormBlock[];
      status?: FormStatus;
    };
    if (!title?.trim()) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    const form = await saveForm({
      title: title.trim(),
      description: description ?? null,
      schema: Array.isArray(schema) ? schema : [],
      status: status === "published" ? "published" : "draft",
    });
    return NextResponse.json(form, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
