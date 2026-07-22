import Anthropic from "@anthropic-ai/sdk";
import { searchProviders, getProviderByNpi, providerFacets } from "@/lib/repos/directory";
import { listPayerFacets, networkParticipationForNpi } from "@/lib/repos/networks";
import { listProviderRates } from "@/lib/repos/rate-directory";
import { getRateTable } from "@/lib/repos/rate-table";
import { RATE_TABLE_PAYERS, type RateTableRow } from "@/lib/rate-table";

// Conversational agent over the PUBLIC reference dataset (directory providers,
// insurance participation, published MRF rates). NO PHI: every tool reads the
// reference database (`sql`), never the clinical one — this module must never
// import clients/notes/threads repos. The Anthropic first-party API is the
// right venue for exactly that reason (see lib/ai/bedrock.ts for the split).
//
// Architecture: the model never sees the corpus. It sees four narrow tools that
// wrap the same matview-backed repos the index pages use, each returning a few
// KB of rows. The loop is the commodity; the tools are the product.

const MODEL = process.env.LIMINAL_DIRECTORY_AI_MODEL ?? "claude-opus-4-8";
const MAX_TOOL_ROUNDS = 6;

const SYSTEM = `You are Liminal's care-directory assistant. You answer questions about New York behavioral-health providers using live tools over Liminal's reference dataset:
- ~126,000 NY providers (NPPES + NY Medicaid), with profession, subspecialty, location, and contact details.
- Insurance participation pulled from payers' own FHIR provider directories.
- Real negotiated rates from insurers' federally mandated machine-readable files (~15M rate rows, pre-aggregated).

Data honesty rules (non-negotiable):
- Only state facts returned by tools. Never invent a provider, NPI, phone number, network, or dollar figure.
- Rates are what the INSURER publishes it pays in-network — always name the payer and the as-of date when quoting one. They are per-session negotiated amounts, not provider revenue or patient prices.
- A provider "listed in a payer's directory" is a solid claim; "accepting new patients" is only known when the payer publishes it. Don't upgrade one into the other.
- If a search returns nothing, say so and suggest loosening a filter — never fill the gap from memory.

Style: plain language, concise. Lead with the answer. Use a markdown table when comparing 3+ providers or rates. Include NPI when naming a specific provider so the user can look them up. One clarifying question only when the request is truly ambiguous; otherwise pick sensible defaults and say what you assumed.

Tool guidance: call directory_facets first when you need valid filter values (payer slugs, professions, counties). Prefer search_providers → get_provider to drill in. market_rates answers "what does insurer X pay" questions.`;

// ── tool definitions ─────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_providers",
    description:
      "Search the NY provider directory. Call this when the user wants providers matching criteria (name, place, profession, insurance). Call directory_facets first if unsure of valid values for profession/subspecialty/county/insurance_payer. Returns one page (10 rows) plus the total count.",
    input_schema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Free-text name search (provider name fragment)" },
        city: { type: "string" },
        county: { type: "string" },
        zip: { type: "string", description: "5-digit ZIP" },
        profession: { type: "string", description: "Exact profession from directory_facets" },
        subspecialty: { type: "string", description: "Exact subspecialty from directory_facets" },
        gender: { type: "string", enum: ["F", "M"] },
        provider_type: {
          type: "string",
          enum: ["therapist", "psychiatrist", "prescriber"],
          description: "Coarse filter: therapist (non-prescribing), psychiatrist/prescriber (can prescribe)",
        },
        insurance_payer: {
          type: "string",
          description: "Payer slug from directory_facets — keeps only providers in that payer's directory",
        },
        sort: { type: "string", enum: ["accepting", "network"], description: "Server-side sort: accepting-new-patients first, or most network memberships first" },
        page: { type: "integer", description: "1-based page (10 per page)" },
      },
    },
  },
  {
    name: "get_provider",
    description:
      "Full record for one provider by NPI: identity, contact, insurance-network participation, and their published in-network rates. Use after search_providers to drill into a specific provider.",
    input_schema: {
      type: "object",
      properties: { npi: { type: "string", description: "10-digit NPI" } },
      required: ["npi"],
    },
  },
  {
    name: "market_rates",
    description:
      "Market-level published rates: what an insurer pays in-network for the five core behavioral-health CPT codes (90791 intake, 90834 45-min therapy, 90837 60-min therapy, 90853 group, 99214 medication management). Returns distribution stats (median/quartiles) and optionally the top-paid billing entities. Use for 'what does X pay' and rate-comparison questions.",
    input_schema: {
      type: "object",
      properties: {
        payer: { type: "string", description: "Insurer name or fragment (e.g. 'Cigna', 'Oxford'). Omit to get stats for every insurer." },
        code: { type: "string", enum: ["90791", "90834", "90837", "90853", "99214"], description: "CPT code to rank/summarize. Default 90837." },
        top: { type: "integer", description: "Also return the N highest-paid billing entities for that payer+code (max 10)" },
      },
    },
  },
  {
    name: "directory_facets",
    description:
      "Valid filter values: professions, subspecialties, counties, cities, and the insurance payers we track (slug + name + provider count). Cheap — call whenever you need to map a user's words onto exact filter values.",
    input_schema: { type: "object", properties: {} },
  },
];

