import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icons";

// Catalog `TextLink` — inline link, optional leading icon. Renders a Next
// <Link> when `href` is given, else a <button>.
//   • wipe      (default) — STANDARD: teal at NORMAL weight, with an underline
//     that wipes in on hover (the .link-wipe animation in globals.css). Teal +
//     the wipe already carry the affordance, so weight is not asked to help;
//     bolding every link is what made dense tables read as all-emphasis.
//   • name      — the wipe at 500, for an entity's own name in its identity
//     column (client, plan, provider). The one place weight earns its keep: it
//     makes the row's SUBJECT findable while everything else stays quiet. Use
//     it for the thing the row IS, never merely for a link that matters.
//   • primary   — 600 weight, teal, no underline
//   • underline — muted body text, static underline; hover → teal

const base = "inline-flex items-center gap-1.5 text-[15px] transition-colors";

const VARIANTS = {
  primary: "font-semibold text-primary hover:text-primary-hover",
  underline: "font-medium text-text underline underline-offset-2 hover:text-primary",
  wipe: "group font-normal text-primary",
  name: "group font-medium text-primary",
} as const;

/** Variants whose underline wipes in on hover — they need the .link-wipe span. */
const WIPE_VARIANTS = new Set<keyof typeof VARIANTS>(["wipe", "name"]);

export function TextLink({
  href,
  icon,
  variant = "wipe",
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
      {WIPE_VARIANTS.has(variant) ? <span className="link-wipe">{children}</span> : children}
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
