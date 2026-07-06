import type { ReactNode } from "react";

// Catalog `Badge` — status chip 13/500, pastel fill + same-hue dark text.
// `count` = solid circle (sidebar counts, bell); `dot` = bare colored circle;
// `solid-danger` = white on red (Recording).

type Variant = "neutral" | "success" | "warning" | "danger" | "info" | "blue" | "solid-danger";

const variants: Record<Variant, string> = {
  neutral: "bg-canvas text-text-body",
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
  info: "bg-info-tint text-info", // teal tint — Lead / Submitted / Processing
  blue: "bg-blue-100 text-blue-700", // blue tint — Scheduled
  "solid-danger": "bg-danger text-white",
};

export function Badge({
  variant = "neutral",
  className = "",
  children,
}: {
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Solid count circle — sidebar item counts, notification bell. */
export function CountBadge({
  count,
  variant = "primary",
  className = "",
}: {
  count: number;
  variant?: "primary" | "danger";
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold text-white ${variant === "danger" ? "bg-danger" : "bg-primary"} ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Bare colored status dot — mirrors the Badge palette so a dot can match a badge. */
export function DotBadge({
  variant = "neutral",
  className = "",
}: {
  variant?: "neutral" | "success" | "warning" | "danger" | "info" | "blue";
  className?: string;
}) {
  const colors = {
    neutral: "bg-text-muted",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-info", // teal — Lead
    blue: "bg-blue-500",
  };
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${colors[variant]} ${className}`} />;
}