// ── tool implementations ─────────────────────────────────────────────────────

type SearchInput = {
  q?: string; city?: string; county?: string; zip?: string; profession?: string;
  subspecialty?: string; gender?: string; provider_type?: "therapist" | "psychiatrist" | "prescriber";
  insurance_payer?: string; sort?: "accepting" | "network"; page?: number;
};

async function runSearchProviders(input: SearchInput) {
  const res = await searchProviders({
    q: input.q, city: input.city, county: input.county, zip: input.zip,
    profession: input.profession, subspecialty: input.subspecialty, gender: input.gender,
    providerType: input.provider_type, insurancePayer: input.insurance_payer,
    sort: input.sort, page: input.page ?? 1, pageSize: 10,
  });
  return {
    total: res.total,
    page: res.page,
    items: res.items.map((p) => ({
      npi: p.npi, name: p.name, profession: p.profession, subspecialty: p.subspecialty ?? null,
      credential: p.credential ?? null, city: p.city, county: p.county, phone: p.phone,
    })),
  };
}

async function runGetProvider(input: { npi?: string }) {
  const npi = (input.npi ?? "").replace(/\D/g, "");
  if (npi.length !== 10) return { error: "npi must be 10 digits" };
  const p = await getProviderByNpi(npi);
  if (!p) return { error: `No provider with NPI ${npi} in the directory` };
  const [networks, rates] = await Promise.all([
    networkParticipationForNpi(npi).catch(() => []),
    listProviderRates(npi).catch(() => []),
  ]);
  const cappedRates = rates.slice(0, 40);
  return {
    provider: {
      npi: p.npi, name: p.name, profession: p.profession, subspecialty: p.subspecialty ?? null,
      credential: p.credential ?? null, gender: p.gender ?? null, address: p.address,
      city: p.city, county: p.county, zip: p.zip, phone: p.phone,
    },
    insuranceNetworks: networks,
    publishedRates: cappedRates,
    ratesTruncated: rates.length > cappedRates.length ? rates.length : undefined,
  };
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return Math.round((sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)) * 100) / 100;
}

