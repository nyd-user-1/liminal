import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
} from "@aws-sdk/client-bedrock-runtime";

// Claude on Amazon Bedrock — the BAA-covered path for PHI-bearing AI.
//
// The AWS Business Associate Addendum (accepted in AWS Artifact) covers Bedrock
// as a HIPAA-eligible service, so clinical transcripts and notes MAY be sent
// here. They may NOT be sent to the first-party Anthropic API (@anthropic-ai/sdk),
// which is not an AWS service and which no AWS BAA reaches — that path is for
// non-PHI only (see lib/briefing.ts, which sends table counts, never PHI).
//
// NEVER LOG PHI. This module logs model id, latency, and token counts only —
// never prompt or completion text. Callers must do the same.
//
// Config (all required for the real path; absent → bedrockConfigured() is false
// and clinical callers fall back or fail closed, they never fabricate):
//   LIMINAL_BEDROCK_MODEL_ID    the exact Bedrock model id / inference profile
//                               for the Claude model enabled in your account,
//                               e.g. an "us.anthropic.claude-*" inference
//                               profile. Copy it from the Bedrock console.
//   LIMINAL_BEDROCK_REGION      region where the model is enabled (falls back
//                               to LIMINAL_SES_REGION so one region env can
//                               serve both AWS integrations).
//   LIMINAL_AWS_ACCESS_KEY_ID / LIMINAL_AWS_SECRET_ACCESS_KEY
//                               IAM creds with bedrock:InvokeModel.

let client: BedrockRuntimeClient | null = null;
function bedrock(): BedrockRuntimeClient | null {
  const region = process.env.LIMINAL_BEDROCK_REGION ?? process.env.LIMINAL_SES_REGION;
  const accessKeyId = process.env.LIMINAL_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.LIMINAL_AWS_SECRET_ACCESS_KEY;
  if (!region || !accessKeyId || !secretAccessKey) return null;
  if (!client) client = new BedrockRuntimeClient({ region, credentials: { accessKeyId, secretAccessKey } });
  return client;
}

/** True when a Bedrock model id + client credentials are all present. Clinical
 *  routes check this to decide real-Claude vs. their demo fallback. */
export function bedrockConfigured(): boolean {
  return !!process.env.LIMINAL_BEDROCK_MODEL_ID && !!bedrock();
}

export type ClinicalCompletion = { text: string; inputTokens?: number; outputTokens?: number };

/**
 * One-shot Claude completion on Bedrock via the Converse API. Returns the
 * assistant text. THROWS on misconfiguration or API error — the caller decides
 * the fallback, because clinical routes must never fabricate a note on failure.
 */
export async function clinicalComplete(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<ClinicalCompletion> {
  const c = bedrock();
  const modelId = process.env.LIMINAL_BEDROCK_MODEL_ID;
  if (!c || !modelId) throw new Error("Bedrock not configured");

  const messages: Message[] = [{ role: "user", content: [{ text: opts.user }] }];
  const res = await c.send(
    new ConverseCommand({
      modelId,
      system: [{ text: opts.system }],
      messages,
      inferenceConfig: { maxTokens: opts.maxTokens ?? 1400, temperature: opts.temperature ?? 0.2 },
    }),
  );

  const text = (res.output?.message?.content ?? [])
    .map((b) => (b as { text?: string }).text ?? "")
    .join("")
    .trim();
  return { text, inputTokens: res.usage?.inputTokens, outputTokens: res.usage?.outputTokens };
}

/** Pull the first JSON object out of a model reply (tolerates ```json fences
 *  or leading prose). Returns null if nothing parses. */
export function parseJsonLoose<T>(text: string): T | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}
