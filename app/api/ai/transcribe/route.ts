import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { getTranscript } from "@/lib/repos/notes";
import { DEMO_SEGMENTS, delay } from "../demo-script";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/transcribe { appointmentId, elapsed } → live-transcription poll.
 *
 * STUB — wire a real ASR key here (Deepgram/Whisper streaming). The stub
 * replays a canned psychiatry session script: each poll returns the segments
 * whose start time has passed `elapsed` seconds, so the ScribePanel's
 * TranscriptPanel fills in "live". `done` flips when the script is exhausted.
 */
export async function POST(req: Request) {
  try {
    await requireRole("practitioner");
    let body: { appointmentId?: unknown; elapsed?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const appointmentId = typeof body.appointmentId === "string" ? body.appointmentId : "";
    const elapsed = typeof body.elapsed === "number" && body.elapsed >= 0 ? body.elapsed : 0;

    // Seeded appointments replay their stored transcript; everything else
    // replays the built-in demo script.
    const saved = appointmentId ? await getTranscript(appointmentId) : null;
    const script = saved && saved.segments.length > 0 ? saved.segments : DEMO_SEGMENTS;

    await delay(); // simulated ASR latency
    const segments = script.filter((s) => s.t0 <= elapsed);
    const done = elapsed >= script[script.length - 1].t1;
    return NextResponse.json({ status: done ? "ready" : "recording", segments, done });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
