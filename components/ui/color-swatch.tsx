// Catalog `ColorSwatch` — ~16px rounded color chip; keys a service to its
// calendar EventChip color. EVENT_COLORS = the Liminal categorical palette
// (Carepatron's, violet slot swapped for teal-600).

export const EVENT_COLORS = [
  "#3F8290", // teal (first slot — Liminal swap)
  "#3BA55C", // green
  "#E0447C", // magenta
  "#8A8F3C", // olive
  "#3B6FD4", // blue
  "#7C86E8", // periwinkle
  "#E07B3C", // orange
] as const;

export function ColorSwatch({
  color,
  selected,
  onSelect,
  className = "",
}: {
  color: string;
  selected?: boolean;
  onSelect?: () => void;
  className?: string;
}) {
  const swatch = (
    <span
      className={`inline-block h-4 w-4 rounded-[5px] ${selected ? "ring-2 ring-primary ring-offset-2" : ""} ${className}`}
      style={{ background: color }}
    />
  );
  if (!onSelect) return swatch;
  return (
    <button type="button" onClick={onSelect} aria-label={`Color ${color}`} aria-pressed={selected} className="inline-flex p-0.5">
      {swatch}
    </button>
  );
}
