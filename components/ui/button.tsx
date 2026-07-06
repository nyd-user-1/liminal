import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";

// Catalog `Button` — the one action button.
// Variants: primary · secondary · ghost · danger (outline) · danger-solid.
// Sizes: sm (header actions) · md (40px default — the standard control height,
// matches Field/Select/SearchInput) · xl (~52px, full-width auth CTAs).

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-solid";
type Size = "sm" | "md" | "xl";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "bg-surface text-primary border border-border hover:border-primary",
  ghost: "bg-transparent text-primary hover:bg-teal-100",
  danger: "bg-surface text-danger border border-danger hover:bg-danger-tint",
  "danger-solid": "bg-danger text-white hover:bg-[#B91C1C]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-[15px]",
  xl: "h-13 px-6 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  leftIcon,
  fullWidth,
  loading,
  disabled,
  className = "",
  children,
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  leftIcon?: IconName;
  fullWidth?: boolean;
  loading?: boolean;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-field font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : leftIcon ? <Icon name={leftIcon} size={size === "sm" ? 16 : 18} /> : null}
      {children}
    </button>
  );
}
