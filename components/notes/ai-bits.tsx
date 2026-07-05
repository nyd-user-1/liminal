import type { TranscriptSegment } from "@/lib/types";

// AI-scribe suite (catalog §3b): TrendList · TranscriptPanel · ChapterList.
// Trend arrows/waves are not in the foundation icon set → local inline SVGs
// (FLAG for integration: consider promoting to components/ui/icons.tsx).

export type Trend = "up" | "down" | "flat" | "done";

const TREND_SVG: Record<Trend, { cls: string; path: React.ReactNode }> = {
  up: { cls: "text-success", path: <path d="M4 14l5-5 4 3 7-7M14 5h6v6" /> },
  down: { cls: "text-danger", path: <path d="M4 10l5 5 4-3 7 7M14 19h6v-6" /> },
  flat: { cls: "text-warning", path: <path d="M5 12h14" /> },
  done: { cls: "text-text-muted", path: <polyline points="20 6 9 17 4 12" /> },
};

function TrendIcon({ trend }: { trend: Trend }) {
  const t = TREND_SVG[trend];
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`mt-0.5 shrink-0 ${t.cls}`}
      aria-hidden
    >
      {t.path}
    </svg>
  );
}

export interface TrendItem {
  trend: Trend;
  text: string;
}

/** Insight bullet rows: leading trend icon + body text. */
export function TrendList({ items, className = "" }: { items: TrendItem[]; className?: string }) {
  return (
    <ul className={`flex flex-col gap-2.5 ${className}`}>
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm text-text-body">
          <TrendIcon trend={it.trend} />
          <span>{it.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function mmss(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Scrolling utterance rows: muted mm:ss column + speaker-tagged text. */
export function TranscriptPanel({
  segments,
  className = "",
}: {
  segments: TranscriptSegment[];
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {segments.map((s, i) => (
        <div key={i} className="flex items-start gap-3">
          <span className="w-9 shrink-0 pt-0.5 text-right font-mono text-[12px] text-text-muted">
            {mmss(s.t0)}
          </span>
          <p className="text-sm leading-relaxed text-text-body">
            <span className="mr-1.5 font-semibold capitalize text-text">{s.speaker}:</span>
            {s.text}
          </p>
        </div>
      ))}
    </div>
  );
}

export interface Chapter {
  t0: number;
  title: string;
  summary: string;
}

/** mm:ss + chapter title(600) + one-line muted summary per row. */
export function ChapterList({ chapters, className = "" }: { chapters: Chapter[]; className?: string }) {
  return (
    <div className={`flex flex-col gap-3.5 ${className}`}>
      {chapters.map((c, i) => (
        <div key={i} className="flex items-start gap-3">
          <span className="w-9 shrink-0 pt-0.5 text-right font-mono text-[12px] text-text-muted">
            {mmss(c.t0)}
          </span>
          <div>
            <p className="text-sm font-semibold text-text">{c.title}</p>
            <p className="text-sm text-text-muted">{c.summary}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Split a transcript into 3 canned chapters (demo grouping). */
export function deriveChapters(segments: TranscriptSegment[]): Chapter[] {
  if (segments.length === 0) return [];
  const third = Math.max(1, Math.ceil(segments.length / 3));
  const groups = [segments.slice(0, third), segments.slice(third, third * 2), segments.slice(third * 2)];
  const titles = [
    { title: "Check-in & symptom review", summary: "Opening check-in; interval symptom and sleep review." },
    { title: "Medication response & side effects", summary: "Tolerability, dose response, and adjustment discussion." },
    { title: "Plan & close", summary: "Skills review, plan confirmation, and follow-up scheduling." },
  ];
  return groups
    .filter((g) => g.length > 0)
    .map((g, i) => ({ t0: g[0].t0, ...titles[Math.min(i, titles.length - 1)] }));
}