async function runMarketRates(input: { payer?: string; code?: string; top?: number }) {
  const code = (input.code ?? "90837") as "90791" | "90834" | "90837" | "90853" | "99214";
  const field = `c${code}` as keyof RateTableRow;
  const data = await getRateTable();
  const needle = input.payer?.trim().toLowerCase();
  const payers = RATE_TABLE_PAYERS.filter((p) => !needle || p.toLowerCase().includes(needle));
  if (!payers.length) {
    return { error: `No tracked insurer matches "${input.payer}"`, trackedInsurers: RATE_TABLE_PAYERS };
  }
  const out = payers.map((payer) => {
    const rows = data.rows.filter((r) => r.payer === payer && typeof r[field] === "number");
    const values = rows.map((r) => r[field] as number).sort((a, b) => a - b);
    const summary = {
      payer,
      asOf: data.asOfByPayer[payer] ?? null,
      code,
      billingEntities: values.length,
      p25: quantile(values, 0.25),
      median: quantile(values, 0.5),
      p75: quantile(values, 0.75),
      max: values.length ? values[values.length - 1] : NaN,
    };
    if (!input.top) return summary;
    const top = rows
      .sort((a, b) => (b[field] as number) - (a[field] as number))
      .slice(0, Math.min(input.top, 10))
      .map((r) => ({
        name: r.displayName ?? "(unnamed billing group)",
        kind: r.entityKind,
        credential: r.credential,
        providers: r.nProviders,
        rate: r[field],
      }));
    return { ...summary, topEntities: top };
  });
  return { results: out };
}

async function runDirectoryFacets() {
  const [facets, payers] = await Promise.all([providerFacets(), listPayerFacets()]);
  return {
    professions: facets.professions,
    subspecialties: facets.subspecialties,
    counties: facets.counties,
    cities: facets.cities.slice(0, 60),
    insurancePayers: payers.map((p) => ({
      slug: p.slug, name: p.name, providerCount: p.providerCount,
      directoryOnly: p.coarse || undefined,
    })),
    rateTrackedInsurers: RATE_TABLE_PAYERS,
  };
}

async function runTool(name: string, input: unknown): Promise<unknown> {
  switch (name) {
    case "search_providers": return runSearchProviders(input as SearchInput);
    case "get_provider": return runGetProvider(input as { npi?: string });
    case "market_rates": return runMarketRates(input as { payer?: string; code?: string; top?: number });
    case "directory_facets": return runDirectoryFacets();
    default: return { error: `Unknown tool: ${name}` };
  }
}

// ── the loop ─────────────────────────────────────────────────────────────────

export type DirectoryTurn = { role: "user" | "assistant"; content: string };
export type DirectoryTraceEntry = { tool: string; input: unknown };
export type DirectoryAnswer = {
  answer: string;
  trace: DirectoryTraceEntry[];
  inputTokens: number;
  outputTokens: number;
};

export function directoryAgentConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * One question → tool loop → final text. `history` is prior turns as plain
 * text (the UI's transcript); tool activity is not replayed across requests.
 * Throws on API failure — the route maps that to a 502.
 */
export async function askDirectory(question: string, history: DirectoryTurn[] = []): Promise<DirectoryAnswer> {
  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: "user" as const, content: question },
  ];

  const trace: DirectoryTraceEntry[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: SYSTEM,
      tools: TOOLS,
      messages,
    });
    inputTokens += response.usage.input_tokens;
    outputTokens += response.usage.output_tokens;

    if (response.stop_reason !== "tool_use") {
      const answer = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { answer, trace, inputTokens, outputTokens };
    }

    // Echo the full assistant content (thinking blocks included) and answer
    // every tool_use in ONE user message — splitting results across messages
    // degrades parallel tool use.
    messages.push({ role: "assistant", content: response.content });
    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const results = await Promise.all(
      toolUses.map(async (t): Promise<Anthropic.ToolResultBlockParam> => {
        trace.push({ tool: t.name, input: t.input });
        try {
          const result = await runTool(t.name, t.input);
          return { type: "tool_result", tool_use_id: t.id, content: JSON.stringify(result) };
        } catch (err) {
          return {
            type: "tool_result",
            tool_use_id: t.id,
            content: `Tool failed: ${(err as Error).message}`,
            is_error: true,
          };
        }
      }),
    );
    messages.push({ role: "user", content: results });
  }

  throw new Error(`Tool loop exceeded ${MAX_TOOL_ROUNDS} rounds`);
}
