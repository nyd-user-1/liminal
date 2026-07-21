import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// The fleet fuel gauge — the three readings the /workspace gauge row renders.
// Server-only: it touches ~/.claude, which no browser may ever read.
//
// TWO different kinds of number live here, and the payload keeps them apart:
//
//   LIVE     the five-hour (session) and seven-day (week) rate-limit windows,
//            read verbatim off Claude Code's own statusline snapshot
//            (~/.claude/hq/statusline-snapshot.json). Real percentages, real
//            reset clocks — nothing of ours is applied to them.
//   MODELED  the Fable share, metered from the local transcripts
//            (~/.claude/projects/**/*.jsonl) by the method hq already ships in
//            ~/Code/hq/lib/usage.ts: dedupe by requestId, weight the token
//            shape, weight again by model tier. It is an estimate and the card
//            says so.
//
// Reading the transcripts is a full walk of the trailing week's files the first
// time (~1.6s over ~70 files / ~390MB here), so — exactly as hq does — each file
// is cached by byte offset and only appended bytes are parsed after that. The
// gauge is fetched from a route, never during page render, so even the cold walk
// never blocks the workspace.

const CLAUDE_HOME = path.join(os.homedir(), ".claude");
const PROJECTS_ROOT = path.join(CLAUDE_HOME, "projects");
const STATUSLINE_SNAP = path.join(CLAUDE_HOME, "hq", "statusline-snapshot.json");

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Older than this and the snapshot is no longer a live reading — we show the
 *  honest empty state rather than a stale percentage. Same TTL hq uses. */
const LIVE_TTL_MS = 2 * 60 * 60 * 1000;

// ── the live windows ────────────────────────────────────────────────────────

interface LiveWindow {
  /** 0–100, Claude Code's own figure. */
  pct: number;
  /** ms epoch, converted from the snapshot's unix SECONDS. */
  resetsAt: number | null;
}

interface LiveSnapshot {
  capturedAt: number;
  fiveHour: LiveWindow | null;
  sevenDay: LiveWindow | null;
}

/** Claude Code's statusline shim writes its full status JSON here on every
 *  assistant message; `rate_limits` is the only part we read. Null when the file
 *  is missing, unparseable, or carries no rate limits (not a subscriber, or no
 *  session has rendered a statusline yet). */
function readLiveSnapshot(): LiveSnapshot | null {
  let raw: unknown;
  let capturedAt: number;
  try {
    raw = JSON.parse(fs.readFileSync(STATUSLINE_SNAP, "utf8"));
    capturedAt = fs.statSync(STATUSLINE_SNAP).mtimeMs;
  } catch {
    return null;
  }
  const limits = (
    raw as {
      rate_limits?: Record<string, { used_percentage?: number; resets_at?: number } | undefined>;
    }
  )?.rate_limits;
  if (!limits) return null;

  const read = (w: { used_percentage?: number; resets_at?: number } | undefined): LiveWindow | null =>
    w && typeof w.used_percentage === "number"
      ? {
          pct: w.used_percentage,
          // resets_at is unix SECONDS in this file; everything downstream is ms.
          resetsAt: typeof w.resets_at === "number" ? w.resets_at * 1000 : null,
        }
      : null;

  return { capturedAt, fiveHour: read(limits.five_hour), sevenDay: read(limits.seven_day) };
}

// ── the modeled model mix ───────────────────────────────────────────────────

// Within-model token shape, the standard Anthropic price ratios hq uses:
// fresh input ×1, cache write ×1.25, cache read ×0.1, output ×5.
const shape = (input: number, cw: number, cr: number, out: number): number =>
  input + 1.25 * cw + 0.1 * cr + 5 * out;

// Per-model multiplier relative to Sonnet = 1.0 — a price-tier proxy for how
// fast a model burns the window. Copied from hq's MODEL_WEIGHT, INCLUDING its
// caveat: this is a CALIBRATION KNOB, not a measured constant, and Fable's 5.0
// is a placeholder until a Fable-heavy block is measured against /usage. The
// card that consumes it is labelled "modeled" for exactly this reason.
const MODEL_WEIGHT: Array<[string, number]> = [
  ["opus", 5.0],
  ["sonnet", 1.0],
  ["haiku", 0.33],
  ["fable", 5.0],
  ["mythos", 5.0],
];
function modelWeight(model?: string): number {
  if (!model) return 1.0;
  const m = model.toLowerCase();
  for (const [key, w] of MODEL_WEIGHT) if (m.includes(key)) return w;
  return 1.0;
}

