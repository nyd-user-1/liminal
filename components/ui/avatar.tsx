import type { AvatarHue } from "@/lib/types";
import { initials } from "@/lib/format";

// Catalog `Avatar` — initials on a per-user hue circle (Liminal seeds:
// teal + amber pairs, plus pink/blue). Sizes: sm 28px · md 36px · lg 96px.

const hues: Record<AvatarHue, { bg: string; text: string }> = {
  teal: { bg: "#DCEBEE", text: "#2F6570" },
  amber: { bg: "#FBEED9", text: "#8A5A14" },
  pink: { bg: "#F6D3E4", text: "#8A1F5C" },
  blue: { bg: "#DBEAFE", text: "#1E40AF" },
};

const sizes = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-[13px]",
  lg: "h-24 w-24 text-3xl",
} as const;

export function Avatar({
  name,
  hue = "teal",
  size = "sm",
  src,
  className = "",
}: {
  name: string;
  hue?: AvatarHue;
  size?: keyof typeof sizes;
  /** Real photo — takes priority over the initials circle when present. */
  src?: string | null;
  className?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`inline-block shrink-0 select-none rounded-full object-cover ${sizes[size]} ${className}`}
      />
    );
  }
  const c = hues[hue] ?? hues.teal;
  return (
    <span
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ${sizes[size]} ${className}`}
      style={{ backgroundColor: c.bg, color: c.text }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

/** Overlapping avatar row with "+n" overflow circle. */
export function AvatarGroup({
  people,
  max = 4,
  className = "",
}: {
  people: Array<{ name: string; hue?: AvatarHue }>;
  max?: number;
  className?: string;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className={`inline-flex items-center ${className}`}>
      {shown.map((p, i) => (
        <Avatar
          key={`${p.name}-${i}`}
          name={p.name}
          hue={p.hue}
          size="sm"
          className={`ring-2 ring-surface ${i > 0 ? "-ml-2" : ""}`}
        />
      ))}
      {extra > 0 && (
        <span className="-ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-canvas text-[11px] font-semibold text-text-body ring-2 ring-surface">
          +{extra}
        </span>
      )}
    </span>
  );
}
