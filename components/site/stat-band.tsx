import type { ReactNode } from "react";

// Marketing stat band — big display numbers over a short label. Lighter than
// the app StatCard (which is a bordered KPI card); this reads as social proof
// on a marketing section. NEW (public marketing site).

export interface Stat {
  value: ReactNode;
  label: string;
  note?: string;
}

export function StatBand({
  stats,
  className = "",
  tone = "light",
}: {
  stats: Stat[];
  className?: string;
  tone?: "light" | "dark";
}) {
  const valueColor = tone === "dark" ? "text-white" : "text-text";
  const labelColor = tone === "dark" ? "text-white/70" : "text-text-body";
  const noteColor = tone === "dark" ? "text-white/50" : "text-text-muted";
  return (
    <dl className={`grid gap-8 sm:grid-cols-3 ${className}`}>
      {stats.map((s, i) => (
        <div key={i}>
          <dd className={`font-display text-4xl font-bold tracking-tight sm:text-5xl ${valueColor}`}>{s.value}</dd>
          <dt className={`mt-2 text-[15px] font-medium ${labelColor}`}>{s.label}</dt>
          {s.note && <p className={`mt-1 text-sm ${noteColor}`}>{s.note}</p>}
        </div>
      ))}
    </dl>
  );
}
