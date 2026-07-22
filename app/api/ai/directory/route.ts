import { anthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  tool,
  toUIMessageStream,
  type ModelMessage,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import {
  DIRECTORY_SYSTEM,
  runDirectoryFacets,
  runGetProvider,
  runMarketRates,
  runSearchProviders,
} from "@/lib/ai/directory-tools";

// POST /api/ai/directory — the care-directory agent, streamed.
//   { messages: UIMessage[], model?: string } → AI SDK UI message stream
//     (text deltas + live tool parts; the page consumes it with useChat).
//
// Reference data only (providers, networks, published rates) — no PHI touches
// this route, so there is no logEvent here; the audit boundary is clinical
// records, not public-directory questions. Auth-gated all the same: it burns
// API tokens, so it is not an anonymous endpoint. Making it truly public later
// means adding rate limiting + a spend cap, not removing requireUser lightly.
//
// Speed levers in play: true streaming (first tool call visible in ~2s),
// prompt caching on the stable system+tools prefix (cache_control below),
// thinking left OFF (Opus 4.8 runs without thinking when the param is omitted),
// and a model picker — Sonnet/Haiku answer materially faster than Opus.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MODELS = new Set(["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"]);
const DEFAULT_MODEL = process.env.LIMINAL_DIRECTORY_AI_MODEL ?? "claude-haiku-4-5";

const tools = {
  search_providers: tool({
    description:
      "Search the NY provider directory. Call this when the user wants providers matching criteria (name, place, profession, insurance). Call directory_facets first if unsure of valid values for profession/subspecialty/county/insurance_payer. Returns one page (10 rows) plus the total count.",
    inputSchema: z.object({
      q: z.string().optional().describe("Free-text name search (provider name fragment)"),
      city: z.string().optional(),
      county: z.string().optional(),
      zip: z.string().optional().describe("5-digit ZIP"),
      profession: z.string().optional().describe("Exact profession from directory_facets"),
      subspecialty: z.string().optional().describe("Exact subspecialty from directory_facets"),
      gender: z.enum(["F", "M"]).optional(),
      provider_type: z
        .enum(["therapist", "psychiatrist", "prescriber"])
        .optional()
        .describe("Coarse filter: therapist (non-prescribing), psychiatrist/prescriber (can prescribe)"),
      insurance_payer: z
        .string()
        .optional()
        .describe("Payer slug from directory_facets — keeps only providers in that payer's directory"),
      sort: z
        .enum(["accepting", "network"])
        .optional()
        .describe("Server-side sort: accepting-new-patients first, or most network memberships first"),
      page: z.number().int().optional().describe("1-based page (10 per page)"),
    }),
    execute: (input) => runSearchProviders(input),
  }),
  get_provider: tool({
    description:
      "Full record for one provider by NPI: identity, contact, insurance-network participation, and their published in-network rates. Use after search_providers to drill into a specific provider.",
    inputSchema: z.object({ npi: z.string().describe("10-digit NPI") }),
    execute: (input) => runGetProvider(input),
  }),
  market_rates: tool({
    description:
      "Market-level published rates: what an insurer pays in-network for the five core behavioral-health CPT codes (90791 intake, 90834 45-min therapy, 90837 60-min therapy, 90853 group, 99214 medication management). Returns distribution stats (median/quartiles) and optionally the top-paid billing entities. Use for 'what does X pay' and rate-comparison questions.",
    inputSchema: z.object({
      payer: z
        .string()
        .optional()
        .describe("Insurer name or fragment (e.g. 'Cigna', 'Oxford'). Omit to get stats for every insurer."),
      code: z
        .enum(["90791", "90834", "90837", "90853", "99214"])
        .optional()
        .describe("CPT code to rank/summarize. Default 90837."),
      top: z
        .number()
        .int()
        .optional()
        .describe("Also return the N highest-paid billing entities for that payer+code (max 10)"),
    }),
    execute: (input) => runMarketRates(input),
  }),
  directory_facets: tool({
    description:
      "Valid filter values: professions, subspecialties, counties, cities, and the insurance payers we track (slug + name + provider count). Cheap — call whenever you need to map a user's words onto exact filter values.",
    inputSchema: z.object({}),
    execute: () => runDirectoryFacets(),
  }),
};

export async function POST(req: Request) {
  try {
    await requireUser();
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Directory assistant is not configured." }, { status: 503 });
    }

    const body = (await req.json()) as { messages?: UIMessage[]; model?: string };
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: "messages are required." }, { status: 400 });
    }
    const model = body.model && MODELS.has(body.model) ? body.model : DEFAULT_MODEL;

    // Cache breakpoint on the last conversation message: everything before it
    // (tools + instructions + history) is served from Anthropic's prompt cache
    // on each tool round and each follow-up turn — most of this route's
    // time-to-first-token.
    const messages: ModelMessage[] = await convertToModelMessages(body.messages.slice(-24));
    if (messages.length) {
      messages[messages.length - 1].providerOptions = {
        anthropic: { cacheControl: { type: "ephemeral" } },
      };
    }

    const result = streamText({
      model: anthropic(model),
      instructions: DIRECTORY_SYSTEM,
      messages,
      tools,
      stopWhen: isStepCount(8),
    });

    return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("ai/directory failed", (err as Error)?.name ?? "error");
    return NextResponse.json({ error: "The directory assistant is temporarily unavailable." }, { status: 502 });
  }
}
