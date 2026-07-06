import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icons";

// Catalog `Tag` — small label chip 13/500. Taxonomy pastels (hue-coded),
// grey metadata, dismissible (trailing ×).

export type TagHue =
  | "grey"
  | "yellow"
  | "pink"
  | "green"
  | "teal"
  | "cyan"
  | "blue"
  | "orange"
  | "red"
  | "violet";

const hues: Record<TagHue, string> = {
  grey: "bg-canvas text-text-body",
  yellow: "bg-[#FEF9C3] text-[#854D0E]",
  pink: "bg-[#FCE7F3] text-[#9D174D]",
  green: "bg-[#DCFCE7] text-[#166534]",
  teal: "bg-teal-100 text-teal-700",
  cyan: "bg-[#CFFAFE] text-[#155E75]",
  blue: "bg-[#DBEAFE] text-[#1E40AF]",
  orange: "bg-[#FFEDD5] text-[#9A3412]",
  red: "bg-[#FEE2E2] text-[#991B1B]",
  violet: "bg-[#EDE9FE] text-[#5B21B6]",
};

// Saturated per-hue dot — pairs a filter option with the pastel Tag it maps to.
const dotColors: Record<TagHue, string> = {
  grey: "bg-text-muted",
  yellow: "bg-[#EAB308]",
  pink: "bg-[#EC4899]",
  green: "bg-[#22C55E]",
  teal: "bg-teal-500",
  cyan: "bg-[#06B6D4]",
  blue: "bg-[#3B82F6]",
  orange: "bg-[#F97316]",
  red: "bg-[#EF4444]",
  violet: "bg-[#8B5CF6]",
};

export function TagDot({ hue = "grey", className = "" }: { hue?: TagHue; className?: string }) {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotColors[hue]} ${className}`} />;
}

export function Tag({
  hue = "grey",
  onDismiss,
  className = "",
  children,
}: {
  hue?: TagHue;
  onDismiss?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] font-medium ${hues[hue]} ${className}`}
    >
      {children}
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Remove" className="opacity-60 hover:opacity-100">
          <Icon name="x" size={12} />
        </button>
      )}
    </span>
  );
}