/** The human bucket /usage groups by ("Current week (Fable)"). */
const TIER_LABEL: Array<[string, string]> = [
  ["opus", "Opus"],
  ["sonnet", "Sonnet"],
  ["haiku", "Haiku"],
  ["fable", "Fable"],
  ["mythos", "Mythos"],
];
function modelTier(model?: string): string {
  if (!model) return "Other";
  const m = model.toLowerCase();
  for (const [key, label] of TIER_LABEL) if (m.includes(key)) return label;
  return "Other";
}

/** One deduped assistant turn. */
interface Rec {
  ts: number;
  model?: string;
  input: number;
  cw: number;
  cr: number;
  out: number;
}
interface FileCache {
  offset: number;
  recs: Map<string, Rec>;
}

const fileCache = new Map<string, FileCache>();

/** Parse only the bytes appended since the last pass. Claude Code writes a
 *  message's usage block several times while streaming, so records are keyed by
 *  requestId (last write wins) — summing every line would triple-count. */
function parseNewLines(file: string, cache: FileCache): void {
  const size = fs.statSync(file).size;
  if (size < cache.offset) {
    // truncated/rotated — start the file over
    cache.offset = 0;
    cache.recs = new Map();
  }
  if (size === cache.offset) return;

  const fd = fs.openSync(file, "r");
  const buf = Buffer.alloc(size - cache.offset);
  fs.readSync(fd, buf, 0, buf.length, cache.offset);
  fs.closeSync(fd);

  const text = buf.toString("utf8");
  const lastNewline = text.lastIndexOf("\n");
  if (lastNewline === -1) return; // a partial line — wait for the rest
  cache.offset += Buffer.byteLength(text.slice(0, lastNewline + 1), "utf8");

  for (const line of text.slice(0, lastNewline).split("\n")) {
    if (!line.includes('"usage"')) continue;
    let entry: {
      requestId?: string;
      timestamp?: string;
      message?: { id?: string; model?: string; usage?: Record<string, number> };
    };
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const usage = entry?.message?.usage;
    const ts = Date.parse(entry?.timestamp ?? "");
    if (!usage || Number.isNaN(ts)) continue;
    const id = entry.requestId ?? entry.message?.id ?? `_n${cache.recs.size}`;
    cache.recs.set(id, {
      ts,
      model: entry.message?.model,
      input: usage.input_tokens ?? 0,
      cw: usage.cache_creation_input_tokens ?? 0,
      cr: usage.cache_read_input_tokens ?? 0,
      out: usage.output_tokens ?? 0,
    });
  }
}

/** Transcripts touched within the trailing week. Empty when ~/.claude/projects
 *  isn't there at all (a deployed build) — the Fable card then renders empty. */
function transcriptFiles(): string[] {
  const cutoff = Date.now() - WEEK_MS;
  const files: string[] = [];
  let dirs: fs.Dirent[];
  try {
    dirs = fs.readdirSync(PROJECTS_ROOT, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const dirPath = path.join(PROJECTS_ROOT, dir.name);
    let names: string[];
    try {
      names = fs.readdirSync(dirPath);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.endsWith(".jsonl")) continue;
      const full = path.join(dirPath, name);
      try {
        if (fs.statSync(full).mtimeMs >= cutoff) files.push(full);
      } catch {
        // vanished mid-scan
      }
    }
  }
  return files;
}

let lastRefreshAt = 0;
function refreshCache(): void {
  const now = Date.now();
  if (now - lastRefreshAt < 5_000) return; // a poll every 60s doesn't need a re-walk per hit
  lastRefreshAt = now;
  for (const file of transcriptFiles()) {
    let cache = fileCache.get(file);
    if (!cache) {
      cache = { offset: 0, recs: new Map() };
      fileCache.set(file, cache);
    }
    try {
      parseNewLines(file, cache);
    } catch {
      // unreadable — skip
    }
  }
}

