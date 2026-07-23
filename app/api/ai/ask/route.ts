import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { getNote } from "@/lib/repos/notes";
import { clinicalConfigured, clinicalComplete, parseJsonLoose } from "@/lib/ai/clinical";
import { delay } from "../demo-script";

export const dynamic = "force-dynamic";

const ASK_SYSTEM = `You are a clinical writing assistant helping a psychiatrist edit a note. Answer the clinician's question grounded ONLY in the provided note context — never invent clinical facts, diagnoses, medications, doses, or scores. If the context does not support an answer, say so.
Output ONLY minified JSON with two string keys: "answer" (your reply to the clinician, plain text) and "insertMd" (markdown the clinician can Insert or Replace into the note). No text outside the JSON.`;

/**
 * POST /api/ai/ask { noteId?, question, context? } → { answer, insertMd }
 *
 * STUB — wire an LLM key here (note body + selection are the grounding
 * context). The stub keyword-routes to a few grounded-sounding canned
 * answers; `insertMd` is what the Insert/Replace actions place in the editor.
 */
export async function POST(req: Request) {
  try {
    await requireRole("practitioner");
    let body: { noteId?: unknown; question?: unknown; context?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) return NextResponse.json({ error: "question is required." }, { status: 400 });
    const context = typeof body.context === "string" ? body.context : "";
    const note = typeof body.noteId === "string" ? await getNote(body.noteId) : null;
    const grounding = context || note?.bodyMd || "";

    // Real Claude on Bedrock when configured (PHI-safe, BAA-covered). On failure
    // surface a 502 rather than dropping to canned answers.
    if (clinicalConfigured()) {
      try {
        const { text } = await clinicalComplete({
          system: ASK_SYSTEM,
          user: `Clinical note context:\n${grounding || "(no note context provided)"}\n\nClinician question: ${question}\n\nReturn the JSON now.`,
          maxTokens: 900,
        });
        const parsed = parseJsonLoose<{ answer?: string; insertMd?: string }>(text);
        if (parsed?.answer) {
          return NextResponse.json({ answer: parsed.answer, insertMd: parsed.insertMd ?? "" });
        }
        return NextResponse.json({ answer: text, insertMd: text });
      } catch (err) {
        console.error("ai/ask: Bedrock call failed", (err as Error)?.name ?? "error");
        return NextResponse.json({ error: "The assistant is temporarily unavailable. Try again." }, { status: 502 });
      }
    }

    const ptsd = /prazosin|nightmare|hypervigilan/i.test(grounding);

    await delay(); // simulated LLM latency

    let answer: string;
    let insertMd: string;
    const q = question.toLowerCase();
    if (/summar|bullet|key point/.test(q)) {
      insertMd = ptsd
        ? "- Nightmares reduced to ~1/week on prazosin (from nightly)\n- Transient orthostatic lightheadedness, now resolved\n- Daytime hypervigilance persists in crowded settings\n- Grounding skills partially effective; client engaged in plan"
        : "- Baseline anxiety reduced after 2 weeks on sertraline 50 mg\n- Early GI upset resolved; sleep normalized at ~7 hours\n- Anticipatory spikes persist before work meetings\n- Client adherent and engaged with behavioral plan";
      answer = `Here is a bullet summary of the key clinical points from this session:\n\n${insertMd}\n\nWant me to tighten this further or fold it into the Assessment section?`;
    } else if (/plan|next|follow.?up/.test(q)) {
      insertMd = ptsd
        ? "- Increase prazosin to 3 mg at bedtime; monitor orthostatic symptoms\n- Continue weekly trauma-focused therapy and daily grounding practice\n- Follow up in 1 week to reassess sleep and daytime hyperarousal"
        : "- Hold sertraline 50 mg daily; reassess increase to 75 mg in 2 weeks\n- Weekly GAD-7 via the portal each Sunday\n- Follow up in 2 weeks; refill sent to pharmacy";
      answer = `Based on this session, the plan items are:\n\n${insertMd}\n\nI can rewrite these in a more concise or more detailed style if you prefer.`;
    } else if (/professional|tone|rewrite|concise|grammar|spell/.test(q)) {
      insertMd = context
        ? context.replace(/\s+/g, " ").trim()
        : "Client demonstrates a partial treatment response with improved sleep continuity and reduced nocturnal symptoms; residual daytime hyperarousal remains the primary treatment target.";
      answer = `Here is a tightened, clinical rewrite:\n\n> ${insertMd}\n\nUse Replace to swap it in for the highlighted text, or Insert to add it below.`;
    } else {
      insertMd = ptsd
        ? "Client reports meaningful improvement in trauma-related sleep disturbance with residual daytime hypervigilance; treatment response is partial and trending positively."
        : "Client shows an early positive response to the current regimen with good tolerability; residual anticipatory anxiety remains the focus of ongoing work.";
      answer = `${
        ptsd
          ? "Grounded in this note: sleep has improved markedly on prazosin (nightmares ~1/week, previously nightly) while daytime hypervigilance in crowds persists — a partial but clear treatment response."
          : "Grounded in this note: the client is two weeks into sertraline 50 mg with resolved early side effects, normalized sleep, and reduced baseline worry — an early positive response."
      }\n\nSuggested wording you could add:\n\n> ${insertMd}`;
    }

    return NextResponse.json({ answer, insertMd });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
