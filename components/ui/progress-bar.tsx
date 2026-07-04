// Catalog `ProgressBar` — thin track, primary fill, optional right % label.

export function ProgressBar({
  value, // 0–100
  showLabel,
  className = "",
}: {
  value: number;
  showLabel?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-border"
      >
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <span className="text-sm font-semibold text-text">{Math.round(pct)}%</span>}
    </div>
  );
}