export interface ModelShare {
  tier: string;
  weighted: number;
  pct: number;
}

/** Weighted work per model tier over the trailing 7 days, biggest first.
 *  Empty when there are no transcripts to meter. */
export function weekModelMix(): { shares: ModelShare[]; totalWeighted: number } {
  refreshCache();
  const since = Date.now() - WEEK_MS;
  const byTier = new Map<string, number>();
  let total = 0;
  for (const { recs } of fileCache.values()) {
    for (const r of recs.values()) {
      if (r.ts < since) continue;
      const w = shape(r.input, r.cw, r.cr, r.out) * modelWeight(r.model);
      total += w;
      const tier = modelTier(r.model);
      byTier.set(tier, (byTier.get(tier) ?? 0) + w);
    }
  }
  const shares = [...byTier.entries()]
    .map(([tier, weighted]) => ({ tier, weighted, pct: total ? (weighted / total) * 100 : 0 }))
    .sort((a, b) => b.weighted - a.weighted);
  return { shares, totalWeighted: total };
}

// ── the gauge payload ───────────────────────────────────────────────────────

/** healthy / warning / depleted are the PACING.md bands on a consumption
 *  window. `share` is not a fuel level at all — it's a slice of a mix — so it
 *  never ramps to red. */
export type GaugeState = "healthy" | "warning" | "depleted" | "share";

export interface GaugeCard {
  key: "session" | "week" | "fable";
  label: string;
  /** 0–100, or null when there is nothing honest to show. */
  pct: number | null;
  state: GaugeState;
  source: "live" | "modeled";
  /** Why there is no reading, when there isn't one. Null while a reading
   *  exists — the percentage above already says it, and repeating it in the
   *  footer was restating the card to itself. */
  note: string | null;
  /** Footer right — the secondary fact (reset clock, window span). */
  secondary: string;
}

export interface GaugeData {
  cards: GaugeCard[];
  generatedAt: number;
}

// PACING.md's bands, on the five-hour used %: green under 60, amber to 85, red
// above. The weekly window is read on the same scale.
const AMBER = 60;
const RED = 85;
const band = (pct: number): GaugeState => (pct >= RED ? "depleted" : pct >= AMBER ? "warning" : "healthy");

const clock = (ms: number): string =>
  new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const dayClock = (ms: number): string =>
  new Date(ms).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });

export function usageGauge(): GaugeData {
  const now = Date.now();
  const snap = readLiveSnapshot();
  const fresh = snap && now - snap.capturedAt < LIVE_TTL_MS ? snap : null;

  const windowCard = (
    key: "session" | "week",
    label: string,
    span: string,
    w: LiveWindow | null | undefined,
    format: (ms: number) => string,
  ): GaugeCard =>
    w
      ? {
          key,
          label,
          pct: w.pct,
          state: band(w.pct),
          source: "live",
          note: null,
          secondary: w.resetsAt && w.resetsAt > now ? `resets ${format(w.resetsAt)}` : span,
        }
      : {
          key,
          label,
          pct: null,
          state: "healthy",
          source: "live",
          note: fresh ? "no reading for this window" : "no live reading yet",
          secondary: span,
        };

  const mix = weekModelMix();
  const fable = mix.shares.find((s) => s.tier === "Fable");
  const fableCard: GaugeCard = mix.totalWeighted
    ? {
        key: "fable",
        label: "Fable usage",
        pct: fable ? fable.pct : 0,
        state: "share",
        source: "modeled",
        note: null,
        secondary: "trailing 7 days",
      }
    : {
        key: "fable",
        label: "Fable usage",
        pct: null,
        state: "share",
        source: "modeled",
        note: "no local transcripts to meter",
        secondary: "trailing 7 days",
      };

  return {
    cards: [
      windowCard("session", "Window usage", "5-hour window", fresh?.fiveHour, clock),
      windowCard("week", "Weekly usage", "7-day window", fresh?.sevenDay, dayClock),
      fableCard,
    ],
    generatedAt: now,
  };
}
