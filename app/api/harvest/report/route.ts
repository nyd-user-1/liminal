import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "@vercel/connect";

// Farmer John — files/updates Linear issues for the nightly harvest runner's
// failed or suspect jobs. Called by ops/harvest/runner.mjs (a local launchd
// job, not Vercel code) over plain HTTP at the end of every run, the same way
// it already emails failures and rings the in-app bell. This route is the
// ONLY thing allowed to mint Farmer John's Linear token: getToken() depends on
// Vercel's own request-time infrastructure and only works for code actually
// running on Vercel (confirmed via the connector's "Test App Token" — the
// token is ~1h TTL, refreshed on demand, never meant to be cached to a static
// secret). No PHI: job ids, durations, and error strings only.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINEAR_TEAM_KEY = "NYS";
const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

type JobResult = { id: string; ok: boolean; suspect?: boolean; note: string; logFile?: string };

function authorize(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set on this deployment." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return null;
}

async function linear<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(LINEAR_GRAPHQL_URL, {
    method: "POST",
    // An OAuth app-actor token (unlike a Linear Personal API Key, which Linear
    // accepts raw with no prefix) needs the standard Bearer scheme.
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (!res.ok || json.errors?.length) {
    throw new Error(json.errors?.map((e) => e.message).join("; ") ?? `Linear API ${res.status}`);
  }
  return json.data as T;
}

// The job id (e.g. "harvest:mrf-emblem", "daily") is the dedup key — every
// title carries it verbatim so a later run can find the SAME open issue
// instead of filing a duplicate for a job that's been broken for days.
const titleFor = (job: JobResult) => `[Farmer John] ${job.id} — needs attention`;

async function findOpenIssue(token: string, job: JobResult): Promise<{ id: string; identifier: string } | null> {
  const data = await linear<{ issues: { nodes: Array<{ id: string; identifier: string }> } }>(
    token,
    `query($teamKey: String!, $needle: String!) {
      issues(
        filter: {
          team: { key: { eq: $teamKey } }
          title: { contains: $needle }
          state: { type: { nin: ["completed", "canceled"] } }
        }
        first: 1
      ) { nodes { id identifier } }
    }`,
    { teamKey: LINEAR_TEAM_KEY, needle: titleFor(job) },
  );
  return data.issues.nodes[0] ?? null;
}

async function createIssue(token: string, job: JobResult, body: string): Promise<{ identifier: string } | null> {
  const teamData = await linear<{ teams: { nodes: Array<{ id: string }> } }>(
    token,
    `query($teamKey: String!) { teams(filter: { key: { eq: $teamKey } }) { nodes { id } } }`,
    { teamKey: LINEAR_TEAM_KEY },
  );
  const teamId = teamData.teams.nodes[0]?.id;
  if (!teamId) throw new Error(`No Linear team found for key "${LINEAR_TEAM_KEY}"`);

  const data = await linear<{ issueCreate: { success: boolean; issue: { identifier: string } | null } }>(
    token,
    `mutation($teamId: String!, $title: String!, $description: String!) {
      issueCreate(input: { teamId: $teamId, title: $title, description: $description }) {
        success
        issue { identifier }
      }
    }`,
    { teamId, title: titleFor(job), description: body },
  );
  return data.issueCreate.issue;
}

async function addComment(token: string, issueId: string, body: string): Promise<void> {
  await linear<{ commentCreate: { success: boolean } }>(
    token,
    `mutation($issueId: String!, $body: String!) {
      commentCreate(input: { issueId: $issueId, body: $body }) { success }
    }`,
    { issueId, body },
  );
}

function bodyFor(job: JobResult): string {
  const lines = [`**${job.note}**`, "", `Job: \`${job.id}\``, `Reported: ${new Date().toISOString()}`];
  if (job.logFile) lines.push(`Log: \`${job.logFile}\``);
  return lines.join("\n");
}

/** POST /api/harvest/report { results: JobResult[] } — files or updates a
 *  Linear issue per failed/suspect job. Every other job is a no-op: a ticket
 *  is for something that needs a human, not a green run. */
export async function POST(req: NextRequest) {
  const denied = authorize(req);
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as { results?: JobResult[] } | null;
  const results = body?.results;
  if (!Array.isArray(results)) {
    return NextResponse.json({ error: "Expected { results: JobResult[] }." }, { status: 400 });
  }

  const flagged = results.filter((r) => !r.ok || r.suspect);
  if (flagged.length === 0) return NextResponse.json({ filed: 0, commented: 0, jobs: [] });

  let token: string;
  try {
    token = await getToken("linear/farmer-john", { subject: { type: "app" } });
  } catch (e) {
    console.error("harvest report: getToken failed", e);
    return NextResponse.json({ error: "Could not obtain Farmer John's Linear token." }, { status: 502 });
  }

  let filed = 0;
  let commented = 0;
  const jobs: Array<{ id: string; action: "filed" | "commented" | "error"; identifier?: string; error?: string }> = [];

  for (const job of flagged) {
    try {
      const existing = await findOpenIssue(token, job);
      if (existing) {
        await addComment(token, existing.id, bodyFor(job));
        commented += 1;
        jobs.push({ id: job.id, action: "commented", identifier: existing.identifier });
      } else {
        const created = await createIssue(token, job, bodyFor(job));
        filed += 1;
        jobs.push({ id: job.id, action: "filed", identifier: created?.identifier });
      }
    } catch (e) {
      console.error(`harvest report: ${job.id} failed`, e);
      jobs.push({ id: job.id, action: "error", error: String((e as Error).message ?? e).slice(0, 500) });
    }
  }

  return NextResponse.json({ filed, commented, jobs });
}
