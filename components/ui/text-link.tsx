import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icons";

// Catalog `TextLink` — inline link, optional leading icon. Renders a Next
// <Link> when `href` is given, else a <button>.
//   • primary   (default) — 600 weight, teal, no underline
//   • underline — muted body text, underlined; hover → teal (used for the
//     "View all" affordance at the foot of the marketing nav panels)

const base = "inline-flex items-center gap-1.5 text-[15px] transition-colors";

const VARIANTS = {
  primary: "font-semibold text-primary hover:text-primary-hover",
  underline: "font-medium text-text underline underline-offset-2 hover:text-primary",
} as const;

export function TextLink({
  href,
  icon,
  variant = "primary",
  className = "",
  children,
  ...rest
}: {
  href?: string;
  icon?: IconName;
  variant?: keyof typeof VARIANTS;
  children: ReactNode;
} & AnchorHTMLAttributes<HTMLAnchorElement> &
  ButtonHTMLAttributes<HTMLButtonElement>) {
  const content = (
    <>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={`${base} ${VARIANTS[variant]} ${className}`} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={`${base} ${VARIANTS[variant]} ${className}`} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {content}
    </button>
  );
}
