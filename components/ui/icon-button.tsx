import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "@/components/ui/icons";

// Catalog `IconButton` — bare 20px icon, ~36px hit area.
// Variants: default (grey hover fill) · filled (solid primary square) ·
// circular (floating panel-edge close) · danger (red icon) · onNavy (muted
// on-navy icon that brightens on the sidebar-active band — for the navy
// TopBar strip / sidebar chrome).

type Variant = "default" | "filled" | "circular" | "danger" | "onNavy";

const variants: Record<Variant, string> = {
  default: "rounded-field text-text-body hover:bg-[#F3F4F6]",
  filled: "rounded-field bg-primary text-white hover:bg-primary-hover",
  circular: "rounded-full border border-border bg-surface text-text-body shadow-card hover:bg-canvas",
  danger: "rounded-field text-danger hover:bg-danger-tint",
  onNavy: "rounded-field text-sidebar-text hover:bg-sidebar-active hover:text-white",
};

export function IconButton({
  icon,
  label,
  variant = "default",
  className = "",
  ...rest
}: {
  icon: IconName;
  label: string; // accessible name — icon-only buttons must have one
  variant?: Variant;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}
