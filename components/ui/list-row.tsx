import type { ReactNode } from "react";

// Catalog `ListRow` — bordered white row in a stack: leading slot
// (IconSquare/Avatar/ColorSwatch) + title (+ inline Badge) + muted meta +
// trailing slot. `accent` = 4px colored left band (status variant).

export function ListRow({
  leading,
  title,
  meta,
  trailing,
  accent,
  onClick,
  stackTrailing = false,
  className = "",
}: {
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  accent?: string; // CSS color for the left band
  onClick?: () => void;
  /** Action-heavy trailing (button clusters): wrap to a full-width second line on phones. */
  stackTrailing?: boolean;
  className?: string;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`relative flex w-full items-center gap-3 overflow-hidden rounded-card border border-border bg-surface px-4 py-3 text-left shadow-card transition-colors ${onClick ? "cursor-pointer hover:bg-canvas" : ""} ${stackTrailing ? "flex-wrap" : ""} ${className}`}
    >
      {accent && <span className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />}
      {leading && <span className="shrink-0">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold text-text">{title}</span>
        {meta && <span className="mt-0.5 block truncate text-sm text-text-muted">{meta}</span>}
      </span>
      {trailing && (
        <span className={`flex shrink-0 items-center gap-2 ${stackTrailing ? "max-sm:w-full max-sm:justify-end" : ""}`}>
          {trailing}
        </span>
      )}
    </Comp>
  );
}
