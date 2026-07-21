// The standards that make ten independent terminals read like one hand — the
// content behind the /workspace Rules tab. Three families: Design (how a
// surface looks and reads), Agent (how the fleet works and hands off), Database
// (how the data layer stays trustworthy). They share one list now, each card
// wearing its family as a badge.
//
// This file is the CARD layer: title + the one-paragraph lede a card shows. The
// full rule — the why and the how — lives in `docs/rules/<id>.md`, which is what
// a card click opens (and saves back to) in the DocSheet. Add a rule here AND
// add its doc; the id is the filename.

export type RuleTab = "design" | "agent" | "database";

export interface Rule {
  /** Also the doc filename: docs/rules/<id>.md */
  id: string;
  tab: RuleTab;
  title: string;
  /** The card lede. The full rule is in the doc. */
  body: string;
}

/** The family a rule belongs to. Once its own tab; now the badge in the card's
 *  lower-left, so the grouping survives the merge into one Rules list. */
export const RULE_CATEGORY: Record<RuleTab, string> = {
  design: "Design",
  agent: "Agent",
  database: "Database",
};

export const RULES: Rule[] = [
  // ── Design ────────────────────────────────────────────────────────────────
  {
    id: "reuse-kit",
    tab: "design",
    title: "Reuse the kit",
    body: "44 primitives, ~30 feature components. Compose them; a genuinely new primitive is a deliberate, announced act — never an accident of local convenience.",
  },
  {
    id: "one-h1",
    tab: "design",
    title: "One H1, rendered by the shell",
    body: "Every page's title is route-derived and rendered once by the app shell; pages never render their own. The frame is the same in every room.",
  },
  {
    id: "records-cross",
    tab: "design",
    title: "Records cross with one motion",
    body: "A value that lives in another table wears the dotted-teal underline that wipes to solid on hover — one meaning, on every surface.",
  },
  {
    id: "no-hedging",
    tab: "design",
    title: "No hedging copy",
    body: "State the number and what it is. No “roughly”, no “it seems”, no apology for a real figure — a dashboard that hedges teaches the reader to distrust it.",
  },
  {
    id: "shortest-noun",
    tab: "design",
    title: "Shortest honest noun",
    body: "Label a thing by the plainest word that's still true — no pipeline vocabulary on a founder surface. The card reads “Payers” and “Providers priced”, never the internal column names behind them.",
  },
  {
    id: "data-moves",
    tab: "design",
    title: "Data displays move",
    body: "Counts count up, the queue scrolls, the rail slides — motion that says the system is live. All of it gated behind reduced-motion, which holds every value at rest.",
  },
  {
    id: "no-card-links",
    tab: "design",
    title: "Cards carry no inline links",
    body: "No small teal word in a card's corner. If a card is actionable the whole card is the target, or the kebab holds the action — a link inside a clickable card is two targets in one object and makes neither obvious.",
  },
  {
    id: "no-approx-glyph",
    tab: "design",
    title: "No almost-equal glyph",
    body: "Estimates read as “14M+” or “155,317+”, never the almost-equal sign. An exact count and an estimate should look like the same kind of thing, one just carries a “+”.",
  },
  // ── Agent ─────────────────────────────────────────────────────────────────
  {
    id: "disjoint-seams",
    tab: "agent",
    title: "Disjoint seams",
    body: "Each agent owns a slice of the tree. A conflict escalates to the lead — it never clobbers a neighbour's work, and shared files are staged hunk by hunk.",
  },
  {
    id: "verified-exercised",
    tab: "agent",
    title: "Verified means exercised",
    body: "“Done” means the surface was rendered and looked at — in both themes, at the widths that matter — not that the types happened to pass.",
  },
  {
    id: "one-source",
    tab: "agent",
    title: "One source per fact",
    body: "The table registry, the CPT labels, the coverage cohort — each has exactly one home, so no two surfaces can quietly disagree.",
  },
  {
    id: "linear-lead-only",
    tab: "agent",
    title: "Linear is lead-only",
    body: "Issues are filed, closed and reorganised by the lead session alone. Every other terminal reports its Linear intents; one hand keeps the board coherent.",
  },
  // ── Database ──────────────────────────────────────────────────────────────
  {
    id: "refresh-keys",
    tab: "database",
    title: "Plain-column unique index",
    body: "A materialized view refreshed without blocking needs a unique index on plain columns — an expression index silently breaks the concurrent refresh.",
  },
  {
    id: "iso-strings",
    tab: "database",
    title: "Repos return ISO strings",
    body: "Neon hands back Date objects; every repo normalizes to ISO strings at the boundary (isoDateTime / isoDateOnly), so no surface ever renders a raw Date.",
  },
  {
    id: "live-db",
    tab: "database",
    title: "The database is live",
    body: "A LIVE Neon URL may sit in .env.local. No destructive write without a reversible map, and clean up any rows a test creates — production is one connection string away.",
  },
];
