import type { TranscriptSegment } from "@/lib/types";

// Canned psychiatry-demo content shared by the AI stub endpoints.
// STUB — wire a real ASR/LLM key here (e.g. Deepgram/Whisper + Claude) and
// delete this module; the route contracts stay the same.

export const STUB_LATENCY_MS = 600;

export const delay = (ms = STUB_LATENCY_MS) => new Promise((r) => setTimeout(r, ms));

/** Fallback live-session script (GAD med check) for appointments with no seeded transcript. */
export const DEMO_SEGMENTS: TranscriptSegment[] = [
  { t0: 0, t1: 7, speaker: "practitioner", text: "Hi, good to see you. How have the past two weeks been since we started the sertraline?" },
  { t0: 7, t1: 16, speaker: "client", text: "Better than I expected, honestly. The first week my stomach was off, but that settled down." },
  { t0: 16, t1: 24, speaker: "practitioner", text: "That early nausea is common and usually passes, just like it did. How about the anxiety itself?" },
  { t0: 24, t1: 34, speaker: "client", text: "The constant edge is quieter. I still get spikes before meetings, but I am not waking up at 4 a.m. dreading the day." },
  { t0: 34, t1: 42, speaker: "practitioner", text: "Sleep is holding at what, six and a half, seven hours? Any daytime drowsiness or headaches?" },
  { t0: 42, t1: 49, speaker: "client", text: "About seven. No headaches. Maybe a little flat in the afternoons, but coffee handles it." },
  { t0: 49, t1: 60, speaker: "practitioner", text: "Good. Let us hold at fifty milligrams for two more weeks and reassess a bump to seventy-five then. Keep the morning walk going." },
  { t0: 60, t1: 68, speaker: "client", text: "Works for me. Should I keep filling out the weekly check-in form in the portal?" },
  { t0: 68, t1: 76, speaker: "practitioner", text: "Yes please — the GAD-7 each Sunday. I will send the refill to your pharmacy today and see you on the nineteenth." },
];

const soapPtsd = `## Subjective
Client reports marked improvement in sleep since prazosin was increased: nightmares down from nightly to approximately one per week. Transient orthostatic lightheadedness during the first two days after the dose change, now resolved. Daytime hypervigilance persists in crowded settings (subway at rush hour); grounding skills provide partial relief.

## Objective
Seen via telehealth video. Calm and cooperative, speech normal in rate and tone, thought process linear and future-oriented. No acute distress observed.

## Assessment
PTSD — partial response to current regimen. Sleep markedly improved on prazosin; residual daytime hyperarousal in crowds.

## Plan
- Increase prazosin to 3 mg at bedtime; continue all other medications unchanged
- Continue weekly trauma-focused therapy and daily grounding practice
- Monitor for orthostatic symptoms after the dose change
- Follow up in one week`;

const soapGad = `## Subjective
Client reports reduced baseline anxiety two weeks into sertraline 50 mg. Early GI upset resolved after week one. Anticipatory spikes persist before work meetings; early-morning awakening with dread has stopped. Sleep ~7 hours; mild afternoon flatness, no headaches.

## Objective
Alert, engaged, appropriately groomed. Speech and affect within normal limits. No psychomotor abnormalities.

## Assessment
GAD — early positive response to sertraline 50 mg, tolerating well.

## Plan
- Hold sertraline 50 mg daily x 2 weeks; reassess increase to 75 mg at next visit
- Continue weekly GAD-7 via portal each Sunday
- Maintain daily morning walk (behavioral activation)
- Refill sent to pharmacy; follow up in 2 weeks`;

const dapBody = (ptsd: boolean) => `## Data
${
  ptsd
    ? "Telehealth session reviewing response to prazosin increase. Nightmares reduced to ~1/week (from nightly); brief orthostatic lightheadedness resolved. Hypervigilance persists on crowded transit; client is applying grounding skills with partial benefit."
    : "Session reviewing first two weeks on sertraline 50 mg. Early nausea resolved; baseline worry reduced. Anticipatory anxiety persists before meetings; sleep normalized at ~7 hours."
}

## Assessment
${
  ptsd
    ? "PTSD — partial response; sleep domain markedly improved, daytime hyperarousal residual. Engagement in skills work is good."
    : "GAD — early medication response with good tolerability. Functional improvement at work and in sleep."
}

## Plan
${
  ptsd
    ? "- Titrate prazosin to 3 mg qHS\n- Continue weekly trauma-focused therapy\n- Follow up in 1 week"
    : "- Hold sertraline 50 mg; reassess dose in 2 weeks\n- Weekly GAD-7 via portal\n- Follow up in 2 weeks"
}`;

const progressBody = (ptsd: boolean) => `## Presenting Concerns
${
  ptsd
    ? "Trauma-related nightmares and daytime hypervigilance in crowded settings."
    : "Generalized worry with anticipatory spikes before work meetings; prior early-morning awakening."
}

## Interventions
${
  ptsd
    ? "Reviewed medication response and orthostatic precautions; reinforced grounding skills for transit; confirmed prazosin titration plan."
    : "Reviewed medication response and side-effect course; reinforced behavioral activation (morning walk) and weekly symptom tracking."
}

## Response
${
  ptsd
    ? "Receptive and encouraged by sleep gains; agreed to continue exposure to moderately crowded settings with grounding."
    : "Engaged and optimistic; agreed to continue current dose and complete weekly GAD-7."
}

## Plan
${
  ptsd
    ? "- Prazosin 3 mg qHS\n- Weekly trauma-focused therapy\n- Follow up in 1 week"
    : "- Continue sertraline 50 mg\n- Reassess dose in 2 weeks\n- Weekly GAD-7 via portal"
}`;

export function generatedNote(kind: string, segments: TranscriptSegment[]): { bodyMd: string; summaryMd: string } {
  const ptsd = segments.some((s) => /prazosin|nightmare/i.test(s.text));
  const bodyMd = kind === "dap" ? dapBody(ptsd) : kind === "progress" ? progressBody(ptsd) : ptsd ? soapPtsd : soapGad;
  const summaryMd = ptsd
    ? "## Visit summary\nSleep markedly improved on prazosin (nightmares ~1/wk); orthostatic lightheadedness resolved. Daytime hypervigilance in crowds persists; grounding partially effective.\n\n## Plan\n- Prazosin 3 mg qHS\n- Continue weekly trauma-focused therapy"
    : "## Visit summary\nEarly response to sertraline 50 mg with good tolerability; anticipatory anxiety persists before meetings, sleep normalized.\n\n## Plan\n- Hold 50 mg, reassess in 2 weeks\n- Weekly GAD-7 via portal";
  return { bodyMd, summaryMd };
}
